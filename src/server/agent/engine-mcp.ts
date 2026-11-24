import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { LEGACY_VERSIONS, MODERN_VERSIONS } from "../developer/mcp";
import { ApiError } from "../errors";
import { clientKey, rateLimit } from "../http";
import { sameOrigin } from "../origin";
import { hermesEngine } from "./config";
import { callEngineTool } from "./hermes";
import { engineTools, type ToolOutput } from "./tools";
import { isRecord } from "./util";

/**
 * The tool server for an outside engine: the Model Context Protocol over Streamable HTTP,
 * written by hand like the developer endpoint in `developer/mcp.ts`, but for one caller.
 *
 * Only the engine may use it, and it proves who it is with AGENT_ENGINE_TOKEN. The token
 * says "this is the engine"; it does not say whose turn a call belongs to. That comes from
 * the `turn` argument every tool takes: the key of a turn that is running right now.
 *
 * A tool call can wait a long time (a member's approval, a video render), so its answer
 * goes out as an event stream with keepalives when the caller accepts one.
 */

type Json = Record<string, unknown>;
type Id = string | number | null;

const SUPPORTED = [...MODERN_VERSIONS, ...LEGACY_VERSIONS];
const SERVER_INFO = { name: "parallax-agent", title: "Parallax Agent", version: "1.0.0" };
const INSTRUCTIONS =
  "Parallax's tools for its agent: make images, video and audio, read the member's library, remember facts for them, " +
  'and ask them questions. Every call needs "turn": the turn key from the current message\'s instructions.';
const TURN = { type: "string", description: "The turn key from this message's instructions. Required on every call." };
const MAX_BODY_CHARS = 1_000_000;
const KEEPALIVE_MS = 15_000;

const rpcError = (id: Id, code: number, message: string) => ({ jsonrpc: "2.0", id, error: { code, message } });
const json = (body: unknown, status = 200) => NextResponse.json(body, { status });
const apiError = (status: number, code: string, message: string, headers?: Record<string, string>) =>
  NextResponse.json({ error: { code, message } }, { status, headers });

function tokenOk(authorization: string | null, token: string): boolean {
  const m = /^Bearer\s+(\S+)$/i.exec(authorization ?? "");
  if (!m) return false;
  // Hashing first gives both sides one length, so the comparison leaks nothing about the token.
  const hash = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(hash(m[1]), hash(token));
}

function toolList(): Json[] {
  return engineTools().map((t) => {
    const schema = t.input_schema as { properties?: Json | null; required?: string[] | null } & Json;
    return {
      name: t.name,
      description: t.description,
      inputSchema: { ...schema, type: "object", properties: { ...(schema.properties ?? {}), turn: TURN }, required: [...(schema.required ?? []), "turn"] },
    };
  });
}

/** A tool's output as MCP content. Screenshots go across as images. */
function toContent(out: ToolOutput): Json[] {
  if (typeof out.content === "string") return [{ type: "text", text: out.content }];
  const parts: Json[] = [];
  for (const b of out.content) {
    if (b.type === "text") parts.push({ type: "text", text: b.text });
    else if (b.type === "image" && b.source.type === "base64") parts.push({ type: "image", data: b.source.data, mimeType: b.source.media_type });
  }
  return parts.length ? parts : [{ type: "text", text: "" }];
}

/** One JSON-RPC answer as an event stream, kept open with comments until the work is done. */
function streamAnswer(work: Promise<Json>): Response {
  const enc = new TextEncoder();
  let open = true;
  let timer: ReturnType<typeof setInterval> | null = null;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (s: string) => {
        if (!open) return;
        try {
          controller.enqueue(enc.encode(s));
        } catch {
          open = false;
        }
      };
      send(": working\n\n");
      timer = setInterval(() => send(": ping\n\n"), KEEPALIVE_MS);
      void work
        .then((body) => send(`event: message\ndata: ${JSON.stringify(body)}\n\n`))
        .finally(() => {
          if (timer) clearInterval(timer);
          if (!open) return;
          open = false;
          try {
            controller.close();
          } catch {
            /* the caller already left */
          }
        });
    },
    cancel() {
      open = false;
      if (timer) clearInterval(timer);
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" },
  });
}

export async function handleEngineMcp(req: NextRequest, authorization: string | null): Promise<Response> {
  const engine = hermesEngine();
  // On the built-in engine this address does not exist.
  if (!engine) return apiError(404, "not_found", "Not found.");
  if (!sameOrigin(req)) return json(rpcError(null, -32000, "Cross-site request refused."), 403);
  if (!tokenOk(authorization, engine.token)) {
    try {
      rateLimit(`engine-mcp:${clientKey(req)}`, 20, 10 * 60_000);
    } catch (err) {
      if (err instanceof ApiError) return apiError(err.status, err.code, err.message);
      throw err;
    }
    return apiError(401, "unauthorized", "A valid engine token is required.", { "WWW-Authenticate": 'Bearer realm="parallax"' });
  }

  let msg: unknown;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY_CHARS) return json(rpcError(null, -32600, "The request is too large."), 413);
    msg = JSON.parse(raw);
  } catch {
    return json(rpcError(null, -32700, "Parse error"), 400);
  }
  if (!isRecord(msg)) return json(rpcError(null, -32600, "Send one JSON-RPC message per request."), 400);
  if (msg.jsonrpc !== "2.0") return json(rpcError(null, -32600, "Invalid Request"), 400);
  const hasId = "id" in msg && (typeof msg.id === "string" || typeof msg.id === "number");
  if (typeof msg.method !== "string") return hasId || "result" in msg || "error" in msg ? new Response(null, { status: 202 }) : json(rpcError(null, -32600, "Invalid Request"), 400);
  if (!hasId) return new Response(null, { status: 202 }); // a notification: nothing to answer
  const id = msg.id as Id;
  const params = isRecord(msg.params) ? msg.params : {};

  if (msg.method === "initialize") {
    const asked = typeof params.protocolVersion === "string" ? params.protocolVersion : "";
    const version = LEGACY_VERSIONS.includes(asked) ? asked : LEGACY_VERSIONS[0];
    return json({ jsonrpc: "2.0", id, result: { protocolVersion: version, capabilities: { tools: { listChanged: false } }, serverInfo: SERVER_INFO, instructions: INSTRUCTIONS } });
  }

  // A modern client names its protocol version in each request. Headers are not checked: one trusted caller.
  const meta = isRecord(params._meta) ? params._meta : {};
  const modern = typeof meta["io.modelcontextprotocol/protocolVersion"] === "string";
  const answer = (result: Json): Json => ({ jsonrpc: "2.0", id, result: modern ? { resultType: "complete", ...result } : result });

  switch (msg.method) {
    case "ping":
      return json(answer({}));
    case "server/discover":
      return json(answer({ supportedVersions: SUPPORTED, capabilities: { tools: { listChanged: false } }, _meta: { "io.modelcontextprotocol/serverInfo": SERVER_INFO }, instructions: INSTRUCTIONS }));
    case "tools/list":
      return json(answer({ tools: toolList() }));
    // Asked for by some clients whatever the server offers. There are none.
    case "resources/list":
      return json(answer({ resources: [] }));
    case "resources/templates/list":
      return json(answer({ resourceTemplates: [] }));
    case "prompts/list":
      return json(answer({ prompts: [] }));
    case "tools/call": {
      const tool = engineTools().find((t) => t.name === params.name);
      if (!tool) return json(rpcError(id, -32602, `Unknown tool: ${String(params.name).slice(0, 80)}`));
      const { turn, ...input } = isRecord(params.arguments) ? params.arguments : {};
      // Failures go back to the agent as a result it can read and act on.
      const work = callEngineTool(turn, tool, input).then(
        (out) => answer({ content: toContent(out), isError: !!out.isError }),
        (err) => {
          console.error("[agent] engine tool failed:", tool.name, err instanceof Error ? err.message : err);
          return answer({ content: [{ type: "text", text: "The tool failed." }], isError: true });
        },
      );
      return (req.headers.get("accept") ?? "").includes("text/event-stream") ? streamAnswer(work) : json(await work);
    }
    default:
      return json(rpcError(id, -32601, "Method not found"), modern ? 404 : 200);
  }
}
