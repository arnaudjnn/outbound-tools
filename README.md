# Outbound Tools

MCP server for managing email outreach. Connects to Mailpool for mailbox management and uses IMAP/SMTP for sending and reading emails.

## Available Tools

### `list_email_accounts`
List all registered email mailboxes with their status and domain info.

### `send_email`
Send an email via SMTP from a registered mailbox. Supports plain text, HTML, CC, and BCC. A copy is automatically saved to the Sent folder via IMAP.

### `list_sent_emails`
Fetch sent emails from a mailbox's Sent folder via IMAP. Supports `limit` (default 50), `page` (default 1, most recent first), and `tag_filter`.

### `list_received_emails`
Fetch received emails from a mailbox's INBOX via IMAP. Supports `limit` (default 50), `page` (default 1, most recent first), and `tag_filter`.

### Tag Filter Syntax

Both `list_sent_emails` and `list_received_emails` accept a `tag_filter` parameter with boolean expressions:

```
interested                                  -- has tag
classified AND interested                   -- has both
NOT classified                              -- does not have tag
complained OR unsubscribed                  -- either tag
```

### Tags

The classify-replies skill uses these IMAP keyword tags:

| Tag | Meaning |
|---|---|
| `classified` | Email has been processed by the classifier |
| `interested` | Positive reply — shows interest, agrees to meeting |
| `complained` | Recipient complained about being contacted |
| `out_of_office` | Auto-reply / out-of-office response |
| `unsubscribed` | Asked to stop receiving emails |
| `bounced` | Delivery failure / bounce notification |

### `find_reply_threads`
Find received emails that are replies to sent emails. Matches by normalized subject and sender/recipient overlap. Returns matched pairs (with both sent and received email details) and unmatched UIDs. Filters to unclassified emails by default.

### `add_email_tag`
Add an IMAP keyword to a message. Parameters: `email` (account), `uid` (message UID), `tag` (keyword), `folder` (INBOX or SENT, default INBOX).

### `remove_email_tag`
Remove an IMAP keyword from a message. Parameters: `email` (account), `uid` (message UID), `tag` (keyword), `folder` (INBOX or SENT, default INBOX).
