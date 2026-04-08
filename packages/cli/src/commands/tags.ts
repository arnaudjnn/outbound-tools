import type { Command } from 'commander';
import { functionMap } from '@outbound-tools/toolkit';
import { parseResult, output } from '../output.js';

export function registerTagsCommand(program: Command) {
  const tags = program.command('tags').description('Manage email tags and reply statuses');

  tags
    .command('add <email> <uid> <tag>')
    .description('Add a tag to an email')
    .option('--folder <folder>', 'Folder: INBOX or SENT', 'INBOX')
    .action(async (email: string, uid: string, tag: string, opts: { folder: string }) => {
      const handler = functionMap['add_email_tag'];
      if (!handler) throw new Error('add_email_tag tool not available');
      const result = await handler({ email, uid: parseInt(uid, 10), tag, folder: opts.folder });
      const data = parseResult(result);
      output(program, data);
    });

  tags
    .command('remove <email> <uid> <tag>')
    .description('Remove a tag from an email')
    .option('--folder <folder>', 'Folder: INBOX or SENT', 'INBOX')
    .action(async (email: string, uid: string, tag: string, opts: { folder: string }) => {
      const handler = functionMap['remove_email_tag'];
      if (!handler) throw new Error('remove_email_tag tool not available');
      const result = await handler({ email, uid: parseInt(uid, 10), tag, folder: opts.folder });
      const data = parseResult(result);
      output(program, data);
    });

  tags
    .command('set-status <email> <uid> <status>')
    .description('Set reply classification status on an email')
    .option('--sent-uid <uid>', 'UID of the matching sent email')
    .action(async (email: string, uid: string, status: string, opts: { sentUid?: string }) => {
      const handler = functionMap['set_reply_status'];
      if (!handler) throw new Error('set_reply_status tool not available');
      const params: Record<string, unknown> = {
        email,
        uid: parseInt(uid, 10),
        status,
      };
      if (opts.sentUid) params.sent_uid = parseInt(opts.sentUid, 10);
      const result = await handler(params);
      const data = parseResult(result);
      output(program, data);
    });

  tags
    .command('list-statuses')
    .description('List available reply classification statuses')
    .action(async () => {
      const handler = functionMap['list_reply_statuses'];
      if (!handler) throw new Error('list_reply_statuses tool not available');
      const result = await handler({});
      const data = parseResult(result);
      output(program, data);
    });
}
