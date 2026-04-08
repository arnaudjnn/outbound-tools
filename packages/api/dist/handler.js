import { functionMap } from '@outbound-tools/toolkit';
export function toolHandler(toolName) {
    return async (req, res) => {
        const handler = functionMap[toolName];
        if (!handler) {
            res.status(404).json({ error: `Unknown tool: ${toolName}` });
            return;
        }
        try {
            const result = await handler(req.body);
            res.json(result);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            res.status(500).json({ error: message });
        }
    };
}
