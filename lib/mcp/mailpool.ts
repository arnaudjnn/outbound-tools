import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { listMailboxes, getMailboxByEmail, getMailboxById } from "@/lib/mailpool";
import {
  fetchEmails, fetchSentEmails, appendToSent, setEmailFlag, removeEmailFlag,
  matchRepliesToSent, filterByTagExpression, resolveFolder, countByKeyword,
  addAudienceSegments, removeAudienceSegments, listAudienceSegments,
  fetchEmailByUid, fetchEmailRawByUid, deleteEmail, getEmailHeaders,
  fetchDrafts, saveDraft, deleteDraft, fetchAttachmentByUid,
  normalizeSubject, extractEmail, resolveDraftsFolder,
} from "@/lib/imap";
import { sendEmail, composeDraft } from "@/lib/smtp";

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
    "list_threads",
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

  server.tool(
    "add_to_audience",
    {
      email: z.string().describe("Contact email to segment (e.g. the person you send to or receive from)"),
      segments: z.array(z.string()).optional().default(["general"]).describe("Audience segments to add (e.g. ['employee', 'vip'])"),
    },
    async ({ email, segments }) => {
      try {
        const mailboxes = await listMailboxes();
        let totalTagged = 0;
        for (const mb of mailboxes) {
          const details = await getMailboxById(mb.id);
          for (const folder of ["INBOX", "SENT"] as const) {
            totalTagged += await addAudienceSegments(details, folder, email, segments);
          }
        }
        return {
          content: [
            { type: "text", text: `Added segments [${segments.join(", ")}] to ${email}. Tagged ${totalTagged} messages across ${mailboxes.length} accounts.` },
          ],
        };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `Failed to add audience segments: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "remove_from_audience",
    {
      email: z.string().describe("Contact email to remove from segments"),
      segments: z.array(z.string()).describe("Audience segments to remove"),
    },
    async ({ email, segments }) => {
      try {
        const mailboxes = await listMailboxes();
        let totalUntagged = 0;
        for (const mb of mailboxes) {
          const details = await getMailboxById(mb.id);
          for (const folder of ["INBOX", "SENT"] as const) {
            totalUntagged += await removeAudienceSegments(details, folder, email, segments);
          }
        }
        return {
          content: [
            { type: "text", text: `Removed segments [${segments.join(", ")}] from ${email}. Untagged ${totalUntagged} messages across ${mailboxes.length} accounts.` },
          ],
        };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `Failed to remove audience segments: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "list_audiences",
    {},
    async () => {
      try {
        const mailboxes = await listMailboxes();
        const mergedSegments = new Map<string, Set<string>>();

        for (const mb of mailboxes) {
          const details = await getMailboxById(mb.id);
          for (const folder of ["INBOX", "SENT"] as const) {
            const segments = await listAudienceSegments(details, folder);
            for (const seg of segments) {
              if (!mergedSegments.has(seg.name)) mergedSegments.set(seg.name, new Set());
              for (const contact of seg.contacts) {
                mergedSegments.get(seg.name)!.add(contact);
              }
            }
          }
        }

        const segments = Array.from(mergedSegments.entries()).map(([name, contacts]) => ({
          name,
          count: contacts.size,
          contacts: Array.from(contacts),
        }));

        return {
          content: [{ type: "text", text: JSON.stringify({ segments }, null, 2) }],
        };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `Failed to list audiences: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  // --- High-value tools ---

  server.tool(
    "get_email",
    {
      email: z.string().describe("Email account that owns the mailbox"),
      uid: z.number().describe("UID of the email message"),
      folder: z.enum(["INBOX", "SENT"]).optional().default("INBOX").describe("Folder: INBOX or SENT"),
    },
    async ({ email, uid, folder }) => {
      const mailbox = await getMailboxByEmail(email);
      try {
        const resolvedFolder = await resolveFolder(mailbox, folder);
        const detail = await fetchEmailByUid(mailbox, resolvedFolder, uid);
        return {
          content: [{ type: "text", text: JSON.stringify(detail, null, 2) }],
        };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `Failed to get email: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "get_email_raw",
    {
      email: z.string().describe("Email account that owns the mailbox"),
      uid: z.number().describe("UID of the email message"),
      folder: z.enum(["INBOX", "SENT"]).optional().default("INBOX").describe("Folder: INBOX or SENT"),
    },
    async ({ email, uid, folder }) => {
      const mailbox = await getMailboxByEmail(email);
      try {
        const resolvedFolder = await resolveFolder(mailbox, folder);
        const raw = await fetchEmailRawByUid(mailbox, resolvedFolder, uid);
        return {
          content: [{ type: "text", text: raw.toString("utf-8") }],
        };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `Failed to get raw email: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "reply_to_email",
    {
      email: z.string().describe("Email account to reply from"),
      uid: z.number().describe("UID of the email to reply to"),
      folder: z.enum(["INBOX", "SENT"]).optional().default("INBOX").describe("Folder where the original email is"),
      text: z.string().optional().describe("Plain text reply body"),
      html: z.string().optional().describe("HTML reply body"),
    },
    async ({ email, uid, folder, text, html }) => {
      if (!text && !html) {
        return {
          content: [{ type: "text", text: "Error: at least one of `text` or `html` body is required." }],
          isError: true,
        };
      }

      const mailbox = await getMailboxByEmail(email);
      try {
        const resolvedFolder = await resolveFolder(mailbox, folder);
        const original = await getEmailHeaders(mailbox, resolvedFolder, uid);

        const replyTo = extractEmail(original.from);
        const subject = original.subject.match(/^re:/i) ? original.subject : `Re: ${original.subject}`;
        const references = [original.references, original.messageId].filter(Boolean).join(" ");

        const result = await sendEmail(mailbox, {
          to: [replyTo],
          subject,
          text,
          html,
          inReplyTo: original.messageId,
          references,
        });

        await appendToSent(mailbox, result.raw);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              messageId: result.messageId,
              accepted: result.accepted,
              rejected: result.rejected,
              inReplyTo: original.messageId,
            }, null, 2),
          }],
        };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `Failed to reply: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "reply_all_to_email",
    {
      email: z.string().describe("Email account to reply from"),
      uid: z.number().describe("UID of the email to reply to"),
      folder: z.enum(["INBOX", "SENT"]).optional().default("INBOX").describe("Folder where the original email is"),
      text: z.string().optional().describe("Plain text reply body"),
      html: z.string().optional().describe("HTML reply body"),
    },
    async ({ email, uid, folder, text, html }) => {
      if (!text && !html) {
        return {
          content: [{ type: "text", text: "Error: at least one of `text` or `html` body is required." }],
          isError: true,
        };
      }

      const mailbox = await getMailboxByEmail(email);
      try {
        const resolvedFolder = await resolveFolder(mailbox, folder);
        const original = await getEmailHeaders(mailbox, resolvedFolder, uid);

        const ownEmail = mailbox.email.toLowerCase();
        // To: original sender
        const toAddresses = [extractEmail(original.from)];
        // CC: original To + CC minus ourselves
        const allRecipients = [original.to, original.cc]
          .filter(Boolean)
          .join(", ")
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean)
          .map((a) => extractEmail(a))
          .filter((a) => a !== ownEmail && !toAddresses.includes(a));

        const subject = original.subject.match(/^re:/i) ? original.subject : `Re: ${original.subject}`;
        const references = [original.references, original.messageId].filter(Boolean).join(" ");

        const result = await sendEmail(mailbox, {
          to: toAddresses,
          subject,
          text,
          html,
          cc: allRecipients.length > 0 ? allRecipients : undefined,
          inReplyTo: original.messageId,
          references,
        });

        await appendToSent(mailbox, result.raw);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              messageId: result.messageId,
              accepted: result.accepted,
              rejected: result.rejected,
              inReplyTo: original.messageId,
            }, null, 2),
          }],
        };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `Failed to reply all: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "forward_email",
    {
      email: z.string().describe("Email account to forward from"),
      uid: z.number().describe("UID of the email to forward"),
      folder: z.enum(["INBOX", "SENT"]).optional().default("INBOX").describe("Folder where the original email is"),
      to: z.array(z.string()).describe("Recipients to forward to"),
      text: z.string().optional().describe("Optional additional message"),
      html: z.string().optional().describe("Optional additional HTML message"),
    },
    async ({ email, uid, folder, to, text, html }) => {
      const mailbox = await getMailboxByEmail(email);
      try {
        const resolvedFolder = await resolveFolder(mailbox, folder);
        const original = await getEmailHeaders(mailbox, resolvedFolder, uid);

        const subject = original.subject.match(/^fwd?:/i) ? original.subject : `Fwd: ${original.subject}`;

        // Build forwarded body
        const fwdHeader = `\n\n---------- Forwarded message ----------\nFrom: ${original.from}\nDate: ${original.date}\nSubject: ${original.subject}\nTo: ${original.to}\n\n`;
        const fwdText = text ? text + fwdHeader + (original.text || "") : fwdHeader + (original.text || "");
        const fwdHtml = html
          ? html + `<br><br><hr><b>---------- Forwarded message ----------</b><br>From: ${original.from}<br>Date: ${original.date}<br>Subject: ${original.subject}<br>To: ${original.to}<br><br>${original.html || original.text || ""}`
          : original.html
            ? `<br><hr><b>---------- Forwarded message ----------</b><br>From: ${original.from}<br>Date: ${original.date}<br>Subject: ${original.subject}<br>To: ${original.to}<br><br>${original.html}`
            : undefined;

        const result = await sendEmail(mailbox, {
          to,
          subject,
          text: fwdText,
          html: fwdHtml,
          attachments: original.attachments,
        });

        await appendToSent(mailbox, result.raw);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              messageId: result.messageId,
              accepted: result.accepted,
              rejected: result.rejected,
              forwardedFrom: original.messageId,
            }, null, 2),
          }],
        };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `Failed to forward: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "delete_email",
    {
      email: z.string().describe("Email account that owns the mailbox"),
      uid: z.number().describe("UID of the email message to delete"),
      folder: z.enum(["INBOX", "SENT"]).optional().default("INBOX").describe("Folder: INBOX or SENT"),
    },
    async ({ email, uid, folder }) => {
      const mailbox = await getMailboxByEmail(email);
      try {
        const resolvedFolder = await resolveFolder(mailbox, folder);
        await deleteEmail(mailbox, resolvedFolder, uid);
        return {
          content: [{ type: "text", text: `Message UID ${uid} deleted from ${folder}.` }],
        };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `Failed to delete email: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "get_thread",
    {
      email: z.string().describe("Email account to search"),
      subject: z.string().describe("Subject line to match (Re:/Fwd: prefixes are stripped for matching)"),
      limit: z.number().optional().default(100).describe("Max emails to scan per folder"),
    },
    async ({ email, subject, limit }) => {
      const mailbox = await getMailboxByEmail(email);
      try {
        const [inbox, sent] = await Promise.all([
          fetchEmails(mailbox, "INBOX", limit),
          fetchSentEmails(mailbox, limit),
        ]);

        const normalizedTarget = normalizeSubject(subject);
        const allEmails = [...inbox.emails, ...sent.emails];
        const threadEmails = allEmails
          .filter((e) => normalizeSubject(e.subject) === normalizedTarget)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const senders = [...new Set(threadEmails.map((e) => extractEmail(e.from)))];

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              subject: normalizedTarget,
              messageCount: threadEmails.length,
              senders,
              messages: threadEmails,
            }, null, 2),
          }],
        };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `Failed to get thread: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "get_attachment",
    {
      email: z.string().describe("Email account that owns the mailbox"),
      uid: z.number().describe("UID of the email message"),
      index: z.number().describe("Attachment index (0-based, from get_email attachments list)"),
      folder: z.enum(["INBOX", "SENT"]).optional().default("INBOX").describe("Folder: INBOX or SENT"),
    },
    async ({ email, uid, index, folder }) => {
      const mailbox = await getMailboxByEmail(email);
      try {
        const resolvedFolder = await resolveFolder(mailbox, folder);
        const attachment = await fetchAttachmentByUid(mailbox, resolvedFolder, uid, index);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              filename: attachment.filename,
              contentType: attachment.contentType,
              size: attachment.size,
              content_base64: attachment.content,
            }, null, 2),
          }],
        };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `Failed to get attachment: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  // --- Draft tools ---

  server.tool(
    "list_drafts",
    {
      email: z.string().describe("Email account to list drafts for"),
      limit: z.number().optional().default(50).describe("Drafts per page"),
      page: z.number().optional().default(1).describe("Page number (1-indexed, most recent first)"),
    },
    async ({ email, limit, page }) => {
      const mailbox = await getMailboxByEmail(email);
      try {
        const result = await fetchDrafts(mailbox, limit, page);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `Failed to list drafts: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "get_draft",
    {
      email: z.string().describe("Email account that owns the draft"),
      uid: z.number().describe("UID of the draft message"),
    },
    async ({ email, uid }) => {
      const mailbox = await getMailboxByEmail(email);
      try {
        const draftsFolder = await resolveDraftsFolder(mailbox);
        const detail = await fetchEmailByUid(mailbox, draftsFolder, uid);
        return {
          content: [{ type: "text", text: JSON.stringify(detail, null, 2) }],
        };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `Failed to get draft: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "create_draft",
    {
      email: z.string().describe("Email account to create draft in"),
      to: z.array(z.string()).describe("Recipient email addresses"),
      subject: z.string().describe("Email subject"),
      text: z.string().optional().describe("Plain text body"),
      html: z.string().optional().describe("HTML body"),
      cc: z.array(z.string()).optional().describe("CC recipients"),
      bcc: z.array(z.string()).optional().describe("BCC recipients"),
    },
    async ({ email, to, subject, text, html, cc, bcc }) => {
      const mailbox = await getMailboxByEmail(email);
      try {
        const raw = await composeDraft(mailbox, { to, subject, text, html, cc, bcc });
        await saveDraft(mailbox, raw);
        return {
          content: [{ type: "text", text: `Draft created for ${to.join(", ")} with subject "${subject}".` }],
        };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `Failed to create draft: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "update_draft",
    {
      email: z.string().describe("Email account that owns the draft"),
      uid: z.number().describe("UID of the existing draft to replace"),
      to: z.array(z.string()).describe("Recipient email addresses"),
      subject: z.string().describe("Email subject"),
      text: z.string().optional().describe("Plain text body"),
      html: z.string().optional().describe("HTML body"),
      cc: z.array(z.string()).optional().describe("CC recipients"),
      bcc: z.array(z.string()).optional().describe("BCC recipients"),
    },
    async ({ email, uid, to, subject, text, html, cc, bcc }) => {
      const mailbox = await getMailboxByEmail(email);
      try {
        // IMAP doesn't support in-place edit — delete old draft and save new one
        await deleteDraft(mailbox, uid);
        const raw = await composeDraft(mailbox, { to, subject, text, html, cc, bcc });
        await saveDraft(mailbox, raw);
        return {
          content: [{ type: "text", text: `Draft updated (old UID ${uid} replaced) for ${to.join(", ")} with subject "${subject}".` }],
        };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `Failed to update draft: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "delete_draft",
    {
      email: z.string().describe("Email account that owns the draft"),
      uid: z.number().describe("UID of the draft to delete"),
    },
    async ({ email, uid }) => {
      const mailbox = await getMailboxByEmail(email);
      try {
        await deleteDraft(mailbox, uid);
        return {
          content: [{ type: "text", text: `Draft UID ${uid} deleted.` }],
        };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `Failed to delete draft: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "send_draft",
    {
      email: z.string().describe("Email account that owns the draft"),
      uid: z.number().describe("UID of the draft to send"),
    },
    async ({ email, uid }) => {
      const mailbox = await getMailboxByEmail(email);
      try {
        // Fetch the draft to get its content
        const draftsFolder = await resolveDraftsFolder(mailbox);
        const detail = await fetchEmailByUid(mailbox, draftsFolder, uid);

        const toAddresses = detail.to.split(",").map((a) => a.trim()).filter(Boolean);
        const ccAddresses = detail.cc ? detail.cc.split(",").map((a) => a.trim()).filter(Boolean) : undefined;

        if (toAddresses.length === 0) {
          return {
            content: [{ type: "text", text: "Error: draft has no recipients." }],
            isError: true,
          };
        }

        const result = await sendEmail(mailbox, {
          to: toAddresses,
          subject: detail.subject,
          text: detail.text || undefined,
          html: detail.html || undefined,
          cc: ccAddresses,
        });

        await appendToSent(mailbox, result.raw);
        await deleteDraft(mailbox, uid);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              messageId: result.messageId,
              accepted: result.accepted,
              rejected: result.rejected,
              draftDeleted: true,
            }, null, 2),
          }],
        };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `Failed to send draft: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );
}
