const API_BASE = "https://app.mailpool.io/v1/api";
function getHeaders() {
    const apiKey = process.env.MAILPOOL_API_KEY;
    if (!apiKey)
        throw new Error("MAILPOOL_API_KEY is not set");
    return {
        "X-Api-Authorization": apiKey,
        Accept: "application/json",
    };
}
export async function listMailboxes() {
    const res = await fetch(`${API_BASE}/mailboxes?limit=50&offset=0`, {
        headers: getHeaders(),
    });
    if (!res.ok) {
        throw new Error(`Mailpool API error: ${res.status} ${res.statusText}`);
    }
    const json = await res.json();
    return json.data;
}
export async function getMailboxById(id) {
    const res = await fetch(`${API_BASE}/mailboxes/${id}`, {
        headers: getHeaders(),
    });
    if (!res.ok) {
        throw new Error(`Mailpool API error: ${res.status} ${res.statusText}`);
    }
    return res.json();
}
export async function getMailboxByEmail(email) {
    const mailboxes = await listMailboxes();
    const mailbox = mailboxes.find((m) => m.email.toLowerCase() === email.toLowerCase());
    if (!mailbox) {
        throw new Error(`Mailbox not found for email: ${email}`);
    }
    return getMailboxById(mailbox.id);
}
