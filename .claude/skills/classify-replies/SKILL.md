# Classify Replies

Classify received emails and tag both the reply and the original sent email.

## Tags

| Tag | Meaning |
|---|---|
| `classified` | Processed by classifier (prevents re-processing) |
| `interested` | Positive — shows interest, wants a meeting, asks for more info |
| `complained` | Complained about being contacted |
| `out_of_office` | Auto-reply / out-of-office response |
| `unsubscribed` | Asked to stop receiving emails |
| `bounced` | Delivery failure / bounce notification |

## Instructions

1. Call `list_email_accounts` to get all active accounts.
2. For each account, call `find_reply_threads` with the account email.
3. If `totalChecked` is 0, skip to the next account.
4. For each match in `matches`:
   - Classify the reply into exactly one category: `interested`, `complained`, `out_of_office`, `unsubscribed`, `bounced`, or none.
   - If a category applies, call `add_email_tag` on the **received email** (UID = `receivedUid`, folder = `INBOX`) with that tag.
   - Also call `add_email_tag` on the **original sent email** (UID = `sentUid`, folder = `SENT`) with the same tag.
   - Then tag both emails with `classified`.
5. For each UID in `unmatchedUids`, tag it with `classified` in INBOX.
6. Print a summary per account: total processed, count per category.

## Tag Filter

Use `tag_filter` on `list_received_emails` or `list_sent_emails` to query:

```
interested                        -- positive replies
NOT classified                    -- unprocessed emails
classified AND NOT interested     -- classified but not positive
complained OR unsubscribed        -- problematic replies
```
