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
];
function isCategory(value) {
    return VALID_CATEGORIES.includes(value);
}
async function classifyEmail(anthropic, email) {
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
    const text = response.content[0]?.type === 'text'
        ? response.content[0].text.trim().toLowerCase()
        : 'none';
    return isCategory(text) ? text : 'none';
}
export async function classifyHandler(req, res) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        res.status(501).json({
            error: 'ANTHROPIC_API_KEY is not set',
            message: 'Set the ANTHROPIC_API_KEY environment variable to enable auto-classification. Without it, use the classify-replies agent skill to classify manually.',
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
        const accountsResult = await listAccounts({});
        const accounts = JSON.parse(accountsResult.content[0]?.text ?? '[]');
        const results = [];
        for (const account of accounts) {
            const counts = {
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
            // Fetch inbox emails
            const listReceived = functionMap['list_received_emails'];
            if (!listReceived)
                continue;
            const inboxResult = await listReceived({ email: account.email, limit: 50, page: 1 });
            const inboxData = JSON.parse(inboxResult.content[0]?.text ?? '{"emails":[]}');
            const inbox = inboxData.emails;
            const unclassified = inbox.filter((e) => !e.flags.includes('classified'));
            if (unclassified.length === 0) {
                results.push(counts);
                continue;
            }
            // Fetch threads to match replies to sent
            const listThreads = functionMap['list_threads'];
            if (!listThreads)
                continue;
            const threadsResult = await listThreads({
                email: account.email,
                receivedLimit: 50,
                sentLimit: 200,
                unclassifiedOnly: true,
            });
            const threadsData = JSON.parse(threadsResult.content[0]?.text ?? '{"matches":[],"unmatchedUids":[]}');
            const matches = threadsData.matches;
            const unmatchedUids = threadsData.unmatchedUids;
            // Classify matched replies
            const setStatus = functionMap['set_reply_status'];
            const addTag = functionMap['add_email_tag'];
            for (const match of matches) {
                const replyEmail = unclassified.find((e) => e.uid === match.receivedUid);
                if (!replyEmail)
                    continue;
                const category = await classifyEmail(anthropic, replyEmail);
                counts.total++;
                counts[category]++;
                if (setStatus && category !== 'none') {
                    await setStatus({
                        email: account.email,
                        uid: match.receivedUid,
                        status: category,
                        sent_uid: match.sentUid,
                    });
                }
                else if (addTag) {
                    // Just mark as classified if no category
                    await addTag({ email: account.email, uid: match.receivedUid, tag: 'classified', folder: 'INBOX' });
                    await addTag({ email: account.email, uid: match.sentUid, tag: 'classified', folder: 'SENT' });
                }
            }
            // Classify unmatched replies (tag INBOX only)
            for (const uid of unmatchedUids) {
                const email = unclassified.find((e) => e.uid === uid);
                if (!email)
                    continue;
                const category = await classifyEmail(anthropic, email);
                counts.total++;
                counts[category]++;
                if (setStatus && category !== 'none') {
                    await setStatus({
                        email: account.email,
                        uid,
                        status: category,
                    });
                }
                else if (addTag) {
                    if (category !== 'none') {
                        await addTag({ email: account.email, uid, tag: category, folder: 'INBOX' });
                    }
                    await addTag({ email: account.email, uid, tag: 'classified', folder: 'INBOX' });
                }
            }
            results.push(counts);
        }
        res.json({ results });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: message });
    }
}
