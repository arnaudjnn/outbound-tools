import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import type { MailboxDetails } from "@/lib/mailpool";

function createImapClient(mailbox: MailboxDetails): ImapFlow {
  return new ImapFlow({
    host: mailbox.imapHost,
    port: mailbox.imapPort,
    secure: mailbox.imapTLS,
    auth: { user: mailbox.imapUsername, pass: mailbox.imapPassword },
    logger: false,
  });
}

// Finds the Sent folder by looking for the \Sent special-use flag on the IMAP server.
// Falls back to host-based naming convention if not found.
export async function findSentFolder(
  client: ImapFlow,
  host: string
): Promise<string> {
  try {
    const folders = await client.list();
    const sent = folders.find((f) => f.specialUse === "\\Sent");
    if (sent) return sent.path;
  } catch {
    // fall through to host-based mapping
  }

  const h = host.toLowerCase();
  if (h.includes("gmail")) return "[Gmail]/Sent Mail";
  if (h.includes("outlook") || h.includes("office365")) return "Sent Items";
  return "Sent";
}

export interface EmailMessage {
  subject: string;
  from: string;
  to: string;
  date: string;
  preview: string;
}

export async function listFolders(
  mailbox: MailboxDetails
): Promise<string[]> {
  const client = createImapClient(mailbox);
  try {
    await client.connect();
    const list = await client.list();
    return list.map((f) => f.path);
  } finally {
    await client.logout();
  }
}

export async function fetchEmails(
  mailbox: MailboxDetails,
  folder: string,
  limit: number
): Promise<EmailMessage[]> {
  const client = createImapClient(mailbox);

  try {
    await client.connect();
    const lock = await client.getMailboxLock(folder);

    try {
      const messages: EmailMessage[] = [];
      const mb = client.mailbox;
      const totalMessages = mb && typeof mb === "object" ? mb.exists : 0;

      if (totalMessages === 0) return [];

      const start = Math.max(1, totalMessages - limit + 1);
      const range = `${start}:*`;

      for await (const msg of client.fetch(range, {
        envelope: true,
        source: true,
      })) {
        if (!msg.source) continue;
        const parsed = await simpleParser(msg.source);
        messages.push({
          subject: parsed.subject || "(no subject)",
          from: parsed.from?.text || "",
          to: parsed.to
            ? Array.isArray(parsed.to)
              ? parsed.to.map((a) => a.text).join(", ")
              : parsed.to.text
            : "",
          date: parsed.date?.toISOString() || "",
          preview: (parsed.text || "").slice(0, 200),
        });
      }

      return messages.reverse();
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

// Auto-discovers the correct Sent folder via IMAP special-use flags,
// then fetches sent emails. Works across Gmail, Microsoft, Mailpool, etc.
export async function fetchSentEmails(
  mailbox: MailboxDetails,
  limit: number
): Promise<EmailMessage[]> {
  const client = createImapClient(mailbox);

  try {
    await client.connect();
    const sentFolder = await findSentFolder(client, mailbox.imapHost);
    const lock = await client.getMailboxLock(sentFolder);

    try {
      const messages: EmailMessage[] = [];
      const mb = client.mailbox;
      const totalMessages =
        mb && typeof mb === "object" ? mb.exists : 0;

      if (totalMessages === 0) return [];

      const start = Math.max(1, totalMessages - limit + 1);
      const range = `${start}:*`;

      for await (const msg of client.fetch(range, {
        envelope: true,
        source: true,
      })) {
        if (!msg.source) continue;
        const parsed = await simpleParser(msg.source);
        messages.push({
          subject: parsed.subject || "(no subject)",
          from: parsed.from?.text || "",
          to: parsed.to
            ? Array.isArray(parsed.to)
              ? parsed.to.map((a) => a.text).join(", ")
              : parsed.to.text
            : "",
          date: parsed.date?.toISOString() || "",
          preview: (parsed.text || "").slice(0, 200),
        });
      }

      return messages.reverse();
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}