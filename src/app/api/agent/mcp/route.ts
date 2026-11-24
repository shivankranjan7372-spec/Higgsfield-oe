import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import { handleEngineMcp } from "@/server/agent/engine-mcp";

/**
 * Where an outside engine (a Hermes agent) reaches Parallax's tools. Not for members and
 * not for the public API: it takes the engine's own token, never a session or an API key.
 */

const notAllowed = () =>
  Response.json(
    { jsonrpc: "2.0", id: null, error: { code: -32000, message: "Method not allowed. Send JSON-RPC with POST." } },
    { status: 405, headers: { Allow: "POST" } },
  );

export async function POST(req: NextRequest): Promise<Response> {
  const h = await headers();
  return handleEngineMcp(req, h.get("authorization"));
}

export async function GET(): Promise<Response> {
  await headers();
  return notAllowed();
}

export async function DELETE(): Promise<Response> {
  await headers();
  return notAllowed();
}
