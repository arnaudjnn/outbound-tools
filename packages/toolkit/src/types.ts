import type { z } from "zod";

// --- Mailpool types ---

export interface DomainOwner {
  id: number;
  company: string;
  firstName: string;
  lastName: string;
  email: string;
  streetAddress1: string;
  streetAddress2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface Domain {
  id: number;
  createdAt: string;
  expireAt: string;
  domain: string;
  domainOwner: DomainOwner;
  redirectUrl: string;
  type: string;
  status: string;
}

/** Lightweight mailbox info returned by the list endpoint. */
export interface Mailbox {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  domain: Domain;
}

/** Full mailbox details returned by the single-mailbox endpoint, includes IMAP/SMTP credentials. */
export interface MailboxDetails extends Mailbox {
  signature: string;
  forwardTo: string;
  password: string;
  avatar: string;
  imapHost: string;
  imapPort: number;
  imapTLS: boolean;
  imapUsername: string;
  imapPassword: string;
  smtpHost: string;
  smtpPort: number;
  smtpTLS: boolean;
  smtpUsername: string;
  smtpPassword: string;
  type: string;
  isAdmin: boolean;
}

// --- MCP-style tool types ---

export interface ToolResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

export interface ToolAnnotations {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: z.ZodObject<any>;
  annotations: ToolAnnotations;
}
