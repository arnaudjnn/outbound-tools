# Airbyte source — Outbound Tools

A low-code (declarative) Airbyte source that syncs the read-only REST endpoints
of an Outbound Tools server (`POST /api/v0/{tool}`).

## Config

| Field | Required | Description |
|---|---|---|
| `api_url` | yes | Bare server URL (no path, no trailing slash), e.g. `https://your-app.up.railway.app`. The `/api/v0` prefix is added automatically |
| `api_key` | yes | The server's `API_KEY`, sent as `Authorization: Bearer <key>` |

## Streams

| Stream | Endpoint | Pagination |
|---|---|---|
| `accounts` | `list_email_accounts` | — (parent stream) |
| `threads` | `list_threads` | `page`/`limit` (threads per page) |
| `received_emails` | `list_received_emails` | `page`/`limit` |
| `sent_emails` | `list_sent_emails` | `page`/`limit` |
| `drafts` | `list_drafts` | `page`/`limit` |
| `account_analytics` | `get_email_account_analytics` | — |
| `campaigns` | `list_campaigns` | — |
| `audiences` | `list_audiences` | — |
| `reply_statuses` | `list_reply_statuses` | — |

**`threads` is the primary stream.** It is a `SubstreamPartitionRouter` child of
`accounts`: one sync calls `list_email_accounts`, then runs `list_threads` for
every account and paginates each — so a single sync yields **every conversation
thread of every mailbox**, with each record stamped with its `account`. (This is
why there is no separate "all accounts" endpoint — the substream covers it.)

Item-lookup endpoints that need a specific `uid`/`subject`/`campaign`
(`get_email`, `get_email_raw`, `get_thread`, `get_attachment`, `get_draft`,
`get_campaign`, `get_campaign_analytics`) are **not** streams — they are point
reads, not bulk collections. `threads` already returns full messages inline
(`includeMessages: true`).

## Tuning

Defaults live in `source-manifest.yml`:
- **Page size: `100`** for all paginated streams (the `page_paginator` definition,
  injected into the JSON body as `limit`). Pagination stops when a page returns
  fewer records than the page size.
- **Thread scan depth: `scanLimit: 500`** per folder, `folders: ["INBOX", "SENT"]`
  (the `threads` stream's `request_body_json`). `scanLimit` caps how many recent
  messages are grouped into threads; `page`/`limit` then paginate the resulting
  threads.

## Use

Load `source-manifest.yml` in the Airbyte Connector Builder (Import YAML), or run
it with the Airbyte CDK:

```bash
pip install airbyte-cdk
# from a connector dir containing this manifest + secrets/config.json
python -m airbyte_cdk.cli.source_declarative_manifest spec
```
