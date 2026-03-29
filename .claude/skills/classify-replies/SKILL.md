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

## Instructions

1. Call `list_email_accounts` to get all active accounts.
2. For each account, call `list_threads` with the account email.
3. If `totalChecked` is 0, skip to the next account.
4. For each match in `matches`:
   - Classify the reply into exactly one status from the table above (excluding `classified`).
   - Call `set_reply_status` with the **received email** UID, the chosen status, and optionally the `sent_uid` (= `sentUid` from the match) so both emails get tagged.
5. For each UID in `unmatchedUids`, tag it with `classified` in INBOX using `add_email_tag`.
6. Print a summary per account: total processed, count per status.

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
