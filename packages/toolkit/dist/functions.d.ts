import type { z } from "zod";
import type { ListReceivedEmailsInput, SendEmailInput, ListSentEmailsInput, ListThreadsInput, GetEmailAccountAnalyticsInput, AddEmailTagInput, RemoveEmailTagInput, AddToAudienceInput, RemoveFromAudienceInput, GetEmailInput, GetEmailRawInput, ReplyToEmailInput, ReplyAllToEmailInput, ForwardEmailInput, DeleteEmailInput, GetThreadInput, GetAttachmentInput, ListDraftsInput, GetDraftInput, CreateDraftInput, UpdateDraftInput, DeleteDraftInput, SendDraftInput, SetReplyStatusInput, GetCampaignAnalyticsInput, CreateCampaignInput, ListCampaignsInput, GetCampaignInput, DeleteCampaignInput, StartCampaignInput } from "./schemas.js";
export declare const REPLY_STATUSES: {
    tag: string;
    description: string;
}[];
export declare const STATUS_TAGS: string[];
export declare const TERMINAL_STATUSES: string[];
export declare function list_email_accounts(): Promise<{
    id: number;
    email: string;
    firstName: string;
    lastName: string;
    status: string;
    domain: import("./types.js").Domain;
}[]>;
export declare function list_received_emails(params: z.infer<typeof ListReceivedEmailsInput>): Promise<import("./imap.js").EmailPage>;
export declare function send_email(params: z.infer<typeof SendEmailInput>): Promise<{
    messageId: string;
    accepted: string[];
    rejected: string[];
}>;
export declare function list_sent_emails(params: z.infer<typeof ListSentEmailsInput>): Promise<import("./imap.js").EmailPage>;
export declare function list_threads(params: z.infer<typeof ListThreadsInput>): Promise<{
    totalChecked: number;
    matches: import("./imap.js").ThreadMatch[];
    unmatchedUids: number[];
}>;
export declare function get_email_account_analytics(params: z.infer<typeof GetEmailAccountAnalyticsInput>): Promise<{
    totalSent: number;
    statuses: {};
    rates: {};
    totalReplied?: undefined;
    replyRate?: undefined;
} | {
    totalSent: number;
    totalReplied: number;
    replyRate: number;
    statuses: Record<string, number>;
    rates: Record<string, number>;
}>;
export declare function add_email_tag(params: z.infer<typeof AddEmailTagInput>): Promise<{
    message: string;
}>;
export declare function remove_email_tag(params: z.infer<typeof RemoveEmailTagInput>): Promise<{
    message: string;
}>;
export declare function add_to_audience(params: z.infer<typeof AddToAudienceInput>): Promise<{
    message: string;
}>;
export declare function remove_from_audience(params: z.infer<typeof RemoveFromAudienceInput>): Promise<{
    message: string;
}>;
export declare function list_audiences(): Promise<{
    segments: {
        name: string;
        count: number;
        contacts: string[];
    }[];
}>;
export declare function get_email(params: z.infer<typeof GetEmailInput>): Promise<import("./imap.js").EmailDetail>;
export declare function get_email_raw(params: z.infer<typeof GetEmailRawInput>): Promise<string>;
export declare function reply_to_email(params: z.infer<typeof ReplyToEmailInput>): Promise<{
    messageId: string;
    accepted: string[];
    rejected: string[];
    inReplyTo: string;
}>;
export declare function reply_all_to_email(params: z.infer<typeof ReplyAllToEmailInput>): Promise<{
    messageId: string;
    accepted: string[];
    rejected: string[];
    inReplyTo: string;
}>;
export declare function forward_email(params: z.infer<typeof ForwardEmailInput>): Promise<{
    messageId: string;
    accepted: string[];
    rejected: string[];
    forwardedFrom: string;
}>;
export declare function delete_email_fn(params: z.infer<typeof DeleteEmailInput>): Promise<{
    message: string;
}>;
export declare function get_thread(params: z.infer<typeof GetThreadInput>): Promise<{
    subject: string;
    messageCount: number;
    senders: string[];
    messages: import("./imap.js").EmailMessage[];
}>;
export declare function get_attachment(params: z.infer<typeof GetAttachmentInput>): Promise<{
    filename: string;
    contentType: string;
    size: number;
    content_base64: string;
}>;
export declare function list_drafts(params: z.infer<typeof ListDraftsInput>): Promise<import("./imap.js").EmailPage>;
export declare function get_draft(params: z.infer<typeof GetDraftInput>): Promise<import("./imap.js").EmailDetail>;
export declare function create_draft(params: z.infer<typeof CreateDraftInput>): Promise<{
    message: string;
}>;
export declare function update_draft(params: z.infer<typeof UpdateDraftInput>): Promise<{
    message: string;
}>;
export declare function delete_draft_fn(params: z.infer<typeof DeleteDraftInput>): Promise<{
    message: string;
}>;
export declare function send_draft(params: z.infer<typeof SendDraftInput>): Promise<{
    messageId: string;
    accepted: string[];
    rejected: string[];
    draftDeleted: boolean;
}>;
export declare function list_reply_statuses(): Promise<{
    statuses: {
        tag: string;
        description: string;
    }[];
}>;
export declare function set_reply_status(params: z.infer<typeof SetReplyStatusInput>): Promise<{
    message: string;
}>;
export declare function get_campaign_analytics(params: z.infer<typeof GetCampaignAnalyticsInput>): Promise<{
    campaign: string;
    totalSent: number;
    message: string;
    uniqueContacts?: undefined;
    totalReplied?: undefined;
    replyRate?: undefined;
    repliesDetected?: undefined;
    statuses?: undefined;
    statusRates?: undefined;
    steps?: undefined;
    variants?: undefined;
} | {
    campaign: string;
    totalSent: number;
    uniqueContacts: number;
    totalReplied: number;
    replyRate: number;
    repliesDetected: number;
    statuses: Record<string, number>;
    statusRates: {
        [k: string]: number;
    };
    steps: Record<string, {
        sent: number;
        variants: Record<string, number>;
    }>;
    variants: Record<string, Record<string, number>>;
    message?: undefined;
}>;
export declare function create_campaign(params: z.infer<typeof CreateCampaignInput>): Promise<{
    campaign: string;
    audience_segment: string;
    steps: number;
    totalVariants: number;
    status: string;
}>;
export declare function list_campaigns(params: z.infer<typeof ListCampaignsInput>): Promise<{
    campaigns: {
        name: string;
        uid: number;
    }[];
}>;
export declare function get_campaign(params: z.infer<typeof GetCampaignInput>): Promise<import("./imap.js").CampaignConfig>;
export declare function delete_campaign_fn(params: z.infer<typeof DeleteCampaignInput>): Promise<{
    message: string;
}>;
export declare function start_campaign(params: z.infer<typeof StartCampaignInput>): Promise<{
    campaign: string;
    audience_segment: string;
    summary: {
        sent: number;
        skipped: number;
        errors: number;
        total: number;
    };
    results: {
        contact: string;
        step: number;
        variant: string;
        status: string;
    }[];
}>;
export declare function ping(): Promise<{
    message: string;
}>;
export declare const functionMap: Record<string, (params: any) => Promise<any>>;
//# sourceMappingURL=functions.d.ts.map