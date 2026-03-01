# Deploy and Host Outbound Tools on Railway

Outbound Tools is a free and open-source alternative to Lemlist, Instantly, and Smartlead. It's a lightweight email operations server that exposes tools for sending, tagging, and managing outbound emails via IMAP/SMTP. It connects to your Mailpool email accounts and provides tools for campaign sending, reply classification, audience segmentation, and deliverability metrics.

## About Hosting Outbound Tools

Deploying Outbound Tools gives you a hosted server that connects to your Mailpool email accounts over IMAP/SMTP. Once deployed, AI agents can use the exposed tools to send emails, read inbox and sent folders, tag messages with IMAP keywords, manage audience segments, match reply threads to original outreach, and track bounce and complaint rates. All state lives directly in your mailboxes as IMAP keywords, so there is no external database to manage. You own your data and your infrastructure. You just need a Mailpool API key to get started.

## Common Use Cases

- Send cold email campaigns to audience segments with account rotation and deliverability safeguards
- Classify incoming replies by sentiment (interested, bounced, complained, out-of-office, unsubscribed)
- Track bounce rates, complaint rates, and interest rates across multiple sender accounts

## Dependencies for Outbound Tools Hosting

- Node.js 20+
- A Mailpool account with at least one connected email address

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MAILPOOL_API_KEY` | Yes | Your Mailpool API key from [mailpool.com](https://mailpool.com) |
| `API_KEY` | Yes | Secures the MCP endpoint. Auto-generated on Railway via `${{secret()}}` |
| `ANTHROPIC_API_KEY` | No | Enables automatic reply classification via `/api/classify`. Without it, replies are classified manually using the agent skill. |

### Deployment Dependencies

- [Mailpool](https://mailpool.com) for email account management and IMAP/SMTP credentials

## Why Deploy Outbound Tools on Railway?

Railway is a singular platform to deploy your infrastructure stack. Railway will host your infrastructure so you don't have to deal with configuration, while allowing you to vertically and horizontally scale it.

By deploying Outbound Tools on Railway, you are one step closer to supporting a complete full-stack application with minimal burden. Host your servers, databases, AI agents, and more on Railway.
