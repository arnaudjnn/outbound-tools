import { listMailboxes, getMailboxByEmail, getMailboxById } from "./mailpool.js";
import {
  fetchEmails, fetchSentEmails, appendToSent, setEmailFlag, removeEmailFlag,
  listAllThreads, filterByTagExpression, resolveFolder, countByKeyword,
  addAudienceSegments, removeAudienceSegments,
  fetchEmailByUid, fetchEmailRawByUid, deleteEmail, getEmailHeaders,
  fetchDrafts, saveDraft, deleteDraft, fetchAttachmentByUid,
  normalizeSubject, extractEmail, resolveDraftsFolder,
  saveCampaignConfig, loadCampaignConfig, listCampaignConfigs, deleteCampaignConfig,
  upsertContactMarker, removeContactMarkerSegments, listAudienceSegmentsWithContacts, getContactMetadataByEmails,
} from "./imap.js";
import { sendEmail, composeDraft } from "./smtp.js";
import type { z } from "zod";
import type {
  ListReceivedEmailsInput, SendEmailInput,
  ListSentEmailsInput, ListThreadsInput, ListAllAccountThreadsInput, GetEmailAccountAnalyticsInput,
  AddEmailTagInput, RemoveEmailTagInput, AddToAudienceInput,
  RemoveFromAudienceInput, GetEmailInput, GetEmailRawInput,
  ReplyToEmailInput, ReplyAllToEmailInput, ForwardEmailInput,
  DeleteEmailInput, GetThreadInput, GetAttachmentInput,
  ListDraftsInput, GetDraftInput, CreateDraftInput,
  UpdateDraftInput, DeleteDraftInput, SendDraftInput,
  SetReplyStatusInput, GetCampaignAnalyticsInput, CreateCampaignInput,
  ListCampaignsInput, GetCampaignInput, DeleteCampaignInput,
  StartCampaignInput,
} from "./schemas.js";

// --- Constants ---

export const REPLY_STATUSES = [
  { tag: "interested", description: "Positive — shows interest, wants to learn more" },
  { tag: "meeting_request", description: "Explicitly asked for or accepted a meeting" },
  { tag: "information_request", description: "Asked for more details, pricing, or documentation" },
  { tag: "not_interested", description: "Polite decline, not a fit right now" },
  { tag: "wrong_person", description: "Not the right contact, may have referred someone else" },
  { tag: "do_not_contact", description: "Hard stop — hostile, legal, or compliance concern" },
  { tag: "out_of_office", description: "Auto-reply or out-of-office response" },
  { tag: "unsubscribed", description: "Asked to stop receiving emails" },
  { tag: "bounced", description: "Delivery failure or bounce notification" },
];

export const STATUS_TAGS = REPLY_STATUSES.map((s) => s.tag);

export const TERMINAL_STATUSES = ["do_not_contact", "unsubscribed", "bounced", "not_interested", "wrong_person"];

// --- Functions ---

export async function list_email_accounts() {
  const mailboxes = await listMailboxes();
  return mailboxes.map((m) => ({
    id: m.id,
    email: m.email,
    firstName: m.firstName,
    lastName: m.lastName,
    status: m.status,
    domain: m.domain,
  }));
}

export async function list_received_emails(params: z.infer<typeof ListReceivedEmailsInput>) {
  const { email, limit, page, tag_filter } = params;
  const mailbox = await getMailboxByEmail(email);
  const result = await fetchEmails(mailbox, "INBOX", limit, page);
  if (tag_filter) {
    result.emails = filterByTagExpression(result.emails, tag_filter);
  }
  return result;
}

export async function send_email(params: z.infer<typeof SendEmailInput>) {
  const { from, to, subject, text, html, cc, bcc } = params;
  if (!text && !html) {
    throw new Error("At least one of `text` or `html` body is required.");
  }

  const mailbox = await getMailboxByEmail(from);
  const result = await sendEmail(mailbox, { to, subject, text, html, cc, bcc });

  // Copy to Sent folder via IMAP so list_sent_emails can find it
  await appendToSent(mailbox, result.raw);

  return {
    messageId: result.messageId,
    accepted: result.accepted,
    rejected: result.rejected,
  };
}

export async function list_sent_emails(params: z.infer<typeof ListSentEmailsInput>) {
  const { email, limit, page, tag_filter } = params;
  const mailbox = await getMailboxByEmail(email);
  const result = await fetchSentEmails(mailbox, limit, page);
  if (tag_filter) {
    result.emails = filterByTagExpression(result.emails, tag_filter);
  }
  return result;
}

// Lists all conversation threads for a single account using header-based
// threading (RFC References / In-Reply-To), scanning INBOX + Sent by default.
export async function list_threads(params: z.infer<typeof ListThreadsInput>) {
  const { email, folders, limit, includeMessages, subjectFallback } = params;
  const mailbox = await getMailboxByEmail(email);
  const result = await listAllThreads(mailbox, { folders, limit, includeMessages, subjectFallback });
  return { account: email, ...result };
}

// Lists conversation threads across every registered mailbox and aggregates.
export async function list_all_account_threads(params: z.infer<typeof ListAllAccountThreadsInput>) {
  const { folders, limit, includeMessages, subjectFallback } = params;
  const opts = { folders, limit, includeMessages, subjectFallback };

  const mailboxes = await listMailboxes();
  const accounts: Array<Record<string, unknown>> = [];
  let threadCount = 0;
  let messagesScanned = 0;

  for (const m of mailboxes) {
    try {
      const mailbox = await getMailboxById(m.id);
      const result = await listAllThreads(mailbox, opts);
      accounts.push({ account: m.email, ...result });
      threadCount += result.threadCount;
      messagesScanned += result.messagesScanned;
    } catch (err) {
      accounts.push({
        account: m.email,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    accountCount: accounts.length,
    messagesScanned,
    threadCount,
    accounts,
  };
}

export async function get_email_account_analytics(params: z.infer<typeof GetEmailAccountAnalyticsInput>) {
  const { email } = params;
  const mailbox = await getMailboxByEmail(email);

  const statusTags = [
    "interested", "meeting_request", "information_request",
    "not_interested", "wrong_person", "do_not_contact",
    "out_of_office", "unsubscribed", "bounced",
  ];
  // Rates are "unknown" (not 0%) when there is nothing to measure: no sent
  // emails, or no replies classified yet. Classification only sets status tags
  // when ANTHROPIC_API_KEY is set (auto endpoint) or via the classify-replies
  // skill — so an unclassified mailbox reports "unknown", not a misleading 0%.
  const unknownRates = Object.fromEntries(statusTags.map((t) => [t, "unknown"]));
  const zeroStatuses = Object.fromEntries(statusTags.map((t) => [t, 0]));

  const sentPage = await fetchSentEmails(mailbox, 1);
  const totalSent = sentPage.total;

  if (totalSent === 0) {
    return { totalSent: 0, totalReplied: 0, replyRate: "unknown", statuses: zeroStatuses, rates: unknownRates };
  }

  const sentFolder = await resolveFolder(mailbox, "SENT");
  const counts = await Promise.all(
    statusTags.map((tag) => countByKeyword(mailbox, sentFolder, tag))
  );

  const statuses: Record<string, number> = {};
  for (let i = 0; i < statusTags.length; i++) statuses[statusTags[i]] = counts[i];

  const totalReplied = counts.reduce((sum, c) => sum + c, 0);

  // No classified replies yet -> rates are unmeasured rather than 0%.
  if (totalReplied === 0) {
    return { totalSent, totalReplied: 0, replyRate: "unknown", statuses, rates: unknownRates };
  }

  const rate = (count: number) => Math.round((count / totalSent) * 10000) / 100;
  const rates: Record<string, number> = {};
  for (let i = 0; i < statusTags.length; i++) rates[statusTags[i]] = rate(counts[i]);

  return {
    totalSent,
    totalReplied,
    replyRate: rate(totalReplied),
    statuses,
    rates,
  };
}

export async function add_email_tag(params: z.infer<typeof AddEmailTagInput>) {
  const { email, uid, tag, folder } = params;
  const mailbox = await getMailboxByEmail(email);
  const resolvedFolder = await resolveFolder(mailbox, folder);
  await setEmailFlag(mailbox, resolvedFolder, uid, tag);
  return { message: `Tag "${tag}" added to message UID ${uid} in ${folder}.` };
}

export async function remove_email_tag(params: z.infer<typeof RemoveEmailTagInput>) {
  const { email, uid, tag, folder } = params;
  const mailbox = await getMailboxByEmail(email);
  const resolvedFolder = await resolveFolder(mailbox, folder);
  await removeEmailFlag(mailbox, resolvedFolder, uid, tag);
  return { message: `Tag "${tag}" removed from message UID ${uid} in ${folder}.` };
}

export async function add_to_audience(params: z.infer<typeof AddToAudienceInput>) {
  const { email, segments, firstName, lastName, company } = params;
  const mailboxes = await listMailboxes();
  let totalTagged = 0;
  for (const mb of mailboxes) {
    const details = await getMailboxById(mb.id);
    // Tag existing messages in INBOX and SENT
    for (const folder of ["INBOX", "SENT"] as const) {
      totalTagged += await addAudienceSegments(details, folder, email, segments);
    }
    // Always create/update a contact marker with metadata + segments
    await upsertContactMarker(details, { email, firstName, lastName, company }, segments);
  }
  return {
    message: `Added segments [${segments.join(", ")}] to ${email}${firstName ? ` (${firstName}${lastName ? " " + lastName : ""}${company ? ", " + company : ""})` : ""}. Tagged ${totalTagged} existing messages + contact marker across ${mailboxes.length} accounts.`,
  };
}

export async function remove_from_audience(params: z.infer<typeof RemoveFromAudienceInput>) {
  const { email, segments } = params;
  const mailboxes = await listMailboxes();
  let totalUntagged = 0;
  for (const mb of mailboxes) {
    const details = await getMailboxById(mb.id);
    for (const folder of ["INBOX", "SENT"] as const) {
      totalUntagged += await removeAudienceSegments(details, folder, email, segments);
    }
    // Also remove from Contacts folder marker (delete marker if no segments remain)
    await removeContactMarkerSegments(details, email, segments);
  }
  return {
    message: `Removed segments [${segments.join(", ")}] from ${email}. Untagged ${totalUntagged} messages + updated contact marker across ${mailboxes.length} accounts.`,
  };
}

export async function list_audiences() {
  const mailboxes = await listMailboxes();
  const mergedSegments = new Map<string, Set<string>>();

  for (const mb of mailboxes) {
    const details = await getMailboxById(mb.id);
    for (const folder of ["INBOX", "SENT"] as const) {
      const segments = await listAudienceSegmentsWithContacts(details, folder);
      for (const seg of segments) {
        if (!mergedSegments.has(seg.name)) mergedSegments.set(seg.name, new Set());
        for (const contact of seg.contacts) {
          mergedSegments.get(seg.name)!.add(contact);
        }
      }
    }
  }

  const segments = Array.from(mergedSegments.entries()).map(([name, contacts]) => ({
    name,
    count: contacts.size,
    contacts: Array.from(contacts),
  }));

  return { segments };
}

export async function get_email(params: z.infer<typeof GetEmailInput>) {
  const { email, uid, folder } = params;
  const mailbox = await getMailboxByEmail(email);
  const resolvedFolder = await resolveFolder(mailbox, folder);
  return fetchEmailByUid(mailbox, resolvedFolder, uid);
}

export async function get_email_raw(params: z.infer<typeof GetEmailRawInput>) {
  const { email, uid, folder } = params;
  const mailbox = await getMailboxByEmail(email);
  const resolvedFolder = await resolveFolder(mailbox, folder);
  const raw = await fetchEmailRawByUid(mailbox, resolvedFolder, uid);
  return raw.toString("utf-8");
}

export async function reply_to_email(params: z.infer<typeof ReplyToEmailInput>) {
  const { email, uid, folder, text, html } = params;
  if (!text && !html) {
    throw new Error("At least one of `text` or `html` body is required.");
  }

  const mailbox = await getMailboxByEmail(email);
  const resolvedFolder = await resolveFolder(mailbox, folder);
  const original = await getEmailHeaders(mailbox, resolvedFolder, uid);

  const replyTo = extractEmail(original.from);
  const subject = original.subject.match(/^re:/i) ? original.subject : `Re: ${original.subject}`;
  const references = [original.references, original.messageId].filter(Boolean).join(" ");

  const result = await sendEmail(mailbox, {
    to: [replyTo],
    subject,
    text,
    html,
    inReplyTo: original.messageId,
    references,
  });

  await appendToSent(mailbox, result.raw);

  return {
    messageId: result.messageId,
    accepted: result.accepted,
    rejected: result.rejected,
    inReplyTo: original.messageId,
  };
}

export async function reply_all_to_email(params: z.infer<typeof ReplyAllToEmailInput>) {
  const { email, uid, folder, text, html } = params;
  if (!text && !html) {
    throw new Error("At least one of `text` or `html` body is required.");
  }

  const mailbox = await getMailboxByEmail(email);
  const resolvedFolder = await resolveFolder(mailbox, folder);
  const original = await getEmailHeaders(mailbox, resolvedFolder, uid);

  const ownEmail = mailbox.email.toLowerCase();
  // To: original sender
  const toAddresses = [extractEmail(original.from)];
  // CC: original To + CC minus ourselves
  const allRecipients = [original.to, original.cc]
    .filter(Boolean)
    .join(", ")
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean)
    .map((a) => extractEmail(a))
    .filter((a) => a !== ownEmail && !toAddresses.includes(a));

  const subject = original.subject.match(/^re:/i) ? original.subject : `Re: ${original.subject}`;
  const references = [original.references, original.messageId].filter(Boolean).join(" ");

  const result = await sendEmail(mailbox, {
    to: toAddresses,
    subject,
    text,
    html,
    cc: allRecipients.length > 0 ? allRecipients : undefined,
    inReplyTo: original.messageId,
    references,
  });

  await appendToSent(mailbox, result.raw);

  return {
    messageId: result.messageId,
    accepted: result.accepted,
    rejected: result.rejected,
    inReplyTo: original.messageId,
  };
}

export async function forward_email(params: z.infer<typeof ForwardEmailInput>) {
  const { email, uid, folder, to, text, html } = params;
  const mailbox = await getMailboxByEmail(email);
  const resolvedFolder = await resolveFolder(mailbox, folder);
  const original = await getEmailHeaders(mailbox, resolvedFolder, uid);

  const subject = original.subject.match(/^fwd?:/i) ? original.subject : `Fwd: ${original.subject}`;

  // Build forwarded body
  const fwdHeader = `\n\n---------- Forwarded message ----------\nFrom: ${original.from}\nDate: ${original.date}\nSubject: ${original.subject}\nTo: ${original.to}\n\n`;
  const fwdText = text ? text + fwdHeader + (original.text || "") : fwdHeader + (original.text || "");
  const fwdHtml = html
    ? html + `<br><br><hr><b>---------- Forwarded message ----------</b><br>From: ${original.from}<br>Date: ${original.date}<br>Subject: ${original.subject}<br>To: ${original.to}<br><br>${original.html || original.text || ""}`
    : original.html
      ? `<br><hr><b>---------- Forwarded message ----------</b><br>From: ${original.from}<br>Date: ${original.date}<br>Subject: ${original.subject}<br>To: ${original.to}<br><br>${original.html}`
      : undefined;

  const result = await sendEmail(mailbox, {
    to,
    subject,
    text: fwdText,
    html: fwdHtml,
    attachments: original.attachments,
  });

  await appendToSent(mailbox, result.raw);

  return {
    messageId: result.messageId,
    accepted: result.accepted,
    rejected: result.rejected,
    forwardedFrom: original.messageId,
  };
}

export async function delete_email_fn(params: z.infer<typeof DeleteEmailInput>) {
  const { email, uid, folder } = params;
  const mailbox = await getMailboxByEmail(email);
  const resolvedFolder = await resolveFolder(mailbox, folder);
  await deleteEmail(mailbox, resolvedFolder, uid);
  return { message: `Message UID ${uid} deleted from ${folder}.` };
}

export async function get_thread(params: z.infer<typeof GetThreadInput>) {
  const { email, subject, limit } = params;
  const mailbox = await getMailboxByEmail(email);

  const [inbox, sent] = await Promise.all([
    fetchEmails(mailbox, "INBOX", limit),
    fetchSentEmails(mailbox, limit),
  ]);

  const normalizedTarget = normalizeSubject(subject);
  const allEmails = [...inbox.emails, ...sent.emails];
  const threadEmails = allEmails
    .filter((e) => normalizeSubject(e.subject) === normalizedTarget)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const senders = [...new Set(threadEmails.map((e) => extractEmail(e.from)))];

  return {
    subject: normalizedTarget,
    messageCount: threadEmails.length,
    senders,
    messages: threadEmails,
  };
}

export async function get_attachment(params: z.infer<typeof GetAttachmentInput>) {
  const { email, uid, index, folder } = params;
  const mailbox = await getMailboxByEmail(email);
  const resolvedFolder = await resolveFolder(mailbox, folder);
  const attachment = await fetchAttachmentByUid(mailbox, resolvedFolder, uid, index);
  return {
    filename: attachment.filename,
    contentType: attachment.contentType,
    size: attachment.size,
    content_base64: attachment.content,
  };
}

export async function list_drafts(params: z.infer<typeof ListDraftsInput>) {
  const { email, limit, page } = params;
  const mailbox = await getMailboxByEmail(email);
  return fetchDrafts(mailbox, limit, page);
}

export async function get_draft(params: z.infer<typeof GetDraftInput>) {
  const { email, uid } = params;
  const mailbox = await getMailboxByEmail(email);
  const draftsFolder = await resolveDraftsFolder(mailbox);
  return fetchEmailByUid(mailbox, draftsFolder, uid);
}

export async function create_draft(params: z.infer<typeof CreateDraftInput>) {
  const { email, to, subject, text, html, cc, bcc } = params;
  const mailbox = await getMailboxByEmail(email);
  const raw = await composeDraft(mailbox, { to, subject, text, html, cc, bcc });
  await saveDraft(mailbox, raw);
  return { message: `Draft created for ${to.join(", ")} with subject "${subject}".` };
}

export async function update_draft(params: z.infer<typeof UpdateDraftInput>) {
  const { email, uid, to, subject, text, html, cc, bcc } = params;
  const mailbox = await getMailboxByEmail(email);
  // IMAP doesn't support in-place edit — delete old draft and save new one
  await deleteDraft(mailbox, uid);
  const raw = await composeDraft(mailbox, { to, subject, text, html, cc, bcc });
  await saveDraft(mailbox, raw);
  return { message: `Draft updated (old UID ${uid} replaced) for ${to.join(", ")} with subject "${subject}".` };
}

export async function delete_draft_fn(params: z.infer<typeof DeleteDraftInput>) {
  const { email, uid } = params;
  const mailbox = await getMailboxByEmail(email);
  await deleteDraft(mailbox, uid);
  return { message: `Draft UID ${uid} deleted.` };
}

export async function send_draft(params: z.infer<typeof SendDraftInput>) {
  const { email, uid } = params;
  const mailbox = await getMailboxByEmail(email);

  // Fetch the draft to get its content
  const draftsFolder = await resolveDraftsFolder(mailbox);
  const detail = await fetchEmailByUid(mailbox, draftsFolder, uid);

  const toAddresses = detail.to.split(",").map((a) => a.trim()).filter(Boolean);
  const ccAddresses = detail.cc ? detail.cc.split(",").map((a) => a.trim()).filter(Boolean) : undefined;

  if (toAddresses.length === 0) {
    throw new Error("Draft has no recipients.");
  }

  const result = await sendEmail(mailbox, {
    to: toAddresses,
    subject: detail.subject,
    text: detail.text || undefined,
    html: detail.html || undefined,
    cc: ccAddresses,
  });

  await appendToSent(mailbox, result.raw);
  await deleteDraft(mailbox, uid);

  return {
    messageId: result.messageId,
    accepted: result.accepted,
    rejected: result.rejected,
    draftDeleted: true,
  };
}

export async function list_reply_statuses() {
  return { statuses: REPLY_STATUSES };
}

export async function set_reply_status(params: z.infer<typeof SetReplyStatusInput>) {
  const { email, uid, status, sent_uid } = params;
  const mailbox = await getMailboxByEmail(email);

  // Remove any existing status tags from the reply
  const detail = await fetchEmailByUid(mailbox, "INBOX", uid);
  const existingStatuses = detail.flags.filter((f) => STATUS_TAGS.includes(f));
  for (const oldStatus of existingStatuses) {
    await removeEmailFlag(mailbox, "INBOX", uid, oldStatus);
  }

  // Set new status + classified
  await setEmailFlag(mailbox, "INBOX", uid, status);
  await setEmailFlag(mailbox, "INBOX", uid, "classified");

  // Tag matching sent email too
  if (sent_uid) {
    const sentFolder = await resolveFolder(mailbox, "SENT");
    const sentDetail = await fetchEmailByUid(mailbox, sentFolder, sent_uid);
    const existingSentStatuses = sentDetail.flags.filter((f) => STATUS_TAGS.includes(f));
    for (const oldStatus of existingSentStatuses) {
      await removeEmailFlag(mailbox, sentFolder, sent_uid, oldStatus);
    }
    await setEmailFlag(mailbox, sentFolder, sent_uid, status);
    await setEmailFlag(mailbox, sentFolder, sent_uid, "classified");
  }

  return {
    message: `Status "${status}" set on reply UID ${uid}${sent_uid ? ` and sent UID ${sent_uid}` : ""}.`,
  };
}

export async function get_campaign_analytics(params: z.infer<typeof GetCampaignAnalyticsInput>) {
  const { email, campaign } = params;
  const mailbox = await getMailboxByEmail(email);
  const campaignTag = `campaign_${campaign}`;

  // Fetch all sent emails for this campaign
  const sentPage = await fetchSentEmails(mailbox, 500);
  const campaignSent = sentPage.emails.filter((e) => e.flags.includes(campaignTag));

  if (campaignSent.length === 0) {
    return { campaign, totalSent: 0, message: "No emails found for this campaign." };
  }

  // Fetch replies to match
  const inboxPage = await fetchEmails(mailbox, "INBOX", 500);

  // Per-step and per-variant breakdown
  const steps = new Map<string, { sent: number; variants: Map<string, number> }>();
  const uniqueContacts = new Set<string>();

  for (const e of campaignSent) {
    const stepFlag = e.flags.find((f) => f.startsWith("step_"));
    const variantFlag = e.flags.find((f) => f.startsWith("variant_"));
    const stepName = stepFlag || "unknown";
    const variantName = variantFlag || "unknown";

    if (!steps.has(stepName)) steps.set(stepName, { sent: 0, variants: new Map() });
    const stepData = steps.get(stepName)!;
    stepData.sent++;
    stepData.variants.set(variantName, (stepData.variants.get(variantName) || 0) + 1);

    uniqueContacts.add(extractEmail(e.to));
  }

  // Count statuses on sent emails (tagged by set_reply_status)
  const statusCounts: Record<string, number> = {};
  for (const tag of STATUS_TAGS) {
    const count = campaignSent.filter((e) => e.flags.includes(tag)).length;
    if (count > 0) statusCounts[tag] = count;
  }

  // Count replies (inbox emails that match campaign sent subjects)
  const campaignSubjects = new Set(campaignSent.map((e) => normalizeSubject(e.subject)));
  const replies = inboxPage.emails.filter((e) => {
    const ns = normalizeSubject(e.subject);
    return campaignSubjects.has(ns);
  });

  // Per-step analytics
  const stepAnalytics: Record<string, { sent: number; variants: Record<string, number> }> = {};
  for (const [stepName, data] of steps) {
    stepAnalytics[stepName] = {
      sent: data.sent,
      variants: Object.fromEntries(data.variants),
    };
  }

  // Per-variant reply status breakdown
  const variantStatuses: Record<string, Record<string, number>> = {};
  for (const e of campaignSent) {
    const variantFlag = e.flags.find((f) => f.startsWith("variant_")) || "unknown";
    if (!variantStatuses[variantFlag]) variantStatuses[variantFlag] = { sent: 0 };
    variantStatuses[variantFlag].sent++;
    for (const tag of STATUS_TAGS) {
      if (e.flags.includes(tag)) {
        variantStatuses[variantFlag][tag] = (variantStatuses[variantFlag][tag] || 0) + 1;
      }
    }
  }

  const totalSent = campaignSent.length;
  const totalReplied = Object.values(statusCounts).reduce((sum, c) => sum + c, 0);
  // "unknown" rather than 0% when nothing has been sent or classified yet.
  const measurable = totalSent > 0 && totalReplied > 0;
  const rate = (count: number): number | string =>
    measurable ? Math.round((count / totalSent) * 10000) / 100 : "unknown";

  return {
    campaign,
    totalSent,
    uniqueContacts: uniqueContacts.size,
    totalReplied,
    replyRate: rate(totalReplied),
    repliesDetected: replies.length,
    statuses: statusCounts,
    statusRates: Object.fromEntries(
      Object.entries(statusCounts).map(([k, v]) => [k, rate(v)])
    ),
    steps: stepAnalytics,
    variants: variantStatuses,
  };
}

export async function create_campaign(params: z.infer<typeof CreateCampaignInput>) {
  const { email, name, audience_segment, sequence } = params;
  const mailbox = await getMailboxByEmail(email);
  const config = {
    name,
    audience_segment,
    sequence,
    created_at: new Date().toISOString(),
  };
  await saveCampaignConfig(mailbox, config);
  return {
    campaign: name,
    audience_segment,
    steps: sequence.length,
    totalVariants: sequence.reduce((sum, s) => sum + s.variants.length, 0),
    status: "created",
  };
}

export async function list_campaigns(params: z.infer<typeof ListCampaignsInput>) {
  const { email } = params;
  const mailbox = await getMailboxByEmail(email);
  const campaigns = await listCampaignConfigs(mailbox);
  return { campaigns };
}

export async function get_campaign(params: z.infer<typeof GetCampaignInput>) {
  const { email, campaign } = params;
  const mailbox = await getMailboxByEmail(email);
  return loadCampaignConfig(mailbox, campaign);
}

export async function delete_campaign_fn(params: z.infer<typeof DeleteCampaignInput>) {
  const { email, campaign } = params;
  const mailbox = await getMailboxByEmail(email);
  await deleteCampaignConfig(mailbox, campaign);
  return { message: `Campaign "${campaign}" deleted.` };
}

export async function start_campaign(params: z.infer<typeof StartCampaignInput>) {
  const { email, campaign } = params;
  const mailbox = await getMailboxByEmail(email);

  const config = await loadCampaignConfig(mailbox, campaign);
  const campaignTag = `campaign_${config.name}`;
  const sortedSteps = [...config.sequence].sort((a, b) => a.step - b.step);

  // Pull contacts from audience segment (includes Contacts folder markers)
  const mailboxes = await listMailboxes();
  const mergedContacts = new Set<string>();
  for (const mb of mailboxes) {
    const details = await getMailboxById(mb.id);
    for (const folder of ["INBOX", "SENT"] as const) {
      const segments = await listAudienceSegmentsWithContacts(details, folder);
      const target = segments.find((s) => s.name === config.audience_segment);
      if (target) {
        for (const c of target.contacts) mergedContacts.add(c);
      }
    }
  }

  const contacts = Array.from(mergedContacts);
  if (contacts.length === 0) {
    throw new Error(`No contacts found in audience segment "${config.audience_segment}". Enroll contacts with add_to_audience first.`);
  }

  // Load contact metadata for template personalization
  const contactMetadata = await getContactMetadataByEmails(mailbox, contacts);

  // Fetch all sent emails tagged with this campaign
  const sentPage = await fetchSentEmails(mailbox, 500);
  const campaignSent = sentPage.emails.filter((e) => e.flags.includes(campaignTag));

  // Fetch inbox to check for terminal reply statuses
  const inboxPage = await fetchEmails(mailbox, "INBOX", 500);

  // Pick variant by weighted random selection
  function pickVariant(variants: typeof config.sequence[0]["variants"]) {
    const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
    let r = Math.random() * totalWeight;
    for (const v of variants) {
      r -= v.weight;
      if (r <= 0) return v;
    }
    return variants[variants.length - 1];
  }

  function interpolate(template: string, contactEmail: string) {
    const meta = contactMetadata.get(contactEmail.toLowerCase());
    return template
      .replace(/\{\{email\}\}/g, contactEmail)
      .replace(/\{\{firstName\}\}/g, meta?.firstName || "")
      .replace(/\{\{lastName\}\}/g, meta?.lastName || "")
      .replace(/\{\{company\}\}/g, meta?.company || "");
  }

  const results: Array<{ contact: string; step: number; variant: string; status: string }> = [];
  const now = Date.now();

  for (const contactEmail of contacts) {
    // Check if contact has a terminal reply status
    const contactReplies = inboxPage.emails.filter(
      (e) => extractEmail(e.from) === contactEmail
    );
    const hasTerminalStatus = contactReplies.some(
      (e) => e.flags.some((f) => TERMINAL_STATUSES.includes(f))
    );
    if (hasTerminalStatus) {
      results.push({ contact: contactEmail, step: 0, variant: "-", status: "skipped_terminal_status" });
      continue;
    }

    // Find which steps this contact has already received
    const contactSent = campaignSent.filter(
      (e) => e.to.toLowerCase().includes(contactEmail)
    );
    const completedSteps = new Set<number>();
    let lastSentDate = 0;

    for (const e of contactSent) {
      const stepFlag = e.flags.find((f) => f.startsWith("step_"));
      if (stepFlag) {
        const stepNum = parseInt(stepFlag.replace("step_", ""), 10);
        completedSteps.add(stepNum);
        const sentDate = new Date(e.date).getTime();
        if (sentDate > lastSentDate) lastSentDate = sentDate;
      }
    }

    // Find next step to send
    const nextStep = sortedSteps.find((s) => !completedSteps.has(s.step));
    if (!nextStep) {
      results.push({ contact: contactEmail, step: 0, variant: "-", status: "completed_all_steps" });
      continue;
    }

    // Check delay
    if (nextStep.step > 1 && lastSentDate > 0) {
      const daysSinceLast = (now - lastSentDate) / (1000 * 60 * 60 * 24);
      if (daysSinceLast < nextStep.delay_days) {
        results.push({
          contact: contactEmail,
          step: nextStep.step,
          variant: "-",
          status: `waiting_delay (${Math.ceil(nextStep.delay_days - daysSinceLast)}d remaining)`,
        });
        continue;
      }
    }

    // Send
    const variant = pickVariant(nextStep.variants);
    const variantTag = `variant_${variant.name}`;
    const stepTag = `step_${nextStep.step}`;
    const subject = interpolate(variant.subject, contactEmail);
    const text = variant.text ? interpolate(variant.text, contactEmail) : undefined;
    const html = variant.html ? interpolate(variant.html, contactEmail) : undefined;

    if (!text && !html) {
      results.push({ contact: contactEmail, step: nextStep.step, variant: variant.name, status: "skipped_no_body" });
      continue;
    }

    try {
      let result;

      // Step 2+ with empty subject = reply in thread
      if (nextStep.step > 1 && !variant.subject) {
        const originalSent = contactSent.find((e) => e.flags.includes("step_1"));
        if (originalSent) {
          const sentFolder = await resolveFolder(mailbox, "SENT");
          const headers = await getEmailHeaders(mailbox, sentFolder, originalSent.uid);
          const reSubject = headers.subject.match(/^re:/i) ? headers.subject : `Re: ${headers.subject}`;
          const references = [headers.references, headers.messageId].filter(Boolean).join(" ");
          result = await sendEmail(mailbox, {
            to: [contactEmail],
            subject: reSubject,
            text,
            html,
            inReplyTo: headers.messageId,
            references,
          });
        } else {
          results.push({ contact: contactEmail, step: nextStep.step, variant: variant.name, status: "skipped_no_original_thread" });
          continue;
        }
      } else {
        result = await sendEmail(mailbox, { to: [contactEmail], subject, text, html });
      }

      await appendToSent(mailbox, result.raw);

      // Tag the sent email
      const recentSent = await fetchSentEmails(mailbox, 5);
      const justSent = recentSent.emails.find(
        (e) => e.to.toLowerCase().includes(contactEmail)
      );
      if (justSent) {
        const sentFolder = await resolveFolder(mailbox, "SENT");
        await setEmailFlag(mailbox, sentFolder, justSent.uid, campaignTag);
        await setEmailFlag(mailbox, sentFolder, justSent.uid, stepTag);
        await setEmailFlag(mailbox, sentFolder, justSent.uid, variantTag);
      }

      results.push({ contact: contactEmail, step: nextStep.step, variant: variant.name, status: "sent" });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      results.push({ contact: contactEmail, step: nextStep.step, variant: variant.name, status: `error: ${errorMessage}` });
    }
  }

  const sent = results.filter((r) => r.status === "sent").length;
  const skipped = results.filter((r) => r.status.startsWith("skipped") || r.status.startsWith("waiting") || r.status.startsWith("completed")).length;
  const errors = results.filter((r) => r.status.startsWith("error")).length;

  return {
    campaign: config.name,
    audience_segment: config.audience_segment,
    summary: { sent, skipped, errors, total: contacts.length },
    results,
  };
}

export async function ping() {
  return { message: "pong" };
}

// --- Function map ---

export const functionMap: Record<string, (params: any) => Promise<any>> = {
  list_email_accounts,
  list_received_emails,
  send_email,
  list_sent_emails,
  list_threads,
  list_all_account_threads,
  get_email_account_analytics,
  add_email_tag,
  remove_email_tag,
  add_to_audience,
  remove_from_audience,
  list_audiences,
  get_email,
  get_email_raw,
  reply_to_email,
  reply_all_to_email,
  forward_email,
  delete_email: delete_email_fn,
  get_thread,
  get_attachment,
  list_drafts,
  get_draft,
  create_draft,
  update_draft,
  delete_draft: delete_draft_fn,
  send_draft,
  list_reply_statuses,
  set_reply_status,
  get_campaign_analytics,
  create_campaign,
  list_campaigns,
  get_campaign,
  delete_campaign: delete_campaign_fn,
  start_campaign,
  ping,
};
