import { functionMap } from '@outbound-tools/toolkit';
import { parseResult, output } from '../output.js';
export function registerDraftsCommand(program) {
    const drafts = program.command('drafts').description('Manage email drafts');
    drafts
        .command('list <email>')
        .description('List drafts for an email account')
        .action(async (email) => {
        const handler = functionMap['list_drafts'];
        if (!handler)
            throw new Error('list_drafts tool not available');
        const result = await handler({ email });
        const data = parseResult(result);
        output(program, data);
    });
    drafts
        .command('create <email>')
        .description('Create a new draft')
        .requiredOption('--to <addresses>', 'Recipient email addresses (comma-separated)')
        .requiredOption('--subject <subject>', 'Email subject')
        .option('--text <body>', 'Plain text body')
        .option('--html <body>', 'HTML body')
        .action(async (email, opts) => {
        const handler = functionMap['create_draft'];
        if (!handler)
            throw new Error('create_draft tool not available');
        const result = await handler({
            email,
            to: opts.to.split(',').map((s) => s.trim()),
            subject: opts.subject,
            text: opts.text,
            html: opts.html,
        });
        const data = parseResult(result);
        output(program, data);
    });
    drafts
        .command('send <email> <uid>')
        .description('Send an existing draft')
        .action(async (email, uid) => {
        const handler = functionMap['send_draft'];
        if (!handler)
            throw new Error('send_draft tool not available');
        const result = await handler({ email, uid: parseInt(uid, 10) });
        const data = parseResult(result);
        output(program, data);
    });
    drafts
        .command('delete <email> <uid>')
        .description('Delete a draft')
        .action(async (email, uid) => {
        const handler = functionMap['delete_draft'];
        if (!handler)
            throw new Error('delete_draft tool not available');
        const result = await handler({ email, uid: parseInt(uid, 10) });
        const data = parseResult(result);
        output(program, data);
    });
}
