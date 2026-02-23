import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerMailpoolTools } from "./mailpool";

export async function registerTools(server: McpServer) {
  server.tool(
    "ping",
    "Health check endpoint. Useful for testing MCP server connectivity.",
    {},
    async () => {
      const result = {
        result: "pong",
        timestamp: new Date().toISOString(),
        message: "MCP server is healthy",
      };

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  registerMailpoolTools(server);
}
