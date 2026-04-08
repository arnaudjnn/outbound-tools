import type { Command } from 'commander';
import { functionMap } from '@outbound-tools/toolkit';
import { parseResult, output } from '../output.js';

export function registerAudiencesCommand(program: Command) {
  const audiences = program.command('audiences').description('Manage audience segments');

  audiences
    .command('list')
    .description('List all audience segments with contacts')
    .action(async () => {
      const handler = functionMap['list_audiences'];
      if (!handler) throw new Error('list_audiences tool not available');
      const result = await handler({});
      const data = parseResult(result);
      output(program, data);
    });

  audiences
    .command('add <email>')
    .description('Add a contact to audience segments')
    .option('--segments <segments>', 'Comma-separated segments', 'general')
    .option('--first-name <name>', 'Contact first name')
    .option('--last-name <name>', 'Contact last name')
    .option('--company <company>', 'Contact company name')
    .action(async (email: string, opts: { segments: string; firstName?: string; lastName?: string; company?: string }) => {
      const handler = functionMap['add_to_audience'];
      if (!handler) throw new Error('add_to_audience tool not available');
      const params: Record<string, unknown> = {
        email,
        segments: opts.segments.split(',').map((s) => s.trim()),
      };
      if (opts.firstName) params.firstName = opts.firstName;
      if (opts.lastName) params.lastName = opts.lastName;
      if (opts.company) params.company = opts.company;
      const result = await handler(params);
      const data = parseResult(result);
      output(program, data);
    });

  audiences
    .command('remove <email>')
    .description('Remove a contact from audience segments')
    .requiredOption('--segments <segments>', 'Comma-separated segments to remove')
    .action(async (email: string, opts: { segments: string }) => {
      const handler = functionMap['remove_from_audience'];
      if (!handler) throw new Error('remove_from_audience tool not available');
      const result = await handler({
        email,
        segments: opts.segments.split(',').map((s) => s.trim()),
      });
      const data = parseResult(result);
      output(program, data);
    });
}
