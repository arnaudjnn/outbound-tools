export interface Mailbox {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  domain: { domain: string };
  password: string;
  imapHost: string;
  imapPort: number;
  imapUsername: string;
  imapPassword: string;
  type?: string;
}

// TODO: Switch to API key auth when Mailpool support confirms the correct format.
// The official docs say:
//   GET https://app.mailpool.io/v1/api/mailboxes
//   Header: X-Api-Authorization: <numeric_api_key>
// Our API key (MAILPOOL_API_KEY) is a UUID which returns 400 "numeric string expected".
// For now, we use session-based auth (Bearer token + cookie) via the .ai domain.

// --- Future API key auth ---
// const API_BASE = "https://app.mailpool.io/v1/api";
//
// function getHeaders(): Record<string, string> {
//   const apiKey = process.env.MAILPOOL_API_KEY;
//   if (!apiKey) throw new Error("MAILPOOL_API_KEY is not set");
//   return {
//     "X-Api-Authorization": apiKey,
//     Accept: "application/json",
//   };
// }

// --- Current session-based auth ---
const API_BASE = "https://app.mailpool.ai/v1";

function getHeaders(): Record<string, string> {
  const token = process.env.MAILPOOL_TOKEN;
  const cookie = process.env.MAILPOOL_COOKIE;
  if (!token && !cookie) {
    throw new Error("MAILPOOL_TOKEN or MAILPOOL_COOKIE must be set");
  }

  const headers: Record<string, string> = {
    "x-workspaceid": process.env.MAILPOOL_WORKSPACE_ID || "969",
    Accept: "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (cookie) {
    headers["Cookie"] = cookie;
  }

  return headers;
}

export async function listMailboxes(): Promise<Mailbox[]> {
  const res = await fetch(
    `${API_BASE}/mailboxes/by-domain/Private?limit=50&offset=0&search=`,
    { headers: getHeaders() }
  );
  if (!res.ok) {
    throw new Error(`Mailpool API error: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  return json.data;
}

export async function getMailboxByEmail(email: string): Promise<Mailbox> {
  const mailboxes = await listMailboxes();
  const mailbox = mailboxes.find(
    (m) => m.email.toLowerCase() === email.toLowerCase()
  );
  if (!mailbox) {
    throw new Error(`Mailbox not found for email: ${email}`);
  }
  return mailbox;
}
