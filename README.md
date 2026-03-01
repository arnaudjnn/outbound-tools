# Outbound Tools

MCP server for managing email outreach. Connects to Mailpool for mailbox management and uses IMAP/SMTP for sending and reading emails.

## How It Works

Outbound Tools uses **IMAP keywords** as a native tagging and classification layer, directly on the email account itself. No external database, no third-party analytics platform, no syncing pipelines.

**Why this matters:**

- **Zero infrastructure.** Tags like `interested`, `bounced`, `complained` are stored as IMAP keywords on each message. The mailbox *is* the database.
- **Instant querying.** IMAP SEARCH natively supports keyword filtering. Fetching all positive replies or computing bounce rates is a single IMAP command, not a full-table scan.
- **Portable and durable.** Tags live on the mail server. Switch clients, migrate tools, or read from any IMAP client. Your classification data follows the emails.
- **No state to manage.** The `classified` keyword makes processing incremental. Each run only touches new emails, then marks them done. No cursor, no offset table, no checkpoint file.
- **Works at scale.** Each account is independent. Add 10 or 1,000 mailboxes and the architecture stays the same. IMAP handles the storage and indexing.

The classification itself runs as a Claude Code skill (`/classify-replies`), scheduled via GitHub Actions every 30 minutes. It uses `find_reply_threads` to deterministically match replies to sent emails by subject and sender, then Claude classifies the sentiment. Both the reply and the original sent email get tagged, so you can query from either side.

### Tags

Tags are IMAP keywords stored directly on each email message. The classifier assigns exactly one category tag per reply, plus `classified` to mark it as processed.

| Tag | Meaning |
|---|---|
| `classified` | Email has been processed by the classifier |
| `interested` | Positive reply: shows interest, agrees to meeting |
| `complained` | Recipient complained about being contacted |
| `out_of_office` | Auto-reply or out-of-office response |
| `unsubscribed` | Asked to stop receiving emails |
| `bounced` | Delivery failure or bounce notification |

### Tag Filter Syntax

Both `list_sent_emails` and `list_received_emails` accept a `tag_filter` parameter with boolean expressions:

```
interested                        -- has tag
classified AND interested         -- has both
NOT classified                    -- does not have tag
complained OR unsubscribed        -- either tag
(interested OR complained) AND classified  -- combine with parentheses
```

## Available Tools

### `list_email_accounts`
List all registered email mailboxes with their status and domain info.

### `send_email`
Send an email via SMTP from a registered mailbox. Supports plain text, HTML, CC, and BCC. A copy is automatically saved to the Sent folder via IMAP.

### `list_sent_emails`
Fetch sent emails from a mailbox's Sent folder via IMAP. Supports `limit` (default 50), `page` (default 1, most recent first), and `tag_filter`.

### `list_received_emails`
Fetch received emails from a mailbox's INBOX via IMAP. Supports `limit` (default 50), `page` (default 1, most recent first), and `tag_filter`.

### `find_reply_threads`
Find received emails that are replies to sent emails. Matches by normalized subject and sender/recipient overlap. Returns matched pairs (with both sent and received email details) and unmatched UIDs. Filters to unclassified emails by default.

### `add_email_tag`
Add an IMAP keyword to a message. Parameters: `email` (account), `uid` (message UID), `tag` (keyword), `folder` (INBOX or SENT, default INBOX).

### `remove_email_tag`
Remove an IMAP keyword from a message. Parameters: `email` (account), `uid` (message UID), `tag` (keyword), `folder` (INBOX or SENT, default INBOX).

### `list_metrics`
Get bounce, complain, and interest rates for an email account. Counts tagged sent emails via IMAP SEARCH and returns rates as percentages of total sent.