import type { Mailbox, MailboxDetails } from "./types.js";
export declare function listMailboxes(): Promise<Mailbox[]>;
export declare function getMailboxById(id: number): Promise<MailboxDetails>;
export declare function getMailboxByEmail(email: string): Promise<MailboxDetails>;
//# sourceMappingURL=mailpool.d.ts.map