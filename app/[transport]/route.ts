import { createMcpHandler } from "mcp-handler";
import { registerTools } from "@/lib/mcp";
import { checkApiKey } from "@/lib/auth";

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

async function authedHandler(request: Request) {
  const denied = checkApiKey(request);
  if (denied) return denied;
  return handler(request);
}

export { authedHandler as GET, authedHandler as POST };
