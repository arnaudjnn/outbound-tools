import { NextResponse } from "next/server";

/**
 * Validates API_KEY from Bearer header or query parameter.
 * Returns null if valid, or a 403 NextResponse if invalid.
 */
export function checkApiKey(request: Request): NextResponse | null {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return null; // no API_KEY configured = open access

  const url = new URL(request.url);
  const provided =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    url.searchParams.get("api_key");

  if (provided !== apiKey) {
    return NextResponse.json(
      {
        error: "forbidden",
        error_description: "Invalid or missing API key",
      },
      { status: 403 }
    );
  }

  return null;
}
