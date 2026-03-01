import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    result: "pong",
    timestamp: new Date().toISOString(),
    message: "MCP server is healthy",
  });
}
