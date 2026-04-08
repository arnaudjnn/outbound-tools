#!/usr/bin/env node
import { Command } from 'commander';
import { registerAccountsCommand } from './commands/accounts.js';
import { registerEmailsCommand } from './commands/emails.js';
import { registerDraftsCommand } from './commands/drafts.js';
import { registerTagsCommand } from './commands/tags.js';
import { registerAudiencesCommand } from './commands/audiences.js';
import { registerCampaignsCommand } from './commands/campaigns.js';

const program = new Command();
program
  .name('outbound-tools')
  .description('CLI for email outreach tools')
  .version('0.1.0')
  .option('--json', 'Output raw JSON');

registerAccountsCommand(program);
registerEmailsCommand(program);
registerDraftsCommand(program);
registerTagsCommand(program);
registerAudiencesCommand(program);
registerCampaignsCommand(program);

program.parseAsync(process.argv).catch((err) => {
  console.error('Error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
