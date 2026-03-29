import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import type { MailboxDetails } from "@/lib/mailpool";

// Strips Re:/Fwd:/Fw:/AW: prefixes (case-insensitive, repeated) and trims.
export function normalizeSubject(subject: string): string {
  return subject.replace(/^(re|fwd?|aw):\s*/gi, "").trim().toLowerCase();
}

// Extracts the bare email from "Name <email>" or plain "email" format.
export function extractEmail(from: string): string {
  const match = from.match(/<(.+?)>/);
  return (match ? match[1] : from).trim().toLowerCase();
}

export interface ThreadMatch {
  receivedUid: number;
  receivedSubject: string;
  receivedFrom: string;
  receivedDate: string;
  receivedPreview: string;
  sentUid: number;
  sentSubject: string;
  sentTo: string;
  sentDate: string;
  sentPreview: string;
}

// Matches received INBOX emails to sent emails by normalized subject + sender was a recipient.
// Returns matches for emails that are replies to sent emails, and a list of unmatched UIDs.
export function matchRepliesToSent(
  received: EmailMessage[],
  sent: EmailMessage[]
): { matches: ThreadMatch[]; unmatchedUids: number[] } {
  const matches: ThreadMatch[] = [];
  const unmatchedUids: number[] = [];

  for (const rx of received) {
    const rxSubject = normalizeSubject(rx.subject);
    const senderEmail = extractEmail(rx.from);

    const sentMatch = sent.find((s) => {
      const sentSubject = normalizeSubject(s.subject);
      if (rxSubject !== sentSubject) return false;
      // Check if the sender of the reply was a recipient of the sent email
      const sentTo = s.to.toLowerCase();
      return sentTo.includes(senderEmail);
    });

    if (sentMatch) {
      matches.push({
        receivedUid: rx.uid,
        receivedSubject: rx.subject,
        receivedFrom: rx.from,
        receivedDate: rx.date,
        receivedPreview: rx.preview,
        sentUid: sentMatch.uid,
        sentSubject: sentMatch.subject,
        sentTo: sentMatch.to,
        sentDate: sentMatch.date,
        sentPreview: sentMatch.preview,
      });
    } else {
      unmatchedUids.push(rx.uid);
    }
  }

  return { matches, unmatchedUids };
}

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

// --- Tag filter expression parser ---
// Supports: tag_name, AND, OR, NOT, parentheses
// Examples: "positive_reply", "classified AND positive_reply",
//           "NOT classified", "(positive_reply OR interested) AND NOT bounced"

type TagExpr =
  | { type: "tag"; name: string }
  | { type: "and"; left: TagExpr; right: TagExpr }
  | { type: "or"; left: TagExpr; right: TagExpr }
  | { type: "not"; expr: TagExpr };

function tokenizeTagFilter(input: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < input.length) {
    if (input[i] === " " || input[i] === "\t") {
      i++;
    } else if (input[i] === "(" || input[i] === ")") {
      tokens.push(input[i]);
      i++;
    } else {
      let word = "";
      while (i < input.length && input[i] !== " " && input[i] !== "\t" && input[i] !== "(" && input[i] !== ")") {
        word += input[i];
        i++;
      }
      tokens.push(word);
    }
  }
  return tokens;
}

function parseTagFilter(input: string): TagExpr {
  const tokens = tokenizeTagFilter(input);
  let pos = 0;

  function parseOr(): TagExpr {
    let left = parseAnd();
    while (pos < tokens.length && tokens[pos].toUpperCase() === "OR") {
      pos++;
      const right = parseAnd();
      left = { type: "or", left, right };
    }
    return left;
  }

  function parseAnd(): TagExpr {
    let left = parseNot();
    while (pos < tokens.length && tokens[pos].toUpperCase() === "AND") {
      pos++;
      const right = parseNot();
      left = { type: "and", left, right };
    }
    return left;
  }

  function parseNot(): TagExpr {
    if (pos < tokens.length && tokens[pos].toUpperCase() === "NOT") {
      pos++;
      const expr = parseNot();
      return { type: "not", expr };
    }
    return parseAtom();
  }

  function parseAtom(): TagExpr {
    if (pos >= tokens.length) throw new Error("Unexpected end of tag filter expression");
    if (tokens[pos] === "(") {
      pos++;
      const expr = parseOr();
      if (pos >= tokens.length || tokens[pos] !== ")") throw new Error("Missing closing parenthesis in tag filter");
      pos++;
      return expr;
    }
    const name = tokens[pos];
    pos++;
    return { type: "tag", name };
  }

  const result = parseOr();
  if (pos < tokens.length) throw new Error(`Unexpected token "${tokens[pos]}" in tag filter`);
  return result;
}

function evalTagFilter(expr: TagExpr, flags: Set<string>): boolean {
  switch (expr.type) {
    case "tag":
      return flags.has(expr.name);
    case "and":
      return evalTagFilter(expr.left, flags) && evalTagFilter(expr.right, flags);
    case "or":
      return evalTagFilter(expr.left, flags) || evalTagFilter(expr.right, flags);
    case "not":
      return !evalTagFilter(expr.expr, flags);
  }
}

export function filterByTagExpression(
  emails: EmailMessage[],
  filter: string
): EmailMessage[] {
  const expr = parseTagFilter(filter);
  return emails.filter((e) => evalTagFilter(expr, new Set(e.flags)));
}

export interface EmailMessage {
  uid: number;
  flags: string[];
  subject: string;
  from: string;
  to: string;
  date: string;
  preview: string;
}

export interface EmailAttachmentMeta {
  index: number;
  filename: string;
  contentType: string;
  size: number;
}

export interface EmailDetail extends EmailMessage {
  text: string;
  html: string;
  cc: string;
  messageId: string;
  inReplyTo: string;
  references: string;
  attachments: EmailAttachmentMeta[];
}

export interface EmailHeaders {
  messageId: string;
  inReplyTo: string;
  references: string;
  subject: string;
  from: string;
  to: string;
  cc: string;
  date: string;
  text: string;
  html: string;
  attachments: Array<{ filename: string; content: Buffer; contentType: string }>;
}

export interface EmailPage {
  emails: EmailMessage[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Resolves a folder alias: "INBOX" stays as-is, "SENT" auto-discovers the Sent folder.
export async function resolveFolder(
  mailbox: MailboxDetails,
  folder: string
): Promise<string> {
  if (folder.toUpperCase() === "SENT") {
    const client = createImapClient(mailbox);
    try {
      await client.connect();
      return await findSentFolder(client, mailbox.imapHost);
    } finally {
      await client.logout();
    }
  }
  return folder;
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
  limit: number,
  page: number = 1
): Promise<EmailPage> {
  const client = createImapClient(mailbox);

  try {
    await client.connect();
    const lock = await client.getMailboxLock(folder);

    try {
      const mb = client.mailbox;
      const totalMessages = mb && typeof mb === "object" ? mb.exists : 0;
      const totalPages = Math.max(1, Math.ceil(totalMessages / limit));

      if (totalMessages === 0) {
        return { emails: [], total: 0, page, limit, totalPages: 1 };
      }

      // Page 1 = most recent emails, descending
      const offset = (page - 1) * limit;
      const end = totalMessages - offset;
      const start = Math.max(1, end - limit + 1);

      if (end < 1) {
        return { emails: [], total: totalMessages, page, limit, totalPages };
      }

      const range = `${start}:${end}`;
      const messages: EmailMessage[] = [];

      for await (const msg of client.fetch(range, {
        uid: true,
        flags: true,
        envelope: true,
        source: true,
      })) {
        if (!msg.source) continue;
        const parsed = await simpleParser(msg.source);
        messages.push({
          uid: msg.uid,
          flags: Array.from(msg.flags || []),
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

      // Most recent first
      messages.reverse();

      return { emails: messages, total: totalMessages, page, limit, totalPages };
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

// Appends a raw RFC822 message to the Sent folder via IMAP.
export async function appendToSent(
  mailbox: MailboxDetails,
  raw: Buffer
): Promise<void> {
  const client = createImapClient(mailbox);
  try {
    await client.connect();
    const sentFolder = await findSentFolder(client, mailbox.imapHost);
    await client.append(sentFolder, raw, ["\\Seen"]);
  } finally {
    await client.logout();
  }
}

// Auto-discovers the correct Sent folder via IMAP special-use flags,
// then fetches sent emails. Works across Gmail, Microsoft, Mailpool, etc.
export async function fetchSentEmails(
  mailbox: MailboxDetails,
  limit: number,
  page: number = 1
): Promise<EmailPage> {
  const client = createImapClient(mailbox);

  try {
    await client.connect();
    const sentFolder = await findSentFolder(client, mailbox.imapHost);
    const lock = await client.getMailboxLock(sentFolder);

    try {
      const mb = client.mailbox;
      const totalMessages =
        mb && typeof mb === "object" ? mb.exists : 0;
      const totalPages = Math.max(1, Math.ceil(totalMessages / limit));

      if (totalMessages === 0) {
        return { emails: [], total: 0, page, limit, totalPages: 1 };
      }

      const offset = (page - 1) * limit;
      const end = totalMessages - offset;
      const start = Math.max(1, end - limit + 1);

      if (end < 1) {
        return { emails: [], total: totalMessages, page, limit, totalPages };
      }

      const range = `${start}:${end}`;
      const messages: EmailMessage[] = [];

      for await (const msg of client.fetch(range, {
        uid: true,
        flags: true,
        envelope: true,
        source: true,
      })) {
        if (!msg.source) continue;
        const parsed = await simpleParser(msg.source);
        messages.push({
          uid: msg.uid,
          flags: Array.from(msg.flags || []),
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

      messages.reverse();

      return { emails: messages, total: totalMessages, page, limit, totalPages };
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

// Adds an IMAP keyword/flag to a message by UID.
export async function setEmailFlag(
  mailbox: MailboxDetails,
  folder: string,
  uid: number,
  flag: string
): Promise<void> {
  const client = createImapClient(mailbox);
  try {
    await client.connect();
    const lock = await client.getMailboxLock(folder);
    try {
      await client.messageFlagsAdd({ uid: uid }, [flag], { uid: true });
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

// Removes an IMAP keyword/flag from a message by UID.
export async function removeEmailFlag(
  mailbox: MailboxDetails,
  folder: string,
  uid: number,
  flag: string
): Promise<void> {
  const client = createImapClient(mailbox);
  try {
    await client.connect();
    const lock = await client.getMailboxLock(folder);
    try {
      await client.messageFlagsRemove({ uid: uid }, [flag], { uid: true });
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

// Counts emails in a folder that have a given IMAP keyword via SEARCH.
export async function countByKeyword(
  mailbox: MailboxDetails,
  folder: string,
  keyword: string
): Promise<number> {
  const client = createImapClient(mailbox);
  try {
    await client.connect();
    const lock = await client.getMailboxLock(folder);
    try {
      const result = await client.search({ keyword }, { uid: true });
      return result === false ? 0 : result.length;
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

const AUDIENCE_PREFIX = "audience_";

// Adds audience segment keywords to all messages from/to a contact in a folder.
// Searches by FROM in INBOX, by TO in Sent folders. Returns number of tagged messages.
export async function addAudienceSegments(
  mailbox: MailboxDetails,
  folder: string,
  contactEmail: string,
  segments: string[]
): Promise<number> {
  const flags = segments.map((s) => `${AUDIENCE_PREFIX}${s}`);
  const client = createImapClient(mailbox);
  try {
    await client.connect();
    const isSent = folder !== "INBOX";
    const resolvedFolder = isSent ? await findSentFolder(client, mailbox.imapHost) : folder;
    const lock = await client.getMailboxLock(resolvedFolder);
    try {
      const criteria = isSent ? { to: contactEmail } : { from: contactEmail };
      const uids = await client.search(criteria, { uid: true });
      if (!uids || uids.length === 0) return 0;
      await client.messageFlagsAdd(uids, flags, { uid: true });
      return uids.length;
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

// Removes audience segment keywords from all messages from/to a contact in a folder.
// Searches by FROM in INBOX, by TO in Sent folders. Returns number of untagged messages.
export async function removeAudienceSegments(
  mailbox: MailboxDetails,
  folder: string,
  contactEmail: string,
  segments: string[]
): Promise<number> {
  const flags = segments.map((s) => `${AUDIENCE_PREFIX}${s}`);
  const client = createImapClient(mailbox);
  try {
    await client.connect();
    const isSent = folder !== "INBOX";
    const resolvedFolder = isSent ? await findSentFolder(client, mailbox.imapHost) : folder;
    const lock = await client.getMailboxLock(resolvedFolder);
    try {
      const criteria = isSent ? { to: contactEmail } : { from: contactEmail };
      const uids = await client.search(criteria, { uid: true });
      if (!uids || uids.length === 0) return 0;
      await client.messageFlagsRemove(uids, flags, { uid: true });
      return uids.length;
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

export interface AudienceSegment {
  name: string;
  contacts: string[];
}

// Lists audience segments in a folder by scanning flags and envelope (from/to).
// Returns unique contacts per segment, deduplicated by email address.
export async function listAudienceSegments(
  mailbox: MailboxDetails,
  folder: string
): Promise<AudienceSegment[]> {
  const client = createImapClient(mailbox);
  try {
    await client.connect();
    const isSent = folder !== "INBOX";
    const resolvedFolder = isSent ? await findSentFolder(client, mailbox.imapHost) : folder;
    const lock = await client.getMailboxLock(resolvedFolder);
    try {
      const mb = client.mailbox;
      const totalMessages = mb && typeof mb === "object" ? mb.exists : 0;
      if (totalMessages === 0) return [];

      const segmentContacts = new Map<string, Set<string>>();
      for await (const msg of client.fetch("1:*", { flags: true, envelope: true })) {
        const audienceFlags = Array.from(msg.flags || []).filter((f) => f.startsWith(AUDIENCE_PREFIX));
        if (audienceFlags.length === 0) continue;

        const addresses = isSent
          ? (msg.envelope?.to || [])
          : (msg.envelope?.from || []);
        const emails = addresses
          .map((a: { address?: string }) => a.address?.toLowerCase())
          .filter(Boolean) as string[];

        for (const flag of audienceFlags) {
          const name = flag.slice(AUDIENCE_PREFIX.length);
          if (!segmentContacts.has(name)) segmentContacts.set(name, new Set());
          for (const addr of emails) {
            segmentContacts.get(name)!.add(addr);
          }
        }
      }

      return Array.from(segmentContacts.entries()).map(([name, contacts]) => ({
        name,
        contacts: Array.from(contacts),
      }));
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

// Fetches emails from a folder that do NOT have the `classified` keyword.
export async function fetchUnclassifiedEmails(
  mailbox: MailboxDetails,
  folder: string,
  limit: number
): Promise<EmailMessage[]> {
  const client = createImapClient(mailbox);

  try {
    await client.connect();
    const lock = await client.getMailboxLock(folder);

    try {
      const result = await client.search(
        { unKeyword: "classified" },
        { uid: true }
      );

      const uids = result === false ? [] : result;
      if (uids.length === 0) return [];

      // Take the most recent UIDs up to the limit
      const selectedUids = uids.slice(-limit);
      const uidRange = selectedUids.join(",");

      const messages: EmailMessage[] = [];
      for await (const msg of client.fetch(uidRange, {
        uid: true,
        flags: true,
        envelope: true,
        source: true,
      }, { uid: true })) {
        if (!msg.source) continue;
        const parsed = await simpleParser(msg.source);
        messages.push({
          uid: msg.uid,
          flags: Array.from(msg.flags || []),
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

// Fetches a single email by UID with full body, attachments metadata, and headers.
export async function fetchEmailByUid(
  mailbox: MailboxDetails,
  folder: string,
  uid: number
): Promise<EmailDetail> {
  const client = createImapClient(mailbox);
  try {
    await client.connect();
    const lock = await client.getMailboxLock(folder);
    try {
      const msg = await client.fetchOne(String(uid), {
        uid: true,
        flags: true,
        envelope: true,
        source: true,
      }, { uid: true });

      if (!msg || !msg.source) throw new Error(`Message UID ${uid} not found or has no source`);
      const parsed = await simpleParser(msg.source);

      const attachments: EmailAttachmentMeta[] = (parsed.attachments || []).map((a, i) => ({
        index: i,
        filename: a.filename || `attachment-${i}`,
        contentType: a.contentType || "application/octet-stream",
        size: a.size || 0,
      }));

      return {
        uid: msg.uid,
        flags: Array.from(msg.flags || []),
        subject: parsed.subject || "(no subject)",
        from: parsed.from?.text || "",
        to: parsed.to
          ? Array.isArray(parsed.to)
            ? parsed.to.map((a) => a.text).join(", ")
            : parsed.to.text
          : "",
        cc: parsed.cc
          ? Array.isArray(parsed.cc)
            ? parsed.cc.map((a) => a.text).join(", ")
            : parsed.cc.text
          : "",
        date: parsed.date?.toISOString() || "",
        preview: (parsed.text || "").slice(0, 200),
        text: parsed.text || "",
        html: parsed.html || "",
        messageId: parsed.messageId || "",
        inReplyTo: parsed.inReplyTo || "",
        references: Array.isArray(parsed.references)
          ? parsed.references.join(" ")
          : parsed.references || "",
        attachments,
      };
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

// Fetches raw RFC822 source of a single email by UID.
export async function fetchEmailRawByUid(
  mailbox: MailboxDetails,
  folder: string,
  uid: number
): Promise<Buffer> {
  const client = createImapClient(mailbox);
  try {
    await client.connect();
    const lock = await client.getMailboxLock(folder);
    try {
      const msg = await client.fetchOne(String(uid), { source: true }, { uid: true });
      if (!msg || !msg.source) throw new Error(`Message UID ${uid} not found or has no source`);
      return msg.source;
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

// Deletes a message by UID (flags \Deleted + expunge).
export async function deleteEmail(
  mailbox: MailboxDetails,
  folder: string,
  uid: number
): Promise<void> {
  const client = createImapClient(mailbox);
  try {
    await client.connect();
    const lock = await client.getMailboxLock(folder);
    try {
      await client.messageDelete({ uid }, { uid: true });
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

// Finds the Drafts folder by special-use flag, with host-based fallback.
export async function findDraftsFolder(
  client: ImapFlow,
  host: string
): Promise<string> {
  try {
    const folders = await client.list();
    const drafts = folders.find((f) => f.specialUse === "\\Drafts");
    if (drafts) return drafts.path;
  } catch {
    // fall through to host-based mapping
  }
  const h = host.toLowerCase();
  if (h.includes("gmail")) return "[Gmail]/Drafts";
  return "Drafts";
}

// Resolves the Drafts folder for a mailbox.
export async function resolveDraftsFolder(
  mailbox: MailboxDetails
): Promise<string> {
  const client = createImapClient(mailbox);
  try {
    await client.connect();
    return await findDraftsFolder(client, mailbox.imapHost);
  } finally {
    await client.logout();
  }
}

// Fetches drafts from the Drafts folder with pagination.
export async function fetchDrafts(
  mailbox: MailboxDetails,
  limit: number,
  page: number = 1
): Promise<EmailPage> {
  const client = createImapClient(mailbox);
  try {
    await client.connect();
    const draftsFolder = await findDraftsFolder(client, mailbox.imapHost);
    const lock = await client.getMailboxLock(draftsFolder);
    try {
      const mb = client.mailbox;
      const totalMessages = mb && typeof mb === "object" ? mb.exists : 0;
      const totalPages = Math.max(1, Math.ceil(totalMessages / limit));

      if (totalMessages === 0) {
        return { emails: [], total: 0, page, limit, totalPages: 1 };
      }

      const offset = (page - 1) * limit;
      const end = totalMessages - offset;
      const start = Math.max(1, end - limit + 1);

      if (end < 1) {
        return { emails: [], total: totalMessages, page, limit, totalPages };
      }

      const range = `${start}:${end}`;
      const messages: EmailMessage[] = [];

      for await (const msg of client.fetch(range, {
        uid: true,
        flags: true,
        envelope: true,
        source: true,
      })) {
        if (!msg.source) continue;
        const parsed = await simpleParser(msg.source);
        messages.push({
          uid: msg.uid,
          flags: Array.from(msg.flags || []),
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

      messages.reverse();
      return { emails: messages, total: totalMessages, page, limit, totalPages };
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

// Saves a raw RFC822 message as a draft in the Drafts folder.
export async function saveDraft(
  mailbox: MailboxDetails,
  raw: Buffer
): Promise<void> {
  const client = createImapClient(mailbox);
  try {
    await client.connect();
    const draftsFolder = await findDraftsFolder(client, mailbox.imapHost);
    await client.append(draftsFolder, raw, ["\\Draft", "\\Seen"]);
  } finally {
    await client.logout();
  }
}

// Deletes a draft by UID from the Drafts folder.
export async function deleteDraft(
  mailbox: MailboxDetails,
  uid: number
): Promise<void> {
  const client = createImapClient(mailbox);
  try {
    await client.connect();
    const draftsFolder = await findDraftsFolder(client, mailbox.imapHost);
    const lock = await client.getMailboxLock(draftsFolder);
    try {
      await client.messageDelete({ uid }, { uid: true });
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

// Fetches a specific attachment from an email by UID and attachment index.
export async function fetchAttachmentByUid(
  mailbox: MailboxDetails,
  folder: string,
  uid: number,
  attachmentIndex: number
): Promise<{ filename: string; contentType: string; content: string; size: number }> {
  const client = createImapClient(mailbox);
  try {
    await client.connect();
    const lock = await client.getMailboxLock(folder);
    try {
      const msg = await client.fetchOne(String(uid), { source: true }, { uid: true });
      if (!msg || !msg.source) throw new Error(`Message UID ${uid} not found`);
      const parsed = await simpleParser(msg.source);
      const attachments = parsed.attachments || [];
      if (attachmentIndex < 0 || attachmentIndex >= attachments.length) {
        throw new Error(`Attachment index ${attachmentIndex} out of range (0-${attachments.length - 1})`);
      }
      const att = attachments[attachmentIndex];
      return {
        filename: att.filename || `attachment-${attachmentIndex}`,
        contentType: att.contentType || "application/octet-stream",
        content: att.content.toString("base64"),
        size: att.size || 0,
      };
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

// Gets full headers and body of a message for reply/forward operations.
export async function getEmailHeaders(
  mailbox: MailboxDetails,
  folder: string,
  uid: number
): Promise<EmailHeaders> {
  const client = createImapClient(mailbox);
  try {
    await client.connect();
    const lock = await client.getMailboxLock(folder);
    try {
      const msg = await client.fetchOne(String(uid), { source: true }, { uid: true });
      if (!msg || !msg.source) throw new Error(`Message UID ${uid} not found`);
      const parsed = await simpleParser(msg.source);

      const attachments = (parsed.attachments || []).map((a) => ({
        filename: a.filename || "attachment",
        content: a.content,
        contentType: a.contentType || "application/octet-stream",
      }));

      return {
        messageId: parsed.messageId || "",
        inReplyTo: parsed.inReplyTo || "",
        references: Array.isArray(parsed.references)
          ? parsed.references.join(" ")
          : parsed.references || "",
        subject: parsed.subject || "",
        from: parsed.from?.text || "",
        to: parsed.to
          ? Array.isArray(parsed.to)
            ? parsed.to.map((a) => a.text).join(", ")
            : parsed.to.text
          : "",
        cc: parsed.cc
          ? Array.isArray(parsed.cc)
            ? parsed.cc.map((a) => a.text).join(", ")
            : parsed.cc.text
          : "",
        date: parsed.date?.toISOString() || "",
        text: parsed.text || "",
        html: parsed.html || "",
        attachments,
      };
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}