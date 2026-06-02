# Classify Replies

Classify received emails and tag both the reply and the original sent email.

## Statuses

| Tag | Meaning |
|---|---|
| `classified` | Processed by classifier (prevents re-processing) |
| `interested` | Positive — shows interest, wants to learn more |
| `meeting_request` | Explicitly asked for or accepted a meeting |
| `information_request` | Asked for more details, pricing, or documentation |
| `not_interested` | Polite decline, not a fit right now |
| `wrong_person` | Not the right contact, may have referred someone else |
| `do_not_contact` | Hard stop — hostile, legal, or compliance concern |
| `out_of_office` | Auto-reply / out-of-office response |
| `unsubscribed` | Asked to stop receiving emails |
| `bounced` | Delivery failure / bounce notification |

This is the manual classification path — you (the model) read each reply and
choose its status. It does **not** require `ANTHROPIC_API_KEY` (that key only
powers the automated `POST /api/v0/classify` endpoint).

## Instructions

1. Call `list_email_accounts` to get all active accounts.
2. For each account:
   a. Call `list_received_emails` with `tag_filter: "NOT classified"` to get the
      unprocessed replies (these include `uid`, `subject`, and `preview`).
      If none, skip to the next account.
   b. Call `list_threads` with `{ email, includeMessages: true }` to get the
      account's conversation threads. Build a reply→sent UID map: for each
      thread, find a message whose `folder` is **not** `INBOX` (the sent
      original) and pair its `uid` with every `INBOX` message's `uid` in that
      same thread. A thread with no sent message yields no pairing.
3. For each unclassified reply, using its `subject` + `preview`:
   - Classify it into exactly one status from the table above (excluding `classified`).
   - Call `set_reply_status` with the reply's `uid`, the chosen status, and —
     if the reply's `uid` is in the map — the paired `sent_uid` so both the
     reply and its original sent email get tagged.
   - If no status clearly applies, just tag the reply `classified` in INBOX
     via `add_email_tag` so it is not reprocessed.
4. Print a summary per account: total processed, count per status.

> Note: `list_threads` returns thread summaries (`threadId`, `subject`,
> `participants`, …) and, with `includeMessages: true`, a `messages` array per
> thread (`uid`, `folder`, `from`, `to`, `date`, `flags`). It no longer returns
> `matches`/`unmatchedUids` — pairing is derived from the thread's messages.

## Tag Filter

Use `tag_filter` on `list_received_emails` or `list_sent_emails` to query:

```
interested                              -- positive replies
meeting_request OR interested           -- high-intent replies
NOT classified                          -- unprocessed emails
classified AND NOT interested           -- classified but not positive
do_not_contact OR unsubscribed          -- hard stops
wrong_person                            -- misrouted contacts
```
