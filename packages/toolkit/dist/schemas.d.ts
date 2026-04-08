import { z } from "zod";
export declare const ListEmailAccountsInput: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
export declare const ListReceivedEmailsInput: z.ZodObject<{
    email: z.ZodString;
    limit: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    page: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    tag_filter: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    email: string;
    tag_filter?: string | undefined;
}, {
    email: string;
    page?: number | undefined;
    limit?: number | undefined;
    tag_filter?: string | undefined;
}>;
export declare const SendEmailInput: z.ZodObject<{
    from: z.ZodString;
    to: z.ZodArray<z.ZodString, "many">;
    subject: z.ZodString;
    text: z.ZodOptional<z.ZodString>;
    html: z.ZodOptional<z.ZodString>;
    cc: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    bcc: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    from: string;
    to: string[];
    subject: string;
    text?: string | undefined;
    html?: string | undefined;
    cc?: string[] | undefined;
    bcc?: string[] | undefined;
}, {
    from: string;
    to: string[];
    subject: string;
    text?: string | undefined;
    html?: string | undefined;
    cc?: string[] | undefined;
    bcc?: string[] | undefined;
}>;
export declare const ListSentEmailsInput: z.ZodObject<{
    email: z.ZodString;
    limit: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    page: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    tag_filter: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    email: string;
    tag_filter?: string | undefined;
}, {
    email: string;
    page?: number | undefined;
    limit?: number | undefined;
    tag_filter?: string | undefined;
}>;
export declare const ListThreadsInput: z.ZodObject<{
    email: z.ZodString;
    receivedLimit: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    sentLimit: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    unclassifiedOnly: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    email: string;
    receivedLimit: number;
    sentLimit: number;
    unclassifiedOnly: boolean;
}, {
    email: string;
    receivedLimit?: number | undefined;
    sentLimit?: number | undefined;
    unclassifiedOnly?: boolean | undefined;
}>;
export declare const GetEmailAccountAnalyticsInput: z.ZodObject<{
    email: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
}, {
    email: string;
}>;
export declare const AddEmailTagInput: z.ZodObject<{
    email: z.ZodString;
    uid: z.ZodNumber;
    tag: z.ZodString;
    folder: z.ZodDefault<z.ZodOptional<z.ZodEnum<["INBOX", "SENT"]>>>;
}, "strip", z.ZodTypeAny, {
    tag: string;
    uid: number;
    email: string;
    folder: "SENT" | "INBOX";
}, {
    tag: string;
    uid: number;
    email: string;
    folder?: "SENT" | "INBOX" | undefined;
}>;
export declare const RemoveEmailTagInput: z.ZodObject<{
    email: z.ZodString;
    uid: z.ZodNumber;
    tag: z.ZodString;
    folder: z.ZodDefault<z.ZodOptional<z.ZodEnum<["INBOX", "SENT"]>>>;
}, "strip", z.ZodTypeAny, {
    tag: string;
    uid: number;
    email: string;
    folder: "SENT" | "INBOX";
}, {
    tag: string;
    uid: number;
    email: string;
    folder?: "SENT" | "INBOX" | undefined;
}>;
export declare const AddToAudienceInput: z.ZodObject<{
    email: z.ZodString;
    segments: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    firstName: z.ZodOptional<z.ZodString>;
    lastName: z.ZodOptional<z.ZodString>;
    company: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    segments: string[];
    email: string;
    firstName?: string | undefined;
    lastName?: string | undefined;
    company?: string | undefined;
}, {
    email: string;
    segments?: string[] | undefined;
    firstName?: string | undefined;
    lastName?: string | undefined;
    company?: string | undefined;
}>;
export declare const RemoveFromAudienceInput: z.ZodObject<{
    email: z.ZodString;
    segments: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    segments: string[];
    email: string;
}, {
    segments: string[];
    email: string;
}>;
export declare const ListAudiencesInput: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
export declare const GetEmailInput: z.ZodObject<{
    email: z.ZodString;
    uid: z.ZodNumber;
    folder: z.ZodDefault<z.ZodOptional<z.ZodEnum<["INBOX", "SENT"]>>>;
}, "strip", z.ZodTypeAny, {
    uid: number;
    email: string;
    folder: "SENT" | "INBOX";
}, {
    uid: number;
    email: string;
    folder?: "SENT" | "INBOX" | undefined;
}>;
export declare const GetEmailRawInput: z.ZodObject<{
    email: z.ZodString;
    uid: z.ZodNumber;
    folder: z.ZodDefault<z.ZodOptional<z.ZodEnum<["INBOX", "SENT"]>>>;
}, "strip", z.ZodTypeAny, {
    uid: number;
    email: string;
    folder: "SENT" | "INBOX";
}, {
    uid: number;
    email: string;
    folder?: "SENT" | "INBOX" | undefined;
}>;
export declare const ReplyToEmailInput: z.ZodObject<{
    email: z.ZodString;
    uid: z.ZodNumber;
    folder: z.ZodDefault<z.ZodOptional<z.ZodEnum<["INBOX", "SENT"]>>>;
    text: z.ZodOptional<z.ZodString>;
    html: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    uid: number;
    email: string;
    folder: "SENT" | "INBOX";
    text?: string | undefined;
    html?: string | undefined;
}, {
    uid: number;
    email: string;
    text?: string | undefined;
    html?: string | undefined;
    folder?: "SENT" | "INBOX" | undefined;
}>;
export declare const ReplyAllToEmailInput: z.ZodObject<{
    email: z.ZodString;
    uid: z.ZodNumber;
    folder: z.ZodDefault<z.ZodOptional<z.ZodEnum<["INBOX", "SENT"]>>>;
    text: z.ZodOptional<z.ZodString>;
    html: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    uid: number;
    email: string;
    folder: "SENT" | "INBOX";
    text?: string | undefined;
    html?: string | undefined;
}, {
    uid: number;
    email: string;
    text?: string | undefined;
    html?: string | undefined;
    folder?: "SENT" | "INBOX" | undefined;
}>;
export declare const ForwardEmailInput: z.ZodObject<{
    email: z.ZodString;
    uid: z.ZodNumber;
    folder: z.ZodDefault<z.ZodOptional<z.ZodEnum<["INBOX", "SENT"]>>>;
    to: z.ZodArray<z.ZodString, "many">;
    text: z.ZodOptional<z.ZodString>;
    html: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    uid: number;
    to: string[];
    email: string;
    folder: "SENT" | "INBOX";
    text?: string | undefined;
    html?: string | undefined;
}, {
    uid: number;
    to: string[];
    email: string;
    text?: string | undefined;
    html?: string | undefined;
    folder?: "SENT" | "INBOX" | undefined;
}>;
export declare const DeleteEmailInput: z.ZodObject<{
    email: z.ZodString;
    uid: z.ZodNumber;
    folder: z.ZodDefault<z.ZodOptional<z.ZodEnum<["INBOX", "SENT"]>>>;
}, "strip", z.ZodTypeAny, {
    uid: number;
    email: string;
    folder: "SENT" | "INBOX";
}, {
    uid: number;
    email: string;
    folder?: "SENT" | "INBOX" | undefined;
}>;
export declare const GetThreadInput: z.ZodObject<{
    email: z.ZodString;
    subject: z.ZodString;
    limit: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    subject: string;
    email: string;
}, {
    subject: string;
    email: string;
    limit?: number | undefined;
}>;
export declare const GetAttachmentInput: z.ZodObject<{
    email: z.ZodString;
    uid: z.ZodNumber;
    index: z.ZodNumber;
    folder: z.ZodDefault<z.ZodOptional<z.ZodEnum<["INBOX", "SENT"]>>>;
}, "strip", z.ZodTypeAny, {
    uid: number;
    email: string;
    folder: "SENT" | "INBOX";
    index: number;
}, {
    uid: number;
    email: string;
    index: number;
    folder?: "SENT" | "INBOX" | undefined;
}>;
export declare const ListDraftsInput: z.ZodObject<{
    email: z.ZodString;
    limit: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    page: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    email: string;
}, {
    email: string;
    page?: number | undefined;
    limit?: number | undefined;
}>;
export declare const GetDraftInput: z.ZodObject<{
    email: z.ZodString;
    uid: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    uid: number;
    email: string;
}, {
    uid: number;
    email: string;
}>;
export declare const CreateDraftInput: z.ZodObject<{
    email: z.ZodString;
    to: z.ZodArray<z.ZodString, "many">;
    subject: z.ZodString;
    text: z.ZodOptional<z.ZodString>;
    html: z.ZodOptional<z.ZodString>;
    cc: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    bcc: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    to: string[];
    subject: string;
    email: string;
    text?: string | undefined;
    html?: string | undefined;
    cc?: string[] | undefined;
    bcc?: string[] | undefined;
}, {
    to: string[];
    subject: string;
    email: string;
    text?: string | undefined;
    html?: string | undefined;
    cc?: string[] | undefined;
    bcc?: string[] | undefined;
}>;
export declare const UpdateDraftInput: z.ZodObject<{
    email: z.ZodString;
    uid: z.ZodNumber;
    to: z.ZodArray<z.ZodString, "many">;
    subject: z.ZodString;
    text: z.ZodOptional<z.ZodString>;
    html: z.ZodOptional<z.ZodString>;
    cc: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    bcc: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    uid: number;
    to: string[];
    subject: string;
    email: string;
    text?: string | undefined;
    html?: string | undefined;
    cc?: string[] | undefined;
    bcc?: string[] | undefined;
}, {
    uid: number;
    to: string[];
    subject: string;
    email: string;
    text?: string | undefined;
    html?: string | undefined;
    cc?: string[] | undefined;
    bcc?: string[] | undefined;
}>;
export declare const DeleteDraftInput: z.ZodObject<{
    email: z.ZodString;
    uid: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    uid: number;
    email: string;
}, {
    uid: number;
    email: string;
}>;
export declare const SendDraftInput: z.ZodObject<{
    email: z.ZodString;
    uid: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    uid: number;
    email: string;
}, {
    uid: number;
    email: string;
}>;
export declare const ListReplyStatusesInput: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
export declare const SetReplyStatusInput: z.ZodObject<{
    email: z.ZodString;
    uid: z.ZodNumber;
    status: z.ZodEnum<["interested", "meeting_request", "information_request", "not_interested", "wrong_person", "do_not_contact", "out_of_office", "unsubscribed", "bounced"]>;
    sent_uid: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    status: "interested" | "meeting_request" | "information_request" | "not_interested" | "wrong_person" | "do_not_contact" | "out_of_office" | "unsubscribed" | "bounced";
    uid: number;
    email: string;
    sent_uid?: number | undefined;
}, {
    status: "interested" | "meeting_request" | "information_request" | "not_interested" | "wrong_person" | "do_not_contact" | "out_of_office" | "unsubscribed" | "bounced";
    uid: number;
    email: string;
    sent_uid?: number | undefined;
}>;
export declare const GetCampaignAnalyticsInput: z.ZodObject<{
    email: z.ZodString;
    campaign: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    campaign: string;
}, {
    email: string;
    campaign: string;
}>;
export declare const CreateCampaignInput: z.ZodObject<{
    email: z.ZodString;
    name: z.ZodString;
    audience_segment: z.ZodString;
    sequence: z.ZodArray<z.ZodObject<{
        step: z.ZodNumber;
        delay_days: z.ZodNumber;
        variants: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            weight: z.ZodNumber;
            subject: z.ZodString;
            text: z.ZodOptional<z.ZodString>;
            html: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            subject: string;
            weight: number;
            text?: string | undefined;
            html?: string | undefined;
        }, {
            name: string;
            subject: string;
            weight: number;
            text?: string | undefined;
            html?: string | undefined;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        step: number;
        delay_days: number;
        variants: {
            name: string;
            subject: string;
            weight: number;
            text?: string | undefined;
            html?: string | undefined;
        }[];
    }, {
        step: number;
        delay_days: number;
        variants: {
            name: string;
            subject: string;
            weight: number;
            text?: string | undefined;
            html?: string | undefined;
        }[];
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    name: string;
    email: string;
    audience_segment: string;
    sequence: {
        step: number;
        delay_days: number;
        variants: {
            name: string;
            subject: string;
            weight: number;
            text?: string | undefined;
            html?: string | undefined;
        }[];
    }[];
}, {
    name: string;
    email: string;
    audience_segment: string;
    sequence: {
        step: number;
        delay_days: number;
        variants: {
            name: string;
            subject: string;
            weight: number;
            text?: string | undefined;
            html?: string | undefined;
        }[];
    }[];
}>;
export declare const ListCampaignsInput: z.ZodObject<{
    email: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
}, {
    email: string;
}>;
export declare const GetCampaignInput: z.ZodObject<{
    email: z.ZodString;
    campaign: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    campaign: string;
}, {
    email: string;
    campaign: string;
}>;
export declare const DeleteCampaignInput: z.ZodObject<{
    email: z.ZodString;
    campaign: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    campaign: string;
}, {
    email: string;
    campaign: string;
}>;
export declare const StartCampaignInput: z.ZodObject<{
    email: z.ZodString;
    campaign: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    campaign: string;
}, {
    email: string;
    campaign: string;
}>;
export declare const PingInput: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
//# sourceMappingURL=schemas.d.ts.map