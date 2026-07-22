# outbound-tools — agent orientation

Open-source MCP server for email outreach campaigns: multi-step sequences with A/B variants, AI reply-classification, and conversion tracking — all backed by IMAP keywords, no external database. See `README.md` for the full tool list and outbound playbook, and `RAILWAY.md` for deploy details.

## Layout (pnpm workspaces)

```
packages/
├── api/       Express + MCP server — the deployable (Railway, via root Dockerfile)
├── toolkit/   Shared library — IMAP/SMTP ops, Mailpool client, zod schemas,
│              tool definitions + functionMap; consumed by api & cli
└── cli/       Commander.js CLI — wraps the same toolkit functions (not deployed)
```

`packages/toolkit` holds all business logic; `api` and `cli` are thin adapters that consume it via `workspace:*`. Build order matters: toolkit compiles first so its `dist/` declarations exist before the consumers typecheck (`pnpm build` handles this).

## Build & deploy

- `pnpm build` — builds toolkit → api → cli (in order).
- `pnpm -r run typecheck` — typecheck all packages.
- Deploy: the root `Dockerfile` (multi-stage) builds toolkit + api and runs `node packages/api/dist/index.js` on Railway. The CLI is intentionally excluded from the image.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `MAILPOOL_API_KEY` | yes | Mailpool access for email accounts |
| `API_KEY` | yes | Secures the MCP server + `/api/v0/classify` (Bearer or `?api_key=`) |
| `ANTHROPIC_API_KEY` | no | Enables auto-classification via `POST /api/v0/classify` |

## Skills

The one repo skill, `classify-replies` (manual reply-classification workflow), is a native skill — a real directory under `.claude/skills/`. There are no CLI-managed (`.agents/skills/`) skills here.
