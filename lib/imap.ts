import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

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
  email: string,
  password: string,
  host?: string,
  port?: number
): Promise<string[]> {
  const client = new ImapFlow({
    host: host || process.env.IMAP_HOST || "imap.mailpool.io",
    port: port || Number(process.env.IMAP_PORT) || 993,
    secure: true,
    auth: { user: email, pass: password },
    logger: false,
  });

  try {
    await client.connect();
    const list = await client.list();
    return list.map((f) => f.path);
  } finally {
    await client.logout();
  }
}

export async function fetchEmails(
  email: string,
  password: string,
  folder: string,
  limit: number,
  host?: string,
  port?: number
): Promise<EmailMessage[]> {
  const client = new ImapFlow({
    host: host || process.env.IMAP_HOST || "imap.mailpool.io",
    port: port || Number(process.env.IMAP_PORT) || 993,
    secure: true,
    auth: { user: email, pass: password },
    logger: false,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock(folder);

    try {
      const messages: EmailMessage[] = [];
      const mailbox = client.mailbox;
      const totalMessages = mailbox && typeof mailbox === "object" ? mailbox.exists : 0;

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
  email: string,
  password: string,
  limit: number,
  host?: string,
  port?: number
): Promise<EmailMessage[]> {
  const imapHost = host || process.env.IMAP_HOST || "imap.mailpool.io";
  const client = new ImapFlow({
    host: imapHost,
    port: port || Number(process.env.IMAP_PORT) || 993,
    secure: true,
    auth: { user: email, pass: password },
    logger: false,
  });

  try {
    await client.connect();
    const sentFolder = await findSentFolder(client, imapHost);
    const lock = await client.getMailboxLock(sentFolder);

    try {
      const messages: EmailMessage[] = [];
      const mailbox = client.mailbox;
      const totalMessages =
        mailbox && typeof mailbox === "object" ? mailbox.exists : 0;

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
