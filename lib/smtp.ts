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

  const mailOptions = {
    from: `${mailbox.firstName} ${mailbox.lastName} <${mailbox.email}>`,
    to: params.to.join(", "),
    cc: params.cc?.join(", "),
    bcc: params.bcc?.join(", "),
    subject: params.subject,
    text: params.text,
    html: params.html,
  };

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
