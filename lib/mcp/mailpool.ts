import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { listMailboxes, getMailboxByEmail } from "@/lib/mailpool";
import { fetchEmails, fetchSentEmails } from "@/lib/imap";

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
    { email: z.string(), limit: z.number().optional().default(20) },
    async ({ email, limit }) => {
      const mailbox = await getMailboxByEmail(email);
      const emails = await fetchEmails(
        mailbox.imapUsername,
        mailbox.imapPassword,
        "INBOX",
        limit,
        mailbox.imapHost,
        mailbox.imapPort
      );
      return {
        content: [{ type: "text", text: JSON.stringify(emails, null, 2) }],
      };
    }
  );

  server.tool(
    "list_sent_emails",
    { email: z.string(), limit: z.number().optional().default(20) },
    async ({ email, limit }) => {
      const mailbox = await getMailboxByEmail(email);
      const emails = await fetchSentEmails(
        mailbox.imapUsername,
        mailbox.imapPassword,
        limit,
        mailbox.imapHost,
        mailbox.imapPort
      );
      return {
        content: [{ type: "text", text: JSON.stringify(emails, null, 2) }],
      };
    }
  );
}
