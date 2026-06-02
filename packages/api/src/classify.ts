import type { Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { functionMap } from '@outbound-tools/toolkit';

const CLASSIFICATION_PROMPT = `Classify this email reply into exactly one category:
- interested: positive reply, shows interest, wants to learn more
- meeting_request: explicitly asked for or accepted a meeting/call
- information_request: asked for more details, pricing, or documentation
- not_interested: polite decline, not a fit right now
- wrong_person: not the right contact, may have referred someone else
- do_not_contact: hard stop, hostile, legal/compliance concern
- out_of_office: auto-reply, vacation, OOO message
- unsubscribed: explicitly asked to be removed from emails
- bounced: delivery failure, invalid address, mailbox full

When ambiguous, prefer the most specific category.
meeting_request beats interested. do_not_contact beats unsubscribed.
out_of_office beats interested. wrong_person beats not_interested.
If none apply, respond with "none".

Respond with only the category name.`;

const VALID_CATEGORIES = [
  'interested',
  'meeting_request',
  'information_request',
  'not_interested',
  'wrong_person',
  'do_not_contact',
  'out_of_office',
  'unsubscribed',
  'bounced',
] as const;

type Category = (typeof VALID_CATEGORIES)[number];

interface EmailMessage {
  uid: number;
  subject: string;
  from: string;
  to: string;
  date: string;
  preview: string;
  flags: string[];
}

interface ThreadMessage {
  uid: number;
  folder: string;
}

interface Thread {
  messages?: ThreadMessage[];
}

interface AccountResult {
  account: string;
  total: number;
  interested: number;
  meeting_request: number;
  information_request: number;
  not_interested: number;
  wrong_person: number;
  do_not_contact: number;
  out_of_office: number;
  unsubscribed: number;
  bounced: number;
  none: number;
}

function isCategory(value: string): value is Category {
  return VALID_CATEGORIES.includes(value as Category);
}

async function classifyEmail(
  anthropic: Anthropic,
  email: EmailMessage,
): Promise<Category | 'none'> {
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 20,
    messages: [
      {
        role: 'user',
        content: `${CLASSIFICATION_PROMPT}\n\nSubject: ${email.subject}\n\n${email.preview}`,
      },
    ],
  });

  const text =
    response.content[0]?.type === 'text'
      ? response.content[0].text.trim().toLowerCase()
      : 'none';

  return isCategory(text) ? text : 'none';
}

export async function classifyHandler(req: Request, res: Response) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(501).json({
      error: 'ANTHROPIC_API_KEY is not set',
      message:
        'Set the ANTHROPIC_API_KEY environment variable to enable auto-classification. Without it, use the classify-replies agent skill to classify manually.',
    });
    return;
  }

  const anthropic = new Anthropic({ apiKey });

  try {
    // Get all email accounts
    const listAccounts = functionMap['list_email_accounts'];
    if (!listAccounts) {
      res.status(500).json({ error: 'list_email_accounts tool not available' });
      return;
    }
    // functionMap handlers return raw objects (the HTTP/MCP layers wrap them).
    const accounts: Array<{ id: string; email: string }> =
      (await listAccounts({})) ?? [];

    const results: AccountResult[] = [];

    for (const account of accounts) {
      const counts: AccountResult = {
        account: account.email,
        total: 0,
        interested: 0,
        meeting_request: 0,
        information_request: 0,
        not_interested: 0,
        wrong_person: 0,
        do_not_contact: 0,
        out_of_office: 0,
        unsubscribed: 0,
        bounced: 0,
        none: 0,
      };

      // Fetch inbox emails (for body previews + flags)
      const listReceived = functionMap['list_received_emails'];
      if (!listReceived) continue;
      const inboxData = await listReceived({ email: account.email, limit: 50, page: 1 });
      const inbox: EmailMessage[] = inboxData?.emails ?? [];

      const unclassified = inbox.filter(
        (e: EmailMessage) => !e.flags.includes('classified'),
      );

      if (unclassified.length === 0) {
        results.push(counts);
        continue;
      }

      // Use header-based threads to pair each reply with its sent original.
      // Within a thread, any Sent-folder message is the outbound counterpart of
      // the INBOX replies; map reply UID -> sent UID so we can tag both sides.
      const listThreads = functionMap['list_threads'];
      const sentByReply = new Map<number, number>();
      if (listThreads) {
        const threadsData = await listThreads({
          email: account.email,
          folders: ['INBOX', 'SENT'],
          limit: 200,
          includeMessages: true,
        });
        for (const thread of (threadsData?.threads ?? []) as Thread[]) {
          const msgs = thread.messages ?? [];
          const sent = msgs.find((m) => m.folder !== 'INBOX');
          if (!sent) continue;
          for (const m of msgs) {
            if (m.folder === 'INBOX') sentByReply.set(m.uid, sent.uid);
          }
        }
      }

      const setStatus = functionMap['set_reply_status'];
      const addTag = functionMap['add_email_tag'];

      for (const email of unclassified) {
        const category = await classifyEmail(anthropic, email);
        counts.total++;
        counts[category]++;

        const sentUid = sentByReply.get(email.uid);

        if (setStatus && category !== 'none') {
          await setStatus({
            email: account.email,
            uid: email.uid,
            status: category,
            ...(sentUid !== undefined ? { sent_uid: sentUid } : {}),
          });
        } else if (addTag) {
          if (category !== 'none') {
            await addTag({ email: account.email, uid: email.uid, tag: category, folder: 'INBOX' });
          }
          await addTag({ email: account.email, uid: email.uid, tag: 'classified', folder: 'INBOX' });
          if (sentUid !== undefined) {
            await addTag({ email: account.email, uid: sentUid, tag: 'classified', folder: 'SENT' });
          }
        }
      }

      results.push(counts);
    }

    res.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
}
