import type { Command } from 'commander';
import { functionMap } from '@outbound-tools/toolkit';
import { parseResult, output } from '../output.js';

export function registerEmailsCommand(program: Command) {
  const emails = program.command('emails').description('Manage emails');

  emails
    .command('list <email>')
    .description('List received or sent emails')
    .option('--sent', 'List sent emails instead of received')
    .option('--limit <n>', 'Emails per page', '50')
    .option('--page <n>', 'Page number', '1')
    .option('--tag-filter <expr>', 'Boolean tag filter expression')
    .action(async (email: string, opts: { sent?: boolean; limit: string; page: string; tagFilter?: string }) => {
      const toolName = opts.sent ? 'list_sent_emails' : 'list_received_emails';
      const handler = functionMap[toolName];
      if (!handler) throw new Error(`${toolName} tool not available`);
      const params: Record<string, unknown> = {
        email,
        limit: parseInt(opts.limit, 10),
        page: parseInt(opts.page, 10),
      };
      if (opts.tagFilter) params.tag_filter = opts.tagFilter;
      const result = await handler(params);
      const data = parseResult(result);
      output(program, data);
    });

  emails
    .command('get <email> <uid>')
    .description('Get a specific email by UID')
    .option('--folder <folder>', 'Folder: INBOX or SENT', 'INBOX')
    .action(async (email: string, uid: string, opts: { folder: string }) => {
      const handler = functionMap['get_email'];
      if (!handler) throw new Error('get_email tool not available');
      const result = await handler({ email, uid: parseInt(uid, 10), folder: opts.folder });
      const data = parseResult(result);
      output(program, data);
    });

  emails
    .command('send <from>')
    .description('Send an email')
    .requiredOption('--to <addresses>', 'Recipient email addresses (comma-separated)')
    .requiredOption('--subject <subject>', 'Email subject')
    .option('--text <body>', 'Plain text body')
    .option('--html <body>', 'HTML body')
    .action(async (from: string, opts: { to: string; subject: string; text?: string; html?: string }) => {
      const handler = functionMap['send_email'];
      if (!handler) throw new Error('send_email tool not available');
      const result = await handler({
        from,
        to: opts.to.split(',').map((s) => s.trim()),
        subject: opts.subject,
        text: opts.text,
        html: opts.html,
      });
      const data = parseResult(result);
      output(program, data);
    });

  emails
    .command('reply <email> <uid>')
    .description('Reply to an email')
    .option('--text <body>', 'Plain text reply body')
    .option('--html <body>', 'HTML reply body')
    .action(async (email: string, uid: string, opts: { text?: string; html?: string }) => {
      const handler = functionMap['reply_to_email'];
      if (!handler) throw new Error('reply_to_email tool not available');
      const result = await handler({
        email,
        uid: parseInt(uid, 10),
        text: opts.text,
        html: opts.html,
      });
      const data = parseResult(result);
      output(program, data);
    });

  emails
    .command('delete <email> <uid>')
    .description('Delete an email')
    .option('--folder <folder>', 'Folder: INBOX or SENT', 'INBOX')
    .action(async (email: string, uid: string, opts: { folder: string }) => {
      const handler = functionMap['delete_email'];
      if (!handler) throw new Error('delete_email tool not available');
      const result = await handler({ email, uid: parseInt(uid, 10), folder: opts.folder });
      const data = parseResult(result);
      output(program, data);
    });

  emails
    .command('threads <email>')
    .description('List all conversation threads for one account via RFC References/In-Reply-To headers')
    .option('--folders <list>', 'Comma-separated folders to scan', 'INBOX,SENT')
    .option('--limit <n>', 'Max messages to scan per folder', '500')
    .option('--messages', 'Include per-message details in each thread')
    .option('--no-subject-fallback', 'Do not group header-less messages by subject')
    .action(async (email: string, opts: { folders: string; limit: string; messages?: boolean; subjectFallback: boolean }) => {
      const handler = functionMap['list_threads'];
      if (!handler) throw new Error('list_threads tool not available');
      const result = await handler({
        email,
        folders: opts.folders.split(',').map((s) => s.trim()).filter(Boolean),
        limit: parseInt(opts.limit, 10),
        includeMessages: Boolean(opts.messages),
        subjectFallback: opts.subjectFallback,
      });
      const data = parseResult(result);
      output(program, data);
    });

  emails
    .command('threads-all')
    .description('List conversation threads across every registered account')
    .option('--folders <list>', 'Comma-separated folders to scan', 'INBOX,SENT')
    .option('--limit <n>', 'Max messages to scan per folder', '500')
    .option('--messages', 'Include per-message details in each thread')
    .option('--no-subject-fallback', 'Do not group header-less messages by subject')
    .action(async (opts: { folders: string; limit: string; messages?: boolean; subjectFallback: boolean }) => {
      const handler = functionMap['list_all_account_threads'];
      if (!handler) throw new Error('list_all_account_threads tool not available');
      const result = await handler({
        folders: opts.folders.split(',').map((s) => s.trim()).filter(Boolean),
        limit: parseInt(opts.limit, 10),
        includeMessages: Boolean(opts.messages),
        subjectFallback: opts.subjectFallback,
      });
      const data = parseResult(result);
      output(program, data);
    });
}
