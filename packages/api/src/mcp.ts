import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { tools, functionMap } from '@outbound-tools/toolkit';
import type { ToolDefinition } from '@outbound-tools/toolkit';

export function createServer(): McpServer {
  const server = new McpServer(
    { name: 'outbound_tools', version: '1.0.0' },
    { capabilities: { logging: {} } },
  );

  for (const tool of tools) {
    registerTool(server, tool);
  }

  return server;
}

function registerTool(server: McpServer, tool: ToolDefinition): void {
  const handler = functionMap[tool.name];
  if (!handler) return;

  server.tool(
    tool.name,
    tool.description,
    tool.parameters.shape ?? {},
    async (params: Record<string, unknown>) => {
      try {
        const result = await handler(params);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }],
          isError: true,
        };
      }
    },
  );
}
