import { functionMap } from '@outbound-tools/toolkit';
import { parseResult, output } from '../output.js';
export function registerCampaignsCommand(program) {
    const campaigns = program.command('campaigns').description('Manage email campaigns');
    campaigns
        .command('list <email>')
        .description('List campaigns for an email account')
        .action(async (email) => {
        const handler = functionMap['list_campaigns'];
        if (!handler)
            throw new Error('list_campaigns tool not available');
        const result = await handler({ email });
        const data = parseResult(result);
        output(program, data);
    });
    campaigns
        .command('get <email> <name>')
        .description('Get campaign configuration')
        .action(async (email, name) => {
        const handler = functionMap['get_campaign'];
        if (!handler)
            throw new Error('get_campaign tool not available');
        const result = await handler({ email, campaign: name });
        const data = parseResult(result);
        output(program, data);
    });
    campaigns
        .command('start <email> <name>')
        .description('Start or continue a campaign (sends next step to eligible contacts)')
        .action(async (email, name) => {
        const handler = functionMap['start_campaign'];
        if (!handler)
            throw new Error('start_campaign tool not available');
        const result = await handler({ email, campaign: name });
        const data = parseResult(result);
        output(program, data);
    });
    campaigns
        .command('analytics <email> <name>')
        .description('Get campaign analytics and performance metrics')
        .action(async (email, name) => {
        const handler = functionMap['get_campaign_analytics'];
        if (!handler)
            throw new Error('get_campaign_analytics tool not available');
        const result = await handler({ email, campaign: name });
        const data = parseResult(result);
        output(program, data);
    });
    campaigns
        .command('delete <email> <name>')
        .description('Delete a campaign configuration')
        .action(async (email, name) => {
        const handler = functionMap['delete_campaign'];
        if (!handler)
            throw new Error('delete_campaign tool not available');
        const result = await handler({ email, campaign: name });
        const data = parseResult(result);
        output(program, data);
    });
}
