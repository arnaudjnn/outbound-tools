import { createMcpHandler } from "mcp-handler";
import { registerTools } from "@/lib/mcp";

const handler = createMcpHandler(
  (server) => {
    registerTools(server);
  },
  {},
  {
    basePath: "/",
    maxDuration: 60,
  }
);

export { handler as GET, handler as POST };
