import { ImapFlow } from "imapflow";
import type { MailboxDetails } from "./types.js";
export declare function normalizeSubject(subject: string): string;
export declare function extractEmail(from: string): string;
export interface ThreadMatch {
    receivedUid: number;
    receivedSubject: string;
    receivedFrom: string;
    receivedDate: string;
    receivedPreview: string;
    sentUid: number;
    sentSubject: string;
    sentTo: string;
    sentDate: string;
    sentPreview: string;
}
export declare function matchRepliesToSent(received: EmailMessage[], sent: EmailMessage[]): {
    matches: ThreadMatch[];
    unmatchedUids: number[];
};
export declare function findSentFolder(client: ImapFlow, host: string): Promise<string>;
export declare function filterByTagExpression(emails: EmailMessage[], filter: string): EmailMessage[];
export interface EmailMessage {
    uid: number;
    flags: string[];
    subject: string;
    from: string;
    to: string;
    date: string;
    preview: string;
}
export interface EmailAttachmentMeta {
    index: number;
    filename: string;
    contentType: string;
    size: number;
}
export interface EmailDetail extends EmailMessage {
    text: string;
    html: string;
    cc: string;
    messageId: string;
    inReplyTo: string;
    references: string;
    attachments: EmailAttachmentMeta[];
}
export interface EmailHeaders {
    messageId: string;
    inReplyTo: string;
    references: string;
    subject: string;
    from: string;
    to: string;
    cc: string;
    date: string;
    text: string;
    html: string;
    attachments: Array<{
        filename: string;
        content: Buffer;
        contentType: string;
    }>;
}
export interface EmailPage {
    emails: EmailMessage[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}
export declare function resolveFolder(mailbox: MailboxDetails, folder: string): Promise<string>;
export declare function listFolders(mailbox: MailboxDetails): Promise<string[]>;
export declare function fetchEmails(mailbox: MailboxDetails, folder: string, limit: number, page?: number): Promise<EmailPage>;
export declare function appendToSent(mailbox: MailboxDetails, raw: Buffer): Promise<void>;
export declare function fetchSentEmails(mailbox: MailboxDetails, limit: number, page?: number): Promise<EmailPage>;
export declare function setEmailFlag(mailbox: MailboxDetails, folder: string, uid: number, flag: string): Promise<void>;
export declare function removeEmailFlag(mailbox: MailboxDetails, folder: string, uid: number, flag: string): Promise<void>;
export declare function countByKeyword(mailbox: MailboxDetails, folder: string, keyword: string): Promise<number>;
export declare function addAudienceSegments(mailbox: MailboxDetails, folder: string, contactEmail: string, segments: string[]): Promise<number>;
export declare function removeAudienceSegments(mailbox: MailboxDetails, folder: string, contactEmail: string, segments: string[]): Promise<number>;
export declare function removeContactMarkerSegments(mailbox: MailboxDetails, contactEmail: string, segments: string[]): Promise<void>;
export interface AudienceSegment {
    name: string;
    contacts: string[];
}
export declare function listAudienceSegments(mailbox: MailboxDetails, folder: string): Promise<AudienceSegment[]>;
export interface ContactMetadata {
    email: string;
    firstName?: string;
    lastName?: string;
    company?: string;
}
export declare function upsertContactMarker(mailbox: MailboxDetails, contact: ContactMetadata, segments: string[]): Promise<void>;
export declare function listContactMarkers(mailbox: MailboxDetails): Promise<Array<ContactMetadata & {
    segments: string[];
}>>;
export declare function getContactMetadataByEmails(mailbox: MailboxDetails, emails: string[]): Promise<Map<string, ContactMetadata>>;
export declare function listAudienceSegmentsWithContacts(mailbox: MailboxDetails, folder: string): Promise<AudienceSegment[]>;
export declare function fetchUnclassifiedEmails(mailbox: MailboxDetails, folder: string, limit: number): Promise<EmailMessage[]>;
export declare function fetchEmailByUid(mailbox: MailboxDetails, folder: string, uid: number): Promise<EmailDetail>;
export declare function fetchEmailRawByUid(mailbox: MailboxDetails, folder: string, uid: number): Promise<Buffer>;
export declare function deleteEmail(mailbox: MailboxDetails, folder: string, uid: number): Promise<void>;
export declare function findDraftsFolder(client: ImapFlow, host: string): Promise<string>;
export declare function resolveDraftsFolder(mailbox: MailboxDetails): Promise<string>;
export declare function fetchDrafts(mailbox: MailboxDetails, limit: number, page?: number): Promise<EmailPage>;
export declare function saveDraft(mailbox: MailboxDetails, raw: Buffer): Promise<void>;
export declare function deleteDraft(mailbox: MailboxDetails, uid: number): Promise<void>;
export declare function fetchAttachmentByUid(mailbox: MailboxDetails, folder: string, uid: number, attachmentIndex: number): Promise<{
    filename: string;
    contentType: string;
    content: string;
    size: number;
}>;
export interface CampaignVariant {
    name: string;
    weight: number;
    subject: string;
    text?: string;
    html?: string;
}
export interface CampaignStep {
    step: number;
    delay_days: number;
    variants: CampaignVariant[];
}
export interface CampaignConfig {
    name: string;
    audience_segment: string;
    sequence: CampaignStep[];
    created_at: string;
}
export declare function saveCampaignConfig(mailbox: MailboxDetails, config: CampaignConfig): Promise<void>;
export declare function loadCampaignConfig(mailbox: MailboxDetails, name: string): Promise<CampaignConfig>;
export declare function listCampaignConfigs(mailbox: MailboxDetails): Promise<Array<{
    name: string;
    uid: number;
}>>;
export declare function deleteCampaignConfig(mailbox: MailboxDetails, name: string): Promise<void>;
export declare function getEmailHeaders(mailbox: MailboxDetails, folder: string, uid: number): Promise<EmailHeaders>;
//# sourceMappingURL=imap.d.ts.map