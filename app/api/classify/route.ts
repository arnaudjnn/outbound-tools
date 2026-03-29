import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { listMailboxes, getMailboxById } from "@/lib/mailpool";
import {
  fetchEmails,
  fetchSentEmails,
  matchRepliesToSent,
  setEmailFlag,
  resolveFolder,
} from "@/lib/imap";
import type { EmailMessage, ThreadMatch } from "@/lib/imap";
import { checkApiKey } from "@/lib/auth";

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
  "interested",
  "meeting_request",
  "information_request",
  "not_interested",
  "wrong_person",
  "do_not_contact",
  "out_of_office",
  "unsubscribed",
  "bounced",
] as const;

type Category = (typeof VALID_CATEGORIES)[number];

function isCategory(value: string): value is Category {
  return VALID_CATEGORIES.includes(value as Category);
}

async function classifyEmail(
  anthropic: Anthropic,
  email: EmailMessage
): Promise<Category | "none"> {
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 20,
    messages: [
      {
        role: "user",
        content: `${CLASSIFICATION_PROMPT}\n\nSubject: ${email.subject}\n\n${email.preview}`,
      },
    ],
  });

  const text =
    response.content[0].type === "text"
      ? response.content[0].text.trim().toLowerCase()
      : "none";

  return isCategory(text) ? text : "none";
}

async function tagEmail(
  mailbox: Awaited<ReturnType<typeof getMailboxById>>,
  folder: string,
  uid: number,
  tags: string[]
): Promise<void> {
  const resolved = await resolveFolder(mailbox, folder);
  for (const tag of tags) {
    await setEmailFlag(mailbox, resolved, uid, tag);
  }
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

export async function GET(request: Request) {
  const denied = checkApiKey(request);
  if (denied) return denied;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "ANTHROPIC_API_KEY is not set",
        message:
          "Set the ANTHROPIC_API_KEY environment variable to enable auto-classification. Without it, use the /classify-replies agent skill to classify manually.",
      },
      { status: 501 }
    );
  }

  const anthropic = new Anthropic({ apiKey });

  try {
    const mailboxes = await listMailboxes();
    const results: AccountResult[] = [];

    for (const mb of mailboxes) {
      const mailbox = await getMailboxById(mb.id);
      const counts: AccountResult = {
        account: mb.email,
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

      // Fetch inbox and sent emails
      const inbox = await fetchEmails(mailbox, "INBOX", 50);
      const unclassified = inbox.emails.filter(
        (e) => !e.flags.includes("classified")
      );

      if (unclassified.length === 0) {
        results.push(counts);
        continue;
      }

      const sent = await fetchSentEmails(mailbox, 200);
      const { matches, unmatchedUids } = matchRepliesToSent(
        unclassified,
        sent.emails
      );

      // Classify matched replies
      for (const match of matches) {
        const replyEmail = unclassified.find(
          (e) => e.uid === match.receivedUid
        )!;
        const category = await classifyEmail(anthropic, replyEmail);
        counts.total++;
        counts[category]++;

        const tags =
          category === "none" ? ["classified"] : [category, "classified"];

        // Tag reply in INBOX + original sent in SENT
        await tagEmail(mailbox, "INBOX", match.receivedUid, tags);
        await tagEmail(mailbox, "SENT", match.sentUid, tags);
      }

      // Classify unmatched replies (tag INBOX only)
      for (const uid of unmatchedUids) {
        const email = unclassified.find((e) => e.uid === uid)!;
        const category = await classifyEmail(anthropic, email);
        counts.total++;
        counts[category]++;

        const tags =
          category === "none" ? ["classified"] : [category, "classified"];
        await tagEmail(mailbox, "INBOX", uid, tags);
      }

      results.push(counts);
    }

    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
