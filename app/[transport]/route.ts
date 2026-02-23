import { createMcpHandler } from "mcp-handler";
import { registerTools } from "@/lib/mcp";

const handler = createMcpHandler(
  (server) => {
    registerTools(server);
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

export { handler as GET, handler as POST };
