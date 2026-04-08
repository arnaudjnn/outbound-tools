import type { MailboxDetails } from "./types.js";
interface SendEmailParams {
    to: string[];
    subject: string;
    text?: string;
    html?: string;
    cc?: string[];
    bcc?: string[];
    inReplyTo?: string;
    references?: string;
    attachments?: Array<{
        filename: string;
        content: Buffer;
        contentType: string;
    }>;
}
export declare function sendEmail(mailbox: MailboxDetails, params: SendEmailParams): Promise<{
    messageId: string;
    accepted: string[];
    rejected: string[];
    raw: Buffer<ArrayBufferLike>;
}>;
export declare function composeDraft(mailbox: MailboxDetails, params: SendEmailParams): Promise<Buffer>;
export {};
//# sourceMappingURL=smtp.d.ts.map