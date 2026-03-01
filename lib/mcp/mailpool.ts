import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { listMailboxes, getMailboxByEmail } from "@/lib/mailpool";
import { fetchEmails, fetchSentEmails, appendToSent, setEmailFlag, removeEmailFlag, matchRepliesToSent, filterByTagExpression, resolveFolder, countByKeyword } from "@/lib/imap";
import { sendEmail } from "@/lib/smtp";

export function registerMailpoolTools(server: McpServer) {
  server.tool("list_email_accounts", {}, async () => {
    const mailboxes = await listMailboxes();
    const accounts = mailboxes.map((m) => ({
      id: m.id,
      email: m.email,
      firstName: m.firstName,
      lastName: m.lastName,
      status: m.status,
      domain: m.domain,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(accounts, null, 2) }],
    };
  });

  server.tool(
    "list_received_emails",
    {
      email: z.string(),
      limit: z.number().optional().default(50).describe("Emails per page"),
      page: z.number().optional().default(1).describe("Page number (1-indexed, most recent first)"),
      tag_filter: z.string().optional().describe("Boolean tag filter expression. Examples: 'interested', 'classified AND interested', 'NOT classified', 'complained OR unsubscribed'"),
    },
    async ({ email, limit, page, tag_filter }) => {
      const mailbox = await getMailboxByEmail(email);
      const result = await fetchEmails(mailbox, "INBOX", limit, page);
      if (tag_filter) {
        result.emails = filterByTagExpression(result.emails, tag_filter);
      }
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  server.tool(
    "send_email",
    {
      from: z.string().describe("Sender email address (must be a registered mailbox)"),
      to: z.array(z.string()).describe("Recipient email addresses"),
      subject: z.string().describe("Email subject"),
      text: z.string().optional().describe("Plain text body"),
      html: z.string().optional().describe("HTML body"),
      cc: z.array(z.string()).optional().describe("CC recipients"),
      bcc: z.array(z.string()).optional().describe("BCC recipients"),
    },
    async ({ from, to, subject, text, html, cc, bcc }) => {
      if (!text && !html) {
        return {
          content: [{ type: "text", text: "Error: at least one of `text` or `html` body is required." }],
          isError: true,
        };
      }

      const mailbox = await getMailboxByEmail(from);

      try {
        const result = await sendEmail(mailbox, { to, subject, text, html, cc, bcc });

        // Copy to Sent folder via IMAP so list_sent_emails can find it
        await appendToSent(mailbox, result.raw);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  messageId: result.messageId,
                  accepted: result.accepted,
                  rejected: result.rejected,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `Failed to send email: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "list_sent_emails",
    {
      email: z.string(),
      limit: z.number().optional().default(50).describe("Emails per page"),
      page: z.number().optional().default(1).describe("Page number (1-indexed, most recent first)"),
      tag_filter: z.string().optional().describe("Boolean tag filter expression. Examples: 'interested', 'classified AND interested', 'NOT classified', 'complained OR unsubscribed'"),
    },
    async ({ email, limit, page, tag_filter }) => {
      const mailbox = await getMailboxByEmail(email);
      const result = await fetchSentEmails(mailbox, limit, page);
      if (tag_filter) {
        result.emails = filterByTagExpression(result.emails, tag_filter);
      }
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  server.tool(
    "find_reply_threads",
    {
      email: z.string().describe("Email account to analyze"),
      receivedLimit: z.number().optional().default(50).describe("Max received emails to check"),
      sentLimit: z.number().optional().default(200).describe("Max sent emails to match against"),
      unclassifiedOnly: z.boolean().optional().default(true).describe("Only check emails without the 'classified' flag"),
    },
    async ({ email, receivedLimit, sentLimit, unclassifiedOnly }) => {
      const mailbox = await getMailboxByEmail(email);
      try {
        const receivedPage = await fetchEmails(mailbox, "INBOX", receivedLimit);
        const filtered = unclassifiedOnly
          ? receivedPage.emails.filter((e) => !e.flags.includes("classified"))
          : receivedPage.emails;

        if (filtered.length === 0) {
          return {
            content: [{ type: "text", text: JSON.stringify({ matches: [], unmatchedUids: [], totalChecked: 0 }, null, 2) }],
          };
        }

        const sentPage = await fetchSentEmails(mailbox, sentLimit);
        const result = matchRepliesToSent(filtered, sentPage.emails);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { ...result, totalChecked: filtered.length },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `Failed to find threads: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "list_metrics",
    {
      email: z.string().describe("Email account to get metrics for"),
    },
    async ({ email }) => {
      const mailbox = await getMailboxByEmail(email);
      try {
        const sentPage = await fetchSentEmails(mailbox, 1);
        const totalSent = sentPage.total;

        if (totalSent === 0) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  totalSent: 0,
                  bounced: 0,
                  complained: 0,
                  interested: 0,
                  bounce_rate: 0,
                  complain_rate: 0,
                  interest_rate: 0,
                }, null, 2),
              },
            ],
          };
        }

        const sentFolder = await resolveFolder(mailbox, "SENT");
        const [bounced, complained, interested] = await Promise.all([
          countByKeyword(mailbox, sentFolder, "bounced"),
          countByKeyword(mailbox, sentFolder, "complained"),
          countByKeyword(mailbox, sentFolder, "interested"),
        ]);

        const rate = (count: number) =>
          Math.round((count / totalSent) * 10000) / 100;

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  totalSent,
                  bounced,
                  complained,
                  interested,
                  bounce_rate: rate(bounced),
                  complain_rate: rate(complained),
                  interest_rate: rate(interested),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `Failed to get metrics: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "add_email_tag",
    {
      email: z.string().describe("Email account that owns the mailbox"),
      uid: z.number().describe("UID of the email message"),
      tag: z.string().describe("IMAP keyword to add"),
      folder: z.enum(["INBOX", "SENT"]).optional().default("INBOX").describe("Folder: INBOX or SENT"),
    },
    async ({ email, uid, tag, folder }) => {
      const mailbox = await getMailboxByEmail(email);
      try {
        const resolvedFolder = await resolveFolder(mailbox, folder);
        await setEmailFlag(mailbox, resolvedFolder, uid, tag);
        return {
          content: [
            { type: "text", text: `Tag "${tag}" added to message UID ${uid} in ${folder}.` },
          ],
        };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `Failed to add tag: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "remove_email_tag",
    {
      email: z.string().describe("Email account that owns the mailbox"),
      uid: z.number().describe("UID of the email message"),
      tag: z.string().describe("IMAP keyword to remove"),
      folder: z.enum(["INBOX", "SENT"]).optional().default("INBOX").describe("Folder: INBOX or SENT"),
    },
    async ({ email, uid, tag, folder }) => {
      const mailbox = await getMailboxByEmail(email);
      try {
        const resolvedFolder = await resolveFolder(mailbox, folder);
        await removeEmailFlag(mailbox, resolvedFolder, uid, tag);
        return {
          content: [
            { type: "text", text: `Tag "${tag}" removed from message UID ${uid} in ${folder}.` },
          ],
        };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `Failed to remove tag: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );
}
