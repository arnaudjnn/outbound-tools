import { functionMap } from '@outbound-tools/toolkit';
import { parseResult, output } from '../output.js';
export function registerAccountsCommand(program) {
    const accounts = program.command('accounts').description('Manage email accounts');
    accounts
        .command('list')
        .description('List all email accounts')
        .action(async () => {
        const handler = functionMap['list_email_accounts'];
        if (!handler)
            throw new Error('list_email_accounts tool not available');
        const result = await handler({});
        const data = parseResult(result);
        output(program, data);
    });
    accounts
        .command('analytics <email>')
        .description('Get analytics for an email account')
        .action(async (email) => {
        const handler = functionMap['get_email_account_analytics'];
        if (!handler)
            throw new Error('get_email_account_analytics tool not available');
        const result = await handler({ email });
        const data = parseResult(result);
        output(program, data);
    });
}
