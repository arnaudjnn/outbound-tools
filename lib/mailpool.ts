export interface DomainOwner {
  id: number;
  company: string;
  firstName: string;
  lastName: string;
  email: string;
  streetAddress1: string;
  streetAddress2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface Domain {
  id: number;
  createdAt: string;
  expireAt: string;
  domain: string;
  domainOwner: DomainOwner;
  redirectUrl: string;
  type: string;
  status: string;
}

/** Lightweight mailbox info returned by the list endpoint. */
export interface Mailbox {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  domain: Domain;
}

/** Full mailbox details returned by the single-mailbox endpoint, includes IMAP/SMTP credentials. */
export interface MailboxDetails extends Mailbox {
  signature: string;
  forwardTo: string;
  password: string;
  avatar: string;
  imapHost: string;
  imapPort: number;
  imapTLS: boolean;
  imapUsername: string;
  imapPassword: string;
  smtpHost: string;
  smtpPort: number;
  smtpTLS: boolean;
  smtpUsername: string;
  smtpPassword: string;
  type: string;
  isAdmin: boolean;
}

const API_BASE = "https://app.mailpool.io/v1/api";

function getHeaders(): Record<string, string> {
  const apiKey = process.env.MAILPOOL_API_KEY;
  if (!apiKey) throw new Error("MAILPOOL_API_KEY is not set");
  return {
    "X-Api-Authorization": apiKey,
    Accept: "application/json",
  };
}

export async function listMailboxes(): Promise<Mailbox[]> {
  const res = await fetch(`${API_BASE}/mailboxes?limit=50&offset=0`, {
    headers: getHeaders(),
  });
  if (!res.ok) {
    throw new Error(`Mailpool API error: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  return json.data;
}

export async function getMailboxById(id: number): Promise<MailboxDetails> {
  const res = await fetch(`${API_BASE}/mailboxes/${id}`, {
    headers: getHeaders(),
  });
  if (!res.ok) {
    throw new Error(`Mailpool API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function getMailboxByEmail(
  email: string
): Promise<MailboxDetails> {
  const mailboxes = await listMailboxes();
  const mailbox = mailboxes.find(
    (m) => m.email.toLowerCase() === email.toLowerCase()
  );
  if (!mailbox) {
    throw new Error(`Mailbox not found for email: ${email}`);
  }
  return getMailboxById(mailbox.id);
}