import { z } from "zod";

export const ListEmailAccountsInput = z.object({});

export const ListReceivedEmailsInput = z.object({
  email: z.string(),
  limit: z.number().optional().default(50).describe("Emails per page"),
  page: z.number().optional().default(1).describe("Page number (1-indexed, most recent first)"),
  tag_filter: z.string().optional().describe("Boolean tag filter expression. Examples: 'interested', 'classified AND interested', 'NOT classified', 'do_not_contact OR unsubscribed'"),
});

export const SendEmailInput = z.object({
  from: z.string().describe("Sender email address (must be a registered mailbox)"),
  to: z.array(z.string()).describe("Recipient email addresses"),
  subject: z.string().describe("Email subject"),
  text: z.string().optional().describe("Plain text body"),
  html: z.string().optional().describe("HTML body"),
  cc: z.array(z.string()).optional().describe("CC recipients"),
  bcc: z.array(z.string()).optional().describe("BCC recipients"),
});

export const ListSentEmailsInput = z.object({
  email: z.string(),
  limit: z.number().optional().default(50).describe("Emails per page"),
  page: z.number().optional().default(1).describe("Page number (1-indexed, most recent first)"),
  tag_filter: z.string().optional().describe("Boolean tag filter expression. Examples: 'interested', 'classified AND interested', 'NOT classified', 'do_not_contact OR unsubscribed'"),
});

export const ListThreadsInput = z.object({
  email: z.string().describe("Email account to analyze"),
  receivedLimit: z.number().optional().default(50).describe("Max received emails to check"),
  sentLimit: z.number().optional().default(200).describe("Max sent emails to match against"),
  unclassifiedOnly: z.boolean().optional().default(true).describe("Only check emails without the 'classified' flag"),
});

export const GetEmailAccountAnalyticsInput = z.object({
  email: z.string().describe("Email account to get analytics for"),
});

export const AddEmailTagInput = z.object({
  email: z.string().describe("Email account that owns the mailbox"),
  uid: z.number().describe("UID of the email message"),
  tag: z.string().describe("IMAP keyword to add"),
  folder: z.enum(["INBOX", "SENT"]).optional().default("INBOX").describe("Folder: INBOX or SENT"),
});

export const RemoveEmailTagInput = z.object({
  email: z.string().describe("Email account that owns the mailbox"),
  uid: z.number().describe("UID of the email message"),
  tag: z.string().describe("IMAP keyword to remove"),
  folder: z.enum(["INBOX", "SENT"]).optional().default("INBOX").describe("Folder: INBOX or SENT"),
});

export const AddToAudienceInput = z.object({
  email: z.string().describe("Contact email to segment (e.g. the person you send to or receive from)"),
  segments: z.array(z.string()).optional().default(["general"]).describe("Audience segments to add (e.g. ['employee', 'vip'])"),
  firstName: z.string().optional().describe("Contact first name (for email personalization)"),
  lastName: z.string().optional().describe("Contact last name"),
  company: z.string().optional().describe("Contact company name"),
});

export const RemoveFromAudienceInput = z.object({
  email: z.string().describe("Contact email to remove from segments"),
  segments: z.array(z.string()).describe("Audience segments to remove"),
});

export const ListAudiencesInput = z.object({});

export const GetEmailInput = z.object({
  email: z.string().describe("Email account that owns the mailbox"),
  uid: z.number().describe("UID of the email message"),
  folder: z.enum(["INBOX", "SENT"]).optional().default("INBOX").describe("Folder: INBOX or SENT"),
});

export const GetEmailRawInput = z.object({
  email: z.string().describe("Email account that owns the mailbox"),
  uid: z.number().describe("UID of the email message"),
  folder: z.enum(["INBOX", "SENT"]).optional().default("INBOX").describe("Folder: INBOX or SENT"),
});

export const ReplyToEmailInput = z.object({
  email: z.string().describe("Email account to reply from"),
  uid: z.number().describe("UID of the email to reply to"),
  folder: z.enum(["INBOX", "SENT"]).optional().default("INBOX").describe("Folder where the original email is"),
  text: z.string().optional().describe("Plain text reply body"),
  html: z.string().optional().describe("HTML reply body"),
});

export const ReplyAllToEmailInput = z.object({
  email: z.string().describe("Email account to reply from"),
  uid: z.number().describe("UID of the email to reply to"),
  folder: z.enum(["INBOX", "SENT"]).optional().default("INBOX").describe("Folder where the original email is"),
  text: z.string().optional().describe("Plain text reply body"),
  html: z.string().optional().describe("HTML reply body"),
});

export const ForwardEmailInput = z.object({
  email: z.string().describe("Email account to forward from"),
  uid: z.number().describe("UID of the email to forward"),
  folder: z.enum(["INBOX", "SENT"]).optional().default("INBOX").describe("Folder where the original email is"),
  to: z.array(z.string()).describe("Recipients to forward to"),
  text: z.string().optional().describe("Optional additional message"),
  html: z.string().optional().describe("Optional additional HTML message"),
});

export const DeleteEmailInput = z.object({
  email: z.string().describe("Email account that owns the mailbox"),
  uid: z.number().describe("UID of the email message to delete"),
  folder: z.enum(["INBOX", "SENT"]).optional().default("INBOX").describe("Folder: INBOX or SENT"),
});

export const GetThreadInput = z.object({
  email: z.string().describe("Email account to search"),
  subject: z.string().describe("Subject line to match (Re:/Fwd: prefixes are stripped for matching)"),
  limit: z.number().optional().default(100).describe("Max emails to scan per folder"),
});

export const GetAttachmentInput = z.object({
  email: z.string().describe("Email account that owns the mailbox"),
  uid: z.number().describe("UID of the email message"),
  index: z.number().describe("Attachment index (0-based, from get_email attachments list)"),
  folder: z.enum(["INBOX", "SENT"]).optional().default("INBOX").describe("Folder: INBOX or SENT"),
});

export const ListDraftsInput = z.object({
  email: z.string().describe("Email account to list drafts for"),
  limit: z.number().optional().default(50).describe("Drafts per page"),
  page: z.number().optional().default(1).describe("Page number (1-indexed, most recent first)"),
});

export const GetDraftInput = z.object({
  email: z.string().describe("Email account that owns the draft"),
  uid: z.number().describe("UID of the draft message"),
});

export const CreateDraftInput = z.object({
  email: z.string().describe("Email account to create draft in"),
  to: z.array(z.string()).describe("Recipient email addresses"),
  subject: z.string().describe("Email subject"),
  text: z.string().optional().describe("Plain text body"),
  html: z.string().optional().describe("HTML body"),
  cc: z.array(z.string()).optional().describe("CC recipients"),
  bcc: z.array(z.string()).optional().describe("BCC recipients"),
});

export const UpdateDraftInput = z.object({
  email: z.string().describe("Email account that owns the draft"),
  uid: z.number().describe("UID of the existing draft to replace"),
  to: z.array(z.string()).describe("Recipient email addresses"),
  subject: z.string().describe("Email subject"),
  text: z.string().optional().describe("Plain text body"),
  html: z.string().optional().describe("HTML body"),
  cc: z.array(z.string()).optional().describe("CC recipients"),
  bcc: z.array(z.string()).optional().describe("BCC recipients"),
});

export const DeleteDraftInput = z.object({
  email: z.string().describe("Email account that owns the draft"),
  uid: z.number().describe("UID of the draft to delete"),
});

export const SendDraftInput = z.object({
  email: z.string().describe("Email account that owns the draft"),
  uid: z.number().describe("UID of the draft to send"),
});

export const ListReplyStatusesInput = z.object({});

export const SetReplyStatusInput = z.object({
  email: z.string().describe("Email account that owns the mailbox"),
  uid: z.number().describe("UID of the received reply in INBOX"),
  status: z.enum([
    "interested", "meeting_request", "information_request",
    "not_interested", "wrong_person", "do_not_contact",
    "out_of_office", "unsubscribed", "bounced",
  ]).describe("Reply status to set"),
  sent_uid: z.number().optional().describe("UID of the matching sent email (if known). Both emails get tagged."),
});

export const GetCampaignAnalyticsInput = z.object({
  email: z.string().describe("Email account to analyze"),
  campaign: z.string().describe("Campaign name (matches campaign_{name} tag)"),
});

export const CreateCampaignInput = z.object({
  email: z.string().describe("Email account that owns/sends the campaign"),
  name: z.string().describe("Campaign name (lowercase, no spaces — used as tag)"),
  audience_segment: z.string().describe("Audience segment to target (e.g. 'vip', 'general'). Contacts are pulled from this segment when the campaign starts."),
  sequence: z.array(z.object({
    step: z.number().describe("Step number (1 = initial, 2+ = follow-ups)"),
    delay_days: z.number().describe("Days to wait after previous step before sending"),
    variants: z.array(z.object({
      name: z.string().describe("Variant name (e.g. 'a', 'b')"),
      weight: z.number().describe("Selection weight (e.g. 50 for 50%)"),
      subject: z.string().describe("Subject line (supports {{firstName}}, {{lastName}}, {{email}}, {{company}}). Empty on step 2+ = reply in same thread."),
      text: z.string().optional().describe("Plain text body with {{placeholder}} support"),
      html: z.string().optional().describe("HTML body with {{placeholder}} support"),
    })),
  })).describe("Email sequence steps with A/B variants"),
});

export const ListCampaignsInput = z.object({
  email: z.string().describe("Email account to list campaigns for"),
});

export const GetCampaignInput = z.object({
  email: z.string().describe("Email account that owns the campaign"),
  campaign: z.string().describe("Campaign name"),
});

export const DeleteCampaignInput = z.object({
  email: z.string().describe("Email account that owns the campaign"),
  campaign: z.string().describe("Campaign name to delete"),
});

export const StartCampaignInput = z.object({
  email: z.string().describe("Email account to send from"),
  campaign: z.string().describe("Campaign name to execute"),
});

export const PingInput = z.object({});
