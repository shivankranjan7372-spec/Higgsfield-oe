import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import { handleMcp } from "@/server/developer/mcp";

const notAllowed = () =>
  Response.json({ jsonrpc: "2.0", id: null, error: { code: -32000, message: "Method not allowed. Send JSON-RPC with POST." } }, { status: 405, headers: { Allow: "POST" } });

/** POST /api/mcp  Model Context Protocol, Streamable HTTP, stateless. Bearer API key. */
export async function POST(req: NextRequest): Promise<Response> {
  // Reading headers marks the route as request-time; Next's build probe rejects here, uncaught on purpose.
  const h = await headers();
  return handleMcp(req, h.get("authorization"));
}

/** No server-initiated stream and no sessions, so GET and DELETE are refused. */
export async function GET(): Promise<Response> {
  await headers();
  return notAllowed();
}

export async function DELETE(): Promise<Response> {
  await headers();
  return notAllowed();
}
