import nodemailer from "nodemailer";
// @ts-ignore -- nodemailer internal module
// @ts-ignore nodemailer internal
import MailComposer from "nodemailer/lib/mail-composer";
export async function sendEmail(mailbox, params) {
    const transport = nodemailer.createTransport({
        host: mailbox.smtpHost,
        port: mailbox.smtpPort,
        secure: mailbox.smtpTLS,
        auth: {
            user: mailbox.smtpUsername,
            pass: mailbox.smtpPassword,
        },
    });
    const mailOptions = {
        from: `${mailbox.firstName} ${mailbox.lastName} <${mailbox.email}>`,
        to: params.to.join(", "),
        cc: params.cc?.join(", "),
        bcc: params.bcc?.join(", "),
        subject: params.subject,
        text: params.text,
        html: params.html,
    };
    if (params.inReplyTo)
        mailOptions.inReplyTo = params.inReplyTo;
    if (params.references)
        mailOptions.references = params.references;
    if (params.attachments?.length) {
        mailOptions.attachments = params.attachments.map((a) => ({
            filename: a.filename,
            content: a.content,
            contentType: a.contentType,
        }));
    }
    const info = await transport.sendMail(mailOptions);
    // Build raw RFC822 message for IMAP Sent folder append
    const composer = new MailComposer(mailOptions);
    const raw = await composer.compile().build();
    return {
        messageId: info.messageId,
        accepted: info.accepted,
        rejected: info.rejected,
        raw,
    };
}
// Builds a raw RFC822 message without sending (for saving as draft).
export async function composeDraft(mailbox, params) {
    const mailOptions = {
        from: `${mailbox.firstName} ${mailbox.lastName} <${mailbox.email}>`,
        to: params.to.join(", "),
        cc: params.cc?.join(", "),
        bcc: params.bcc?.join(", "),
        subject: params.subject,
        text: params.text,
        html: params.html,
    };
    if (params.inReplyTo)
        mailOptions.inReplyTo = params.inReplyTo;
    if (params.references)
        mailOptions.references = params.references;
    if (params.attachments?.length) {
        mailOptions.attachments = params.attachments.map((a) => ({
            filename: a.filename,
            content: a.content,
            contentType: a.contentType,
        }));
    }
    const composer = new MailComposer(mailOptions);
    return composer.compile().build();
}
