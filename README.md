<img width="495" height="187" alt="Frame 6" src="https://github.com/user-attachments/assets/84f958cc-5d83-479f-a5d3-a7ba447e7be2" />

# Outbound Tools

MCP server for managing email outreach. Connects to Mailpool for mailbox management and uses IMAP/SMTP for sending and reading emails.

## Get Started

1. Get a `MAILPOOL_API_KEY` from [Mailpool](https://mailpool.io) and connect at least one email account
2. Deploy to Railway:

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/outbound-tools?utm_medium=integration&utm_source=template&utm_campaign=generic)

3. Copy your Railway public URL and add it as an MCP server in your `.claude.json`:

```json
{
  "mcpServers": {
    "outbound-tools": {
      "url": "https://your-app.up.railway.app/mcp",
      "headers": {
        "Authorization": "Bearer your-api-key"
      }
    }
  }
}
```

## How It Works

Outbound Tools uses **IMAP keywords** as a native tagging and classification layer, directly on the email account itself. No external database, no third-party analytics platform, no syncing pipelines.

**Why this matters:**

- **Zero infrastructure.** Tags like `interested`, `bounced`, `do_not_contact` are stored as IMAP keywords on each message. The mailbox *is* the database.
- **Instant querying.** IMAP SEARCH natively supports keyword filtering. Fetching all positive replies or computing bounce rates is a single IMAP command, not a full-table scan.
- **Portable and durable.** Tags live on the mail server. Switch clients, migrate tools, or read from any IMAP client. Your classification data follows the emails.
- **No state to manage.** The `classified` keyword makes processing incremental. Each run only touches new emails, then marks them done. No cursor, no offset table, no checkpoint file.
- **Works at scale.** Each account is independent. Add 10 or 1,000 mailboxes and the architecture stays the same. IMAP handles the storage and indexing.

### Auto-Classification

If `ANTHROPIC_API_KEY` is set as an environment variable, the server exposes a `GET /api/classify` endpoint that automatically classifies replies using Claude Haiku. Set up a Railway cron or external scheduler to hit it periodically (e.g., daily).

If `ANTHROPIC_API_KEY` is not set, the endpoint returns 501 and you can classify manually using the `/classify-replies` agent skill.

Classification uses `list_threads` to deterministically match replies to sent emails by subject and sender, then Claude classifies the sentiment. Both the reply and the original sent email get tagged, so you can query from either side.

### Reply Statuses

Reply statuses are IMAP keywords stored directly on each email message. The classifier assigns exactly one status tag per reply, plus `classified` to mark it as processed. Use `set_reply_status` to set statuses manually, or `list_reply_statuses` to see all available statuses.

| Tag | Meaning |
|---|---|
| `classified` | Email has been processed by the classifier |
| `interested` | Positive — shows interest, wants to learn more |
| `meeting_request` | Explicitly asked for or accepted a meeting |
| `information_request` | Asked for more details, pricing, or documentation |
| `not_interested` | Polite decline, not a fit right now |
| `wrong_person` | Not the right contact, may have referred someone else |
| `do_not_contact` | Hard stop — hostile, legal, or compliance concern |
| `out_of_office` | Auto-reply or out-of-office response |
| `unsubscribed` | Asked to stop receiving emails |
| `bounced` | Delivery failure or bounce notification |

### Campaign Tags

Campaigns use IMAP keywords for zero-storage tracking. When using `send_campaign_step`, emails are automatically tagged:

| Tag pattern | Example | Meaning |
|---|---|---|
| `campaign_{name}` | `campaign_q1_launch` | Email belongs to this campaign |
| `step_{n}` | `step_1` | Which sequence step was sent |
| `variant_{name}` | `variant_a` | Which A/B variant was used |

### Tag Filter Syntax

Both `list_sent_emails` and `list_received_emails` accept a `tag_filter` parameter with boolean expressions:

```
interested                              -- has tag
meeting_request OR interested           -- high-intent replies
NOT classified                          -- unprocessed emails
do_not_contact OR unsubscribed          -- hard stops
campaign_q1_launch AND step_1           -- first step of a campaign
(interested OR meeting_request) AND classified  -- combine with parentheses
```

## Available Tools

### Email Accounts

#### `list_email_accounts`
List all registered email mailboxes with their status and domain info.

### Sending & Replying

#### `send_email`
Send an email via SMTP from a registered mailbox. Supports plain text, HTML, CC, and BCC. A copy is automatically saved to the Sent folder via IMAP.

#### `reply_to_email`
Reply to an email in-thread. Automatically sets `In-Reply-To` and `References` headers for proper threading. Parameters: `email` (account), `uid` (message to reply to), `folder`, `text`/`html`.

#### `reply_all_to_email`
Reply-all to an email. Replies to the original sender and CCs all other recipients (minus yourself). Same threading headers as `reply_to_email`.

#### `forward_email`
Forward an email to new recipients. Includes the original body (quoted) and re-attaches all original attachments. Parameters: `email` (account), `uid`, `folder`, `to` (recipients), optional `text`/`html`.

### Reading Emails

#### `list_received_emails`
Fetch received emails from a mailbox's INBOX via IMAP. Supports `limit` (default 50), `page` (default 1, most recent first), and `tag_filter`.

#### `list_sent_emails`
Fetch sent emails from a mailbox's Sent folder via IMAP. Supports `limit` (default 50), `page` (default 1, most recent first), and `tag_filter`.

#### `get_email`
Fetch a single email by UID with full body (text + HTML), attachment metadata, and message headers (Message-ID, In-Reply-To, References). Parameters: `email` (account), `uid`, `folder` (INBOX or SENT).

#### `get_email_raw`
Fetch the raw RFC822 source of an email. Parameters: `email` (account), `uid`, `folder`.

#### `delete_email`
Delete an email by UID. Parameters: `email` (account), `uid`, `folder`.

#### `get_attachment`
Download an attachment from an email. Returns base64-encoded content. Parameters: `email` (account), `uid`, `index` (0-based, from `get_email` attachments list), `folder`.

### Threads

#### `list_threads`
Find received emails that are replies to sent emails. Matches by normalized subject and sender/recipient overlap. Returns matched pairs (with both sent and received email details) and unmatched UIDs. Filters to unclassified emails by default.

#### `get_thread`
Get all messages in a conversation thread by subject, across both INBOX and Sent. Groups by normalized subject (strips Re:/Fwd: prefixes). Returns messages sorted chronologically with sender list. Parameters: `email` (account), `subject`, `limit`.

### Drafts

#### `list_drafts`
List drafts from the Drafts folder. Supports `limit` (default 50) and `page` (default 1, most recent first).

#### `get_draft`
Fetch a single draft by UID with full body and attachment metadata.

#### `create_draft`
Compose and save a draft to the Drafts folder without sending. Parameters: `email` (account), `to`, `subject`, `text`/`html`, `cc`, `bcc`.

#### `update_draft`
Replace an existing draft with new content. IMAP doesn't support in-place edits, so this deletes the old draft and saves a new one. Parameters: `email` (account), `uid` (existing draft), `to`, `subject`, `text`/`html`, `cc`, `bcc`.

#### `delete_draft`
Delete a draft by UID from the Drafts folder.

#### `send_draft`
Send an existing draft. Sends via SMTP, copies to Sent folder, and removes from Drafts. Parameters: `email` (account), `uid`.

### Tagging

#### `add_email_tag`
Add an IMAP keyword to a message. Parameters: `email` (account), `uid` (message UID), `tag` (keyword), `folder` (INBOX or SENT, default INBOX).

#### `remove_email_tag`
Remove an IMAP keyword from a message. Parameters: `email` (account), `uid` (message UID), `tag` (keyword), `folder` (INBOX or SENT, default INBOX).

### Audiences

#### `add_to_audience`
Add a contact to one or more audience segments. Searches all mailbox accounts for messages from/to that contact and tags them. Parameters: `email` (contact email), `segments` (array, default `["general"]`). Stores segments as `audience_` prefixed IMAP keywords.

#### `remove_from_audience`
Remove a contact from one or more audience segments. Parameters: `email` (contact email), `segments` (array). Removes tags across all mailbox accounts.

#### `list_audiences`
List all audience segments with contacts. Scans all mailbox accounts and returns unique contacts per segment. Returns `{ segments: [{ name, count, contacts }] }`.

### Reply Statuses

#### `list_reply_statuses`
Returns all available reply classification statuses with descriptions.

#### `set_reply_status`
Set a reply's status (e.g. `interested`, `meeting_request`). Tags both the received reply and the matching sent email. Removes any previous status tag first (ensures one status at a time). Parameters: `email` (account), `uid` (reply in INBOX), `status`, `sent_uid` (optional, matching sent email).

### Campaigns

#### `send_campaign_step`
Bulk send a campaign step to contacts with A/B variant support. Each email is tagged with `campaign_{name}`, `step_{n}`, and `variant_{name}`. Supports `{{firstName}}`, `{{lastName}}`, `{{email}}`, `{{company}}` template variables. Step 2+ with empty subject replies in the original thread. Skips contacts who already received the step. Parameters: `email` (account), `campaign`, `step`, `audience_segment`, `variants` (with name/weight/subject/body), `contacts`.

#### `campaign_analytics`
Full campaign report: total sent, unique contacts, reply rate, status breakdown (interested, meeting_request, etc.), per-step performance, per-variant A/B comparison. Parameters: `email` (account), `campaign` (name).

### Analytics

#### `email_account_analytics`
Per-account analytics: total sent, total replied, reply rate, and breakdown by all reply statuses with rates.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MAILPOOL_API_KEY` | Yes | Your Mailpool API key for email account access |
| `API_KEY` | Yes | Secures the MCP server and `/api/classify` endpoint. Auto-generated on Railway via `${{secret()}}`. Pass as `Authorization: Bearer <key>` header or `?api_key=<key>` query param. |
| `ANTHROPIC_API_KEY` | No | Enables auto-classification via `GET /api/classify`. Only needed if you want the server to classify replies automatically. Without it, use the `/classify-replies` agent skill instead. |
