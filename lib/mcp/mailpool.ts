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
  saveCampaignConfig, loadCampaignConfig, listCampaignConfigs, deleteCampaignConfig,
  upsertContactMarker, removeContactMarkerSegments, listAudienceSegmentsWithContacts, getContactMetadataByEmails,
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
      tag_filter: z.string().optional().describe("Boolean tag filter expression. Examples: 'interested', 'classified AND interested', 'NOT classified', 'do_not_contact OR unsubscribed'"),
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
      tag_filter: z.string().optional().describe("Boolean tag filter expression. Examples: 'interested', 'classified AND interested', 'NOT classified', 'do_not_contact OR unsubscribed'"),
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
    "get_email_account_analytics",
    {
      email: z.string().describe("Email account to get analytics for"),
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
                  statuses: {},
                  rates: {},
                }, null, 2),
              },
            ],
          };
        }

        const sentFolder = await resolveFolder(mailbox, "SENT");
        const statusTags = [
          "interested", "meeting_request", "information_request",
          "not_interested", "wrong_person", "do_not_contact",
          "out_of_office", "unsubscribed", "bounced",
        ];
        const counts = await Promise.all(
          statusTags.map((tag) => countByKeyword(mailbox, sentFolder, tag))
        );

        const statuses: Record<string, number> = {};
        const rates: Record<string, number> = {};
        const rate = (count: number) => Math.round((count / totalSent) * 10000) / 100;

        for (let i = 0; i < statusTags.length; i++) {
          statuses[statusTags[i]] = counts[i];
          rates[statusTags[i]] = rate(counts[i]);
        }

        const totalReplied = counts.reduce((sum, c) => sum + c, 0);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                totalSent,
                totalReplied,
                replyRate: rate(totalReplied),
                statuses,
                rates,
              }, null, 2),
            },
          ],
        };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `Failed to get analytics: ${errorMessage}` }],
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
      firstName: z.string().optional().describe("Contact first name (for email personalization)"),
      lastName: z.string().optional().describe("Contact last name"),
      company: z.string().optional().describe("Contact company name"),
    },
    async ({ email, segments, firstName, lastName, company }) => {
      try {
        const mailboxes = await listMailboxes();
        let totalTagged = 0;
        for (const mb of mailboxes) {
          const details = await getMailboxById(mb.id);
          // Tag existing messages in INBOX and SENT
          for (const folder of ["INBOX", "SENT"] as const) {
            totalTagged += await addAudienceSegments(details, folder, email, segments);
          }
          // Always create/update a contact marker with metadata + segments
          await upsertContactMarker(details, { email, firstName, lastName, company }, segments);
        }
        return {
          content: [
            { type: "text", text: `Added segments [${segments.join(", ")}] to ${email}${firstName ? ` (${firstName}${lastName ? " " + lastName : ""}${company ? ", " + company : ""})` : ""}. Tagged ${totalTagged} existing messages + contact marker across ${mailboxes.length} accounts.` },
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
          // Also remove from Contacts folder marker (delete marker if no segments remain)
          await removeContactMarkerSegments(details, email, segments);
        }
        return {
          content: [
            { type: "text", text: `Removed segments [${segments.join(", ")}] from ${email}. Untagged ${totalUntagged} messages + updated contact marker across ${mailboxes.length} accounts.` },
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
            const segments = await listAudienceSegmentsWithContacts(details, folder);
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

  // --- Reply status tools ---

  const REPLY_STATUSES = [
    { tag: "interested", description: "Positive — shows interest, wants to learn more" },
    { tag: "meeting_request", description: "Explicitly asked for or accepted a meeting" },
    { tag: "information_request", description: "Asked for more details, pricing, or documentation" },
    { tag: "not_interested", description: "Polite decline, not a fit right now" },
    { tag: "wrong_person", description: "Not the right contact, may have referred someone else" },
    { tag: "do_not_contact", description: "Hard stop — hostile, legal, or compliance concern" },
    { tag: "out_of_office", description: "Auto-reply or out-of-office response" },
    { tag: "unsubscribed", description: "Asked to stop receiving emails" },
    { tag: "bounced", description: "Delivery failure or bounce notification" },
  ];

  const STATUS_TAGS = REPLY_STATUSES.map((s) => s.tag);

  server.tool(
    "list_reply_statuses",
    {},
    async () => {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ statuses: REPLY_STATUSES }, null, 2),
        }],
      };
    }
  );

  server.tool(
    "set_reply_status",
    {
      email: z.string().describe("Email account that owns the mailbox"),
      uid: z.number().describe("UID of the received reply in INBOX"),
      status: z.enum([
        "interested", "meeting_request", "information_request",
        "not_interested", "wrong_person", "do_not_contact",
        "out_of_office", "unsubscribed", "bounced",
      ]).describe("Reply status to set"),
      sent_uid: z.number().optional().describe("UID of the matching sent email (if known). Both emails get tagged."),
    },
    async ({ email, uid, status, sent_uid }) => {
      const mailbox = await getMailboxByEmail(email);
      try {
        // Remove any existing status tags from the reply
        const detail = await fetchEmailByUid(mailbox, "INBOX", uid);
        const existingStatuses = detail.flags.filter((f) => STATUS_TAGS.includes(f));
        for (const oldStatus of existingStatuses) {
          await removeEmailFlag(mailbox, "INBOX", uid, oldStatus);
        }

        // Set new status + classified
        await setEmailFlag(mailbox, "INBOX", uid, status);
        await setEmailFlag(mailbox, "INBOX", uid, "classified");

        // Tag matching sent email too
        if (sent_uid) {
          const sentFolder = await resolveFolder(mailbox, "SENT");
          const sentDetail = await fetchEmailByUid(mailbox, sentFolder, sent_uid);
          const existingSentStatuses = sentDetail.flags.filter((f) => STATUS_TAGS.includes(f));
          for (const oldStatus of existingSentStatuses) {
            await removeEmailFlag(mailbox, sentFolder, sent_uid, oldStatus);
          }
          await setEmailFlag(mailbox, sentFolder, sent_uid, status);
          await setEmailFlag(mailbox, sentFolder, sent_uid, "classified");
        }

        return {
          content: [{
            type: "text",
            text: `Status "${status}" set on reply UID ${uid}${sent_uid ? ` and sent UID ${sent_uid}` : ""}.`,
          }],
        };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `Failed to set reply status: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  // --- Campaign tools ---

  server.tool(
    "get_campaign_analytics",
    {
      email: z.string().describe("Email account to analyze"),
      campaign: z.string().describe("Campaign name (matches campaign_{name} tag)"),
    },
    async ({ email, campaign }) => {
      const mailbox = await getMailboxByEmail(email);
      const campaignTag = `campaign_${campaign}`;

      try {
        // Fetch all sent emails for this campaign
        const sentPage = await fetchSentEmails(mailbox, 500);
        const campaignSent = sentPage.emails.filter((e) => e.flags.includes(campaignTag));

        if (campaignSent.length === 0) {
          return {
            content: [{ type: "text", text: JSON.stringify({ campaign, totalSent: 0, message: "No emails found for this campaign." }, null, 2) }],
          };
        }

        // Fetch replies to match
        const inboxPage = await fetchEmails(mailbox, "INBOX", 500);

        // Per-step and per-variant breakdown
        const steps = new Map<string, { sent: number; variants: Map<string, number> }>();
        const uniqueContacts = new Set<string>();

        for (const e of campaignSent) {
          const stepFlag = e.flags.find((f) => f.startsWith("step_"));
          const variantFlag = e.flags.find((f) => f.startsWith("variant_"));
          const stepName = stepFlag || "unknown";
          const variantName = variantFlag || "unknown";

          if (!steps.has(stepName)) steps.set(stepName, { sent: 0, variants: new Map() });
          const stepData = steps.get(stepName)!;
          stepData.sent++;
          stepData.variants.set(variantName, (stepData.variants.get(variantName) || 0) + 1);

          uniqueContacts.add(extractEmail(e.to));
        }

        // Count statuses on sent emails (tagged by set_reply_status)
        const statusCounts: Record<string, number> = {};
        for (const tag of STATUS_TAGS) {
          const count = campaignSent.filter((e) => e.flags.includes(tag)).length;
          if (count > 0) statusCounts[tag] = count;
        }

        // Count replies (inbox emails that match campaign sent subjects)
        const campaignSubjects = new Set(campaignSent.map((e) => normalizeSubject(e.subject)));
        const replies = inboxPage.emails.filter((e) => {
          const ns = normalizeSubject(e.subject);
          return campaignSubjects.has(ns);
        });

        // Per-step analytics
        const stepAnalytics: Record<string, { sent: number; variants: Record<string, number> }> = {};
        for (const [stepName, data] of steps) {
          stepAnalytics[stepName] = {
            sent: data.sent,
            variants: Object.fromEntries(data.variants),
          };
        }

        // Per-variant reply status breakdown
        const variantStatuses: Record<string, Record<string, number>> = {};
        for (const e of campaignSent) {
          const variantFlag = e.flags.find((f) => f.startsWith("variant_")) || "unknown";
          if (!variantStatuses[variantFlag]) variantStatuses[variantFlag] = { sent: 0 };
          variantStatuses[variantFlag].sent++;
          for (const tag of STATUS_TAGS) {
            if (e.flags.includes(tag)) {
              variantStatuses[variantFlag][tag] = (variantStatuses[variantFlag][tag] || 0) + 1;
            }
          }
        }

        const totalSent = campaignSent.length;
        const totalReplied = Object.values(statusCounts).reduce((sum, c) => sum + c, 0);
        const rate = (count: number) => Math.round((count / totalSent) * 10000) / 100;

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              campaign,
              totalSent,
              uniqueContacts: uniqueContacts.size,
              totalReplied,
              replyRate: rate(totalReplied),
              repliesDetected: replies.length,
              statuses: statusCounts,
              statusRates: Object.fromEntries(
                Object.entries(statusCounts).map(([k, v]) => [k, rate(v)])
              ),
              steps: stepAnalytics,
              variants: variantStatuses,
            }, null, 2),
          }],
        };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `Failed to get campaign analytics: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  // --- Campaign management tools ---

  const TERMINAL_STATUSES = ["do_not_contact", "unsubscribed", "bounced", "not_interested", "wrong_person"];

  server.tool(
    "create_campaign",
    {
      email: z.string().describe("Email account that owns/sends the campaign"),
      name: z.string().describe("Campaign name (lowercase, no spaces — used as tag)"),
      audience_segment: z.string().describe("Audience segment to target (e.g. 'vip', 'general'). Contacts are pulled from this segment when the campaign starts."),
      sequence: z.array(z.object({
        step: z.number().describe("Step number (1 = initial, 2+ = follow-ups)"),
        delay_days: z.number().describe("Days to wait after previous step before sending"),
        variants: z.array(z.object({
          name: z.string().describe("Variant name (e.g. 'a', 'b')"),
          weight: z.number().describe("Selection weight (e.g. 50 for 50%)"),
          subject: z.string().describe("Subject line (supports {{firstName}}, {{lastName}}, {{email}}, {{company}}). Empty on step 2+ = reply in same thread."),
          text: z.string().optional().describe("Plain text body with {{placeholder}} support"),
          html: z.string().optional().describe("HTML body with {{placeholder}} support"),
        })),
      })).describe("Email sequence steps with A/B variants"),
    },
    async ({ email, name, audience_segment, sequence }) => {
      const mailbox = await getMailboxByEmail(email);
      try {
        const config = {
          name,
          audience_segment,
          sequence,
          created_at: new Date().toISOString(),
        };
        await saveCampaignConfig(mailbox, config);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              campaign: name,
              audience_segment,
              steps: sequence.length,
              totalVariants: sequence.reduce((sum, s) => sum + s.variants.length, 0),
              status: "created",
            }, null, 2),
          }],
        };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `Failed to create campaign: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "list_campaigns",
    {
      email: z.string().describe("Email account to list campaigns for"),
    },
    async ({ email }) => {
      const mailbox = await getMailboxByEmail(email);
      try {
        const campaigns = await listCampaignConfigs(mailbox);
        return {
          content: [{ type: "text", text: JSON.stringify({ campaigns }, null, 2) }],
        };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `Failed to list campaigns: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "get_campaign",
    {
      email: z.string().describe("Email account that owns the campaign"),
      campaign: z.string().describe("Campaign name"),
    },
    async ({ email, campaign }) => {
      const mailbox = await getMailboxByEmail(email);
      try {
        const config = await loadCampaignConfig(mailbox, campaign);
        return {
          content: [{ type: "text", text: JSON.stringify(config, null, 2) }],
        };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `Failed to get campaign: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "delete_campaign",
    {
      email: z.string().describe("Email account that owns the campaign"),
      campaign: z.string().describe("Campaign name to delete"),
    },
    async ({ email, campaign }) => {
      const mailbox = await getMailboxByEmail(email);
      try {
        await deleteCampaignConfig(mailbox, campaign);
        return {
          content: [{ type: "text", text: `Campaign "${campaign}" deleted.` }],
        };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `Failed to delete campaign: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "start_campaign",
    {
      email: z.string().describe("Email account to send from"),
      campaign: z.string().describe("Campaign name to execute"),
    },
    async ({ email, campaign }) => {
      const mailbox = await getMailboxByEmail(email);

      try {
        const config = await loadCampaignConfig(mailbox, campaign);
        const campaignTag = `campaign_${config.name}`;
        const sortedSteps = [...config.sequence].sort((a, b) => a.step - b.step);

        // Pull contacts from audience segment (includes Contacts folder markers)
        const mailboxes = await listMailboxes();
        const mergedContacts = new Set<string>();
        for (const mb of mailboxes) {
          const details = await getMailboxById(mb.id);
          for (const folder of ["INBOX", "SENT"] as const) {
            const segments = await listAudienceSegmentsWithContacts(details, folder);
            const target = segments.find((s) => s.name === config.audience_segment);
            if (target) {
              for (const c of target.contacts) mergedContacts.add(c);
            }
          }
        }

        const contacts = Array.from(mergedContacts);
        if (contacts.length === 0) {
          return {
            content: [{ type: "text", text: `No contacts found in audience segment "${config.audience_segment}". Enroll contacts with add_to_audience first.` }],
            isError: true,
          };
        }

        // Load contact metadata for template personalization
        const contactMetadata = await getContactMetadataByEmails(mailbox, contacts);

        // Fetch all sent emails tagged with this campaign
        const sentPage = await fetchSentEmails(mailbox, 500);
        const campaignSent = sentPage.emails.filter((e) => e.flags.includes(campaignTag));

        // Fetch inbox to check for terminal reply statuses
        const inboxPage = await fetchEmails(mailbox, "INBOX", 500);

        // Pick variant by weighted random selection
        function pickVariant(variants: typeof config.sequence[0]["variants"]) {
          const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
          let r = Math.random() * totalWeight;
          for (const v of variants) {
            r -= v.weight;
            if (r <= 0) return v;
          }
          return variants[variants.length - 1];
        }

        function interpolate(template: string, contactEmail: string) {
          const meta = contactMetadata.get(contactEmail.toLowerCase());
          return template
            .replace(/\{\{email\}\}/g, contactEmail)
            .replace(/\{\{firstName\}\}/g, meta?.firstName || "")
            .replace(/\{\{lastName\}\}/g, meta?.lastName || "")
            .replace(/\{\{company\}\}/g, meta?.company || "");
        }

        const results: Array<{ contact: string; step: number; variant: string; status: string }> = [];
        const now = Date.now();

        for (const contactEmail of contacts) {
          // Check if contact has a terminal reply status
          const contactReplies = inboxPage.emails.filter(
            (e) => extractEmail(e.from) === contactEmail
          );
          const hasTerminalStatus = contactReplies.some(
            (e) => e.flags.some((f) => TERMINAL_STATUSES.includes(f))
          );
          if (hasTerminalStatus) {
            results.push({ contact: contactEmail, step: 0, variant: "-", status: "skipped_terminal_status" });
            continue;
          }

          // Find which steps this contact has already received
          const contactSent = campaignSent.filter(
            (e) => e.to.toLowerCase().includes(contactEmail)
          );
          const completedSteps = new Set<number>();
          let lastSentDate = 0;

          for (const e of contactSent) {
            const stepFlag = e.flags.find((f) => f.startsWith("step_"));
            if (stepFlag) {
              const stepNum = parseInt(stepFlag.replace("step_", ""), 10);
              completedSteps.add(stepNum);
              const sentDate = new Date(e.date).getTime();
              if (sentDate > lastSentDate) lastSentDate = sentDate;
            }
          }

          // Find next step to send
          const nextStep = sortedSteps.find((s) => !completedSteps.has(s.step));
          if (!nextStep) {
            results.push({ contact: contactEmail, step: 0, variant: "-", status: "completed_all_steps" });
            continue;
          }

          // Check delay
          if (nextStep.step > 1 && lastSentDate > 0) {
            const daysSinceLast = (now - lastSentDate) / (1000 * 60 * 60 * 24);
            if (daysSinceLast < nextStep.delay_days) {
              results.push({
                contact: contactEmail,
                step: nextStep.step,
                variant: "-",
                status: `waiting_delay (${Math.ceil(nextStep.delay_days - daysSinceLast)}d remaining)`,
              });
              continue;
            }
          }

          // Send
          const variant = pickVariant(nextStep.variants);
          const variantTag = `variant_${variant.name}`;
          const stepTag = `step_${nextStep.step}`;
          const subject = interpolate(variant.subject, contactEmail);
          const text = variant.text ? interpolate(variant.text, contactEmail) : undefined;
          const html = variant.html ? interpolate(variant.html, contactEmail) : undefined;

          if (!text && !html) {
            results.push({ contact: contactEmail, step: nextStep.step, variant: variant.name, status: "skipped_no_body" });
            continue;
          }

          try {
            let result;

            // Step 2+ with empty subject = reply in thread
            if (nextStep.step > 1 && !variant.subject) {
              const originalSent = contactSent.find((e) => e.flags.includes("step_1"));
              if (originalSent) {
                const sentFolder = await resolveFolder(mailbox, "SENT");
                const headers = await getEmailHeaders(mailbox, sentFolder, originalSent.uid);
                const reSubject = headers.subject.match(/^re:/i) ? headers.subject : `Re: ${headers.subject}`;
                const references = [headers.references, headers.messageId].filter(Boolean).join(" ");
                result = await sendEmail(mailbox, {
                  to: [contactEmail],
                  subject: reSubject,
                  text,
                  html,
                  inReplyTo: headers.messageId,
                  references,
                });
              } else {
                results.push({ contact: contactEmail, step: nextStep.step, variant: variant.name, status: "skipped_no_original_thread" });
                continue;
              }
            } else {
              result = await sendEmail(mailbox, { to: [contactEmail], subject, text, html });
            }

            await appendToSent(mailbox, result.raw);

            // Tag the sent email
            const recentSent = await fetchSentEmails(mailbox, 5);
            const justSent = recentSent.emails.find(
              (e) => e.to.toLowerCase().includes(contactEmail)
            );
            if (justSent) {
              const sentFolder = await resolveFolder(mailbox, "SENT");
              await setEmailFlag(mailbox, sentFolder, justSent.uid, campaignTag);
              await setEmailFlag(mailbox, sentFolder, justSent.uid, stepTag);
              await setEmailFlag(mailbox, sentFolder, justSent.uid, variantTag);
            }

            results.push({ contact: contactEmail, step: nextStep.step, variant: variant.name, status: "sent" });
          } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            results.push({ contact: contactEmail, step: nextStep.step, variant: variant.name, status: `error: ${errorMessage}` });
          }
        }

        const sent = results.filter((r) => r.status === "sent").length;
        const skipped = results.filter((r) => r.status.startsWith("skipped") || r.status.startsWith("waiting") || r.status.startsWith("completed")).length;
        const errors = results.filter((r) => r.status.startsWith("error")).length;

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              campaign: config.name,
              audience_segment: config.audience_segment,
              summary: { sent, skipped, errors, total: contacts.length },
              results,
            }, null, 2),
          }],
        };
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `Failed to start campaign: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );
}
