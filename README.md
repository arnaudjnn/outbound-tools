<img width="495" height="187" alt="Frame 6" src="https://github.com/user-attachments/assets/84f958cc-5d83-479f-a5d3-a7ba447e7be2" />

# Outbound Tools

Open-source MCP server for email outreach campaigns. Create multi-step sequences with A/B variants, auto-classify replies with AI, and track conversion rates — all powered by IMAP keywords with zero external database.

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

## Outbound Playbook

### Step 1 — Build your audience

Enroll contacts into audience segments. Segments are stored as IMAP keywords (`audience_{name}`) directly on emails, so there's no external database.

```
add_to_audience({ email: "john@acme.com", segments: ["q1_launch"] })
add_to_audience({ email: "jane@corp.io",  segments: ["q1_launch"] })
```

You can list all segments and their contacts at any time:

```
list_audiences()
→ { segments: [{ name: "q1_launch", count: 2, contacts: ["john@acme.com", "jane@corp.io"] }] }
```

### Step 2 — Create a campaign

A campaign links an audience segment to a multi-step email sequence with A/B variants. When the campaign runs, it pulls contacts from the audience automatically.

```
create_campaign({
  email: "me@mycompany.com",
  name: "q1_launch",
  audience_segment: "q1_launch",
  sequence: [
    {
      step: 1, delay_days: 0,
      variants: [
        { name: "a", weight: 50, subject: "Quick question", text: "Hi, I saw your company is..." },
        { name: "b", weight: 50, subject: "Partnership idea", text: "Hey, we help companies like yours..." }
      ]
    },
    {
      step: 2, delay_days: 3,
      variants: [
        { name: "a", weight: 100, subject: "", text: "Just following up on my last email..." }
      ]
    },
    {
      step: 3, delay_days: 5,
      variants: [
        { name: "a", weight: 100, subject: "", text: "Last try — would love 15 min to show you..." }
      ]
    }
  ]
})
```

**How sequences work:**
- **Steps** execute in order. `delay_days` is the number of days to wait after the previous step before sending.
- **Variants** enable A/B testing. Each variant has a `weight` — with two variants at `weight: 50`, each gets ~50% of contacts. Use `weight: 100` for a single variant (no split).
- **Template variables** — `{{email}}` is replaced with the contact's email address.
- **Empty subject on step 2+** means "reply in the same thread" — the email is sent as a reply to the step 1 email with proper `In-Reply-To` and `References` headers, so it threads correctly in the recipient's inbox.
- **Audience-driven** — the campaign doesn't store contacts. It reads them from the audience segment at runtime, so adding/removing contacts from the segment updates who gets sent to.

The campaign config is stored as an IMAP draft on the sender account — no external storage.

### Step 3 — Run the campaign

```
start_campaign({ email: "me@mycompany.com", campaign: "q1_launch" })
```

Each call to `start_campaign` processes every contact and determines what to do:

| Contact state | Action |
|---|---|
| Never sent to | Send step 1 |
| Received step 1, 3+ days ago | Send step 2 |
| Received step 2, 5+ days ago | Send step 3 |
| Received step 2, only 2 days ago | Skip — delay not elapsed |
| Completed all steps | Skip |
| Replied with `do_not_contact`, `unsubscribed`, `bounced`, `not_interested`, or `wrong_person` | Skip — terminal status |

**Scheduling:** `start_campaign` is idempotent — call it as often as you want. Set up a daily cron (via Railway cron, a scheduler, or the Claude Code `/schedule` command) to call it automatically. Each run only sends what's due.

Every sent email is automatically tagged with:
- `campaign_{name}` — marks it as part of this campaign
- `step_{n}` — which step was sent
- `variant_{name}` — which A/B variant was used

### Step 4 — Auto-classify replies

Replies need to be classified so `start_campaign` knows when to stop sending (terminal statuses) and so you can measure conversion.

**Option A: Automatic (recommended)**

Set `ANTHROPIC_API_KEY` as an environment variable. The server exposes `GET /api/classify` which uses Claude Haiku to classify every unprocessed reply. Schedule it daily alongside `start_campaign`.

How it works:
1. Calls `list_threads` to match incoming replies to sent emails by subject and sender
2. Sends each reply to Claude Haiku for classification into one of 9 statuses
3. Tags both the reply (INBOX) and the original sent email (SENT) with the status + `classified`
4. Next time `start_campaign` runs, it sees the tagged status and skips contacts with terminal statuses

**Option B: Manual / agent-driven**

Run the `/classify-replies` skill in Claude Code. The agent reads each reply, classifies it, and calls `set_reply_status` to tag the emails.

**Option C: Per-reply**

Call `set_reply_status` directly for individual replies:

```
set_reply_status({ email: "me@mycompany.com", uid: 42, status: "meeting_request", sent_uid: 15 })
```

This tags both the reply and the matching sent email, removing any previous status first (only one status per reply).

### Step 5 — Measure results

```
get_campaign_analytics({ email: "me@mycompany.com", campaign: "q1_launch" })
```

Returns:

```json
{
  "campaign": "q1_launch",
  "totalSent": 6,
  "uniqueContacts": 2,
  "totalReplied": 2,
  "replyRate": 33.33,
  "statuses": { "interested": 1, "meeting_request": 1 },
  "statusRates": { "interested": 16.67, "meeting_request": 16.67 },
  "steps": {
    "step_1": { "sent": 2, "variants": { "variant_a": 1, "variant_b": 1 } },
    "step_2": { "sent": 2, "variants": { "variant_a": 2 } },
    "step_3": { "sent": 2, "variants": { "variant_a": 2 } }
  },
  "variants": {
    "variant_a": { "sent": 5, "interested": 1 },
    "variant_b": { "sent": 1, "meeting_request": 1 }
  }
}
```

**Key metrics:**
- **Reply rate** — % of sent emails that got a classified reply
- **Positive reply rate** — `interested` + `meeting_request` + `information_request` as % of sent
- **Conversion rate** — `meeting_request` as % of sent (meetings booked)
- **Per-step performance** — see which step generates the most replies
- **A/B comparison** — compare variants by reply count and status breakdown to pick the winner

For per-account analytics (across all campaigns):

```
get_email_account_analytics({ email: "me@mycompany.com" })
```

## How It Works

Outbound Tools uses **IMAP keywords** as a native tagging and classification layer, directly on the email account itself. No external database, no third-party analytics platform, no syncing pipelines.

- **Zero infrastructure.** Tags like `interested`, `bounced`, `do_not_contact` are stored as IMAP keywords on each message. Campaign configs are stored as IMAP drafts. The mailbox *is* the database.
- **Instant querying.** IMAP SEARCH natively supports keyword filtering. Fetching all positive replies or computing bounce rates is a single IMAP command, not a full-table scan.
- **Portable and durable.** Tags live on the mail server. Switch clients, migrate tools, or read from any IMAP client. Your classification data follows the emails.
- **No state to manage.** The `classified` keyword makes processing incremental. Each run only touches new emails, then marks them done. No cursor, no offset table, no checkpoint file.
- **Works at scale.** Each account is independent. Add 10 or 1,000 mailboxes and the architecture stays the same. IMAP handles the storage and indexing.

### Reply Statuses

The classifier assigns exactly one status per reply. Use `list_reply_statuses` to see all available statuses.

| Status | Meaning | Terminal? |
|---|---|---|
| `interested` | Positive — shows interest, wants to learn more | No |
| `meeting_request` | Explicitly asked for or accepted a meeting | No |
| `information_request` | Asked for more details, pricing, or documentation | No |
| `not_interested` | Polite decline, not a fit right now | Yes |
| `wrong_person` | Not the right contact, may have referred someone else | Yes |
| `do_not_contact` | Hard stop — hostile, legal, or compliance concern | Yes |
| `out_of_office` | Auto-reply or out-of-office response | No |
| `unsubscribed` | Asked to stop receiving emails | Yes |
| `bounced` | Delivery failure or bounce notification | Yes |

"Terminal" means `start_campaign` will stop sending follow-ups to that contact.

### Tag Filter Syntax

`list_sent_emails` and `list_received_emails` accept a `tag_filter` parameter with boolean expressions:

```
interested                              -- has tag
meeting_request OR interested           -- high-intent replies
NOT classified                          -- unprocessed emails
do_not_contact OR unsubscribed          -- hard stops
campaign_q1_launch AND step_1           -- first step of a campaign
(interested OR meeting_request) AND classified  -- combine with parentheses
```

## Available Tools

### Campaigns

| Tool | Description |
|---|---|
| `create_campaign` | Define a campaign with audience segment and multi-step sequence with A/B variants |
| `start_campaign` | Execute the campaign — sends next pending steps, respects delays and terminal statuses |
| `get_campaign` | Get the full campaign config |
| `list_campaigns` | List all campaigns on an account |
| `delete_campaign` | Delete a campaign config |
| `get_campaign_analytics` | Full report: reply rate, status breakdown, per-step + per-variant A/B performance |

### Email Accounts & Analytics

| Tool | Description |
|---|---|
| `list_email_accounts` | List all registered mailboxes with status and domain info |
| `get_email_account_analytics` | Per-account analytics: sent, replied, reply rate, status breakdown |

### Sending & Replying

| Tool | Description |
|---|---|
| `send_email` | Send an email via SMTP. Auto-saves to Sent folder |
| `reply_to_email` | Reply in-thread with proper threading headers |
| `reply_all_to_email` | Reply-all (original To + CC minus yourself) |
| `forward_email` | Forward with quoted body and original attachments |

### Reading Emails

| Tool | Description |
|---|---|
| `list_received_emails` | Paginated inbox emails with `tag_filter` support |
| `list_sent_emails` | Paginated sent emails with `tag_filter` support |
| `get_email` | Single email by UID — full body, attachments, headers |
| `get_email_raw` | Raw RFC822 source |
| `delete_email` | Delete by UID |
| `get_attachment` | Download attachment (base64) by index |

### Threads

| Tool | Description |
|---|---|
| `list_threads` | Match received replies to sent emails by subject + sender |
| `get_thread` | Get all messages in a conversation thread by subject |

### Drafts

| Tool | Description |
|---|---|
| `list_drafts` | Paginated draft listing |
| `get_draft` | Single draft by UID |
| `create_draft` | Compose and save without sending |
| `update_draft` | Replace draft content |
| `delete_draft` | Delete a draft |
| `send_draft` | Send a draft, move to Sent, remove from Drafts |

### Tagging

| Tool | Description |
|---|---|
| `add_email_tag` | Add an IMAP keyword to a message |
| `remove_email_tag` | Remove an IMAP keyword from a message |

### Reply Statuses

| Tool | Description |
|---|---|
| `list_reply_statuses` | List available reply classification statuses |
| `set_reply_status` | Set reply status on received + sent email (one status at a time) |

### Audiences

| Tool | Description |
|---|---|
| `add_to_audience` | Add a contact to audience segments |
| `remove_from_audience` | Remove a contact from segments |
| `list_audiences` | List all segments with contacts |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MAILPOOL_API_KEY` | Yes | Your Mailpool API key for email account access |
| `API_KEY` | Yes | Secures the MCP server and `/api/classify` endpoint. Auto-generated on Railway via `${{secret()}}`. Pass as `Authorization: Bearer <key>` header or `?api_key=<key>` query param. |
| `ANTHROPIC_API_KEY` | No | Enables auto-classification via `GET /api/classify`. Only needed if you want the server to classify replies automatically. Without it, use the `/classify-replies` agent skill instead. |
