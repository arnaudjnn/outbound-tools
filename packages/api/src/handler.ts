import type { Request, Response } from 'express';
import { functionMap, toolsByName } from '@outbound-tools/toolkit';

export function toolHandler(toolName: string) {
  return async (req: Request, res: Response) => {
    const handler = functionMap[toolName];
    if (!handler) {
      res.status(404).json({ error: `Unknown tool: ${toolName}` });
      return;
    }

    // Validate and coerce the body through the tool's zod schema so optional
    // params get their declared defaults (e.g. pagination limit/page). Without
    // this, callers that omit them (like Airbyte) hit undefined-driven bugs.
    const tool = toolsByName[toolName];
    let params: unknown = req.body ?? {};
    if (tool) {
      const parsed = tool.parameters.safeParse(req.body ?? {});
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid parameters', details: parsed.error.issues });
        return;
      }
      params = parsed.data;
    }

    try {
      const result = await handler(params);
      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  };
}
