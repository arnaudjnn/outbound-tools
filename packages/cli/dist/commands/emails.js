import { functionMap } from '@outbound-tools/toolkit';
import { parseResult, output } from '../output.js';
export function registerEmailsCommand(program) {
    const emails = program.command('emails').description('Manage emails');
    emails
        .command('list <email>')
        .description('List received or sent emails')
        .option('--sent', 'List sent emails instead of received')
        .option('--limit <n>', 'Emails per page', '50')
        .option('--page <n>', 'Page number', '1')
        .option('--tag-filter <expr>', 'Boolean tag filter expression')
        .action(async (email, opts) => {
        const toolName = opts.sent ? 'list_sent_emails' : 'list_received_emails';
        const handler = functionMap[toolName];
        if (!handler)
            throw new Error(`${toolName} tool not available`);
        const params = {
            email,
            limit: parseInt(opts.limit, 10),
            page: parseInt(opts.page, 10),
        };
        if (opts.tagFilter)
            params.tag_filter = opts.tagFilter;
        const result = await handler(params);
        const data = parseResult(result);
        output(program, data);
    });
    emails
        .command('get <email> <uid>')
        .description('Get a specific email by UID')
        .option('--folder <folder>', 'Folder: INBOX or SENT', 'INBOX')
        .action(async (email, uid, opts) => {
        const handler = functionMap['get_email'];
        if (!handler)
            throw new Error('get_email tool not available');
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
        .action(async (from, opts) => {
        const handler = functionMap['send_email'];
        if (!handler)
            throw new Error('send_email tool not available');
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
        .action(async (email, uid, opts) => {
        const handler = functionMap['reply_to_email'];
        if (!handler)
            throw new Error('reply_to_email tool not available');
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
        .action(async (email, uid, opts) => {
        const handler = functionMap['delete_email'];
        if (!handler)
            throw new Error('delete_email tool not available');
        const result = await handler({ email, uid: parseInt(uid, 10), folder: opts.folder });
        const data = parseResult(result);
        output(program, data);
    });
    emails
        .command('threads <email>')
        .description('List email threads (match received to sent)')
        .action(async (email) => {
        const handler = functionMap['list_threads'];
        if (!handler)
            throw new Error('list_threads tool not available');
        const result = await handler({ email });
        const data = parseResult(result);
        output(program, data);
    });
}
