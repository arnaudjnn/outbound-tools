import nodemailer from "nodemailer";
import MailComposer from "nodemailer/lib/mail-composer";
import type { MailboxDetails } from "@/lib/mailpool";

interface SendEmailParams {
  to: string[];
  subject: string;
  text?: string;
  html?: string;
  cc?: string[];
  bcc?: string[];
  inReplyTo?: string;
  references?: string;
  attachments?: Array<{ filename: string; content: Buffer; contentType: string }>;
}

export async function sendEmail(mailbox: MailboxDetails, params: SendEmailParams) {
  const transport = nodemailer.createTransport({
    host: mailbox.smtpHost,
    port: mailbox.smtpPort,
    secure: mailbox.smtpTLS,
    auth: {
      user: mailbox.smtpUsername,
      pass: mailbox.smtpPassword,
    },
  });

  const mailOptions: Record<string, unknown> = {
    from: `${mailbox.firstName} ${mailbox.lastName} <${mailbox.email}>`,
    to: params.to.join(", "),
    cc: params.cc?.join(", "),
    bcc: params.bcc?.join(", "),
    subject: params.subject,
    text: params.text,
    html: params.html,
  };

  if (params.inReplyTo) mailOptions.inReplyTo = params.inReplyTo;
  if (params.references) mailOptions.references = params.references;
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
  const raw: Buffer = await composer.compile().build();

  return {
    messageId: info.messageId,
    accepted: info.accepted as string[],
    rejected: info.rejected as string[],
    raw,
  };
}

// Builds a raw RFC822 message without sending (for saving as draft).
export async function composeDraft(mailbox: MailboxDetails, params: SendEmailParams): Promise<Buffer> {
  const mailOptions: Record<string, unknown> = {
    from: `${mailbox.firstName} ${mailbox.lastName} <${mailbox.email}>`,
    to: params.to.join(", "),
    cc: params.cc?.join(", "),
    bcc: params.bcc?.join(", "),
    subject: params.subject,
    text: params.text,
    html: params.html,
  };

  if (params.inReplyTo) mailOptions.inReplyTo = params.inReplyTo;
  if (params.references) mailOptions.references = params.references;
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
