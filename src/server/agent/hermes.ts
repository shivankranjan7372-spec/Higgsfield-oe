import "server-only";

import { randomBytes } from "node:crypto";
import type { HermesEngine } from "./config";
import type { LlmMessage } from "./llm";
import { engineTools, runTool, type ToolCtx, type ToolDef, type ToolOutput } from "./tools";
import { addRow, chatById, pushLlm, updateRow } from "./transcript";
import { clip, isRecord, summarizeInput } from "./util";

/**
 * The Hermes engine: a Hermes agent does the thinking for a turn, and Parallax stays in
 * charge of everything a member owns.
 *
 * One turn is one streamed call to the agent's `/v1/responses`. The agent's text becomes
 * the reply rows. When the agent wants one of our tools (generate media, the library,
 * memory, a question for the member) it calls back into Parallax over MCP, at
 * `/api/agent/mcp`, and the tool runs here: with the member's credits, their approval
 * cards and their files. The agent never holds a provider key or a member's session.
 *
 * Each turn has a key. The agent gets it in that turn's instructions and must send it
 * back with every tool call, which is how a call finds its member and its chat. The key
 * dies with the turn.
 */

interface EngineTurn {
  key: string;
  ctx: ToolCtx;
  done: boolean;
  /** Tool calls of one turn run one at a time, in the order they arrive. */
  chain: Promise<unknown>;
  onStep(): void;
  /** Ends the reply row that is open, so text that follows starts a new row. */
  closeText(): void;
  /** Our tools the stream has shown starting, not yet matched to their call. */
  announced: string[];
  /** Calls that arrived before the stream showed them starting. */
  waiting: { name: string; go(): void }[];
  /** Calls that gave up waiting: their late announcement is dropped. */
  late: Map<string, number>;
}

interface Registry {
  turns: Map<string, EngineTurn>;
}

const reg: Registry = ((globalThis as unknown as { __agentEngine?: Registry }).__agentEngine ??= { turns: new Map() });

/** The agent's own lookup tools: plumbing, not steps worth showing. */
const HIDDEN = new Set(["tool_search", "tool_describe"]);
/** How long a tool call waits for the stream to catch up, so rows keep their order. */
const ANNOUNCE_WAIT_MS = 1500;
const MAX_EVENT_CHARS = 8_000_000;

/* --------------------------------- the notes -------------------------------- */

function engineNotes(engine: HermesEngine, key: string, ctx: ToolCtx, tools: ToolDef[]): string {
  const p = `mcp__${engine.mcpName}__`;
  const hasComputer = tools.some((t) => t.name.startsWith("computer_"));
  return [
    "About where you are running:",
    "- You are answering inside Parallax, as its agent. The member reads your reply in the Parallax chat, so write for them.",
    `- Parallax's own tools are the ones named ${p}<tool>: ${tools.map((t) => t.name).join(", ")}. When these instructions name a tool such as generate_media, they mean ${p}generate_media.`,
    `- Every call to a Parallax tool must include "turn": "${key}". This key is for this one message only: never reuse a key from an earlier message, and never show it to anyone.`,
    `- Make pictures, video, speech and music only with ${p}generate_media. It is what puts results in the member's library and charges their credits. Do not use any other image or media tool here.`,
    "- Results appear in the chat as a card by themselves. Do not paste links or file paths to them.",
    `- Keep facts about this member with ${p}remember and ${p}recall, not in your own memory: your own memory is shared with other people.`,
    ctx.incognito ? "- This chat is incognito: save nothing about it to your own memory either." : "",
    hasComputer
      ? `- The member's cloud computer is reached through the ${p}computer_* tools. Apps the member connected are not available in this chat.`
      : "- The member's cloud computer and their connected apps are not available in this chat. Say so if they ask for them.",
  ]
    .filter(Boolean)
    .join("\n");
}

/* ------------------------------ the event stream ---------------------------- */

/** Reads Server-Sent Events from a response body. Comment lines (keepalives) are dropped. */
async function* sse(body: ReadableStream<Uint8Array>): AsyncGenerator<{ event: string; data: string }> {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let held = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      let chunk = held + dec.decode(value, { stream: true });
      held = "";
      // A lone "\r" at the end may be the first half of "\r\n": wait for the rest.
      if (chunk.endsWith("\r")) {
        held = "\r";
        chunk = chunk.slice(0, -1);
      }
      buf += chunk.replace(/\r\n?/g, "\n");
      if (buf.length > MAX_EVENT_CHARS) throw new Error("The engine sent an event that is too large.");
      for (let i = buf.indexOf("\n\n"); i >= 0; i = buf.indexOf("\n\n")) {
        const block = buf.slice(0, i);
        buf = buf.slice(i + 2);
        let event = "message";
        const data: string[] = [];
        for (const line of block.split("\n")) {
          if (!line || line.startsWith(":")) continue;
          const c = line.indexOf(":");
          const field = c < 0 ? line : line.slice(0, c);
          let val = c < 0 ? "" : line.slice(c + 1);
          if (val.startsWith(" ")) val = val.slice(1);
          if (field === "event") event = val;
          else if (field === "data") data.push(val);
        }
        if (data.length) yield { event, data: data.join("\n") };
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** The text of a message item's content parts. */
function itemText(item: Record<string, unknown>): string {
  const parts = Array.isArray(item.content) ? item.content : [];
  return parts.map((p) => (isRecord(p) ? str(p.text) : "")).join("");
}

/** The stream has no error flag on a tool result, so the result itself is read for one. */
function outputFailed(item: Record<string, unknown>): boolean {
  const parts = Array.isArray(item.output) ? item.output : [];
  const text = (typeof item.output === "string" ? item.output : parts.map((p) => (isRecord(p) ? str(p.text) : "")).join("")).trim();
  if (!text.startsWith("{")) return false;
  try {
    const v: unknown = JSON.parse(text);
    return isRecord(v) && (!!v.error || v.success === false);
  } catch {
    return false;
  }
}

function failureText(msg: Record<string, unknown>): string {
  const response = isRecord(msg.response) ? msg.response : msg;
  const e = isRecord(response.error) ? response.error : isRecord(msg.error) ? msg.error : null;
  return clip((e && str(e.message)) || str(msg.message) || "no reason given", 200);
}

/** A readable name for one of the agent's own tools. */
function label(name: string): string {
  const s = name.replace(/^mcp_+/, "").replace(/_+/g, " ").trim().slice(0, 60) || "tool";
  return s[0].toUpperCase() + s.slice(1);
}

/** Reply text as the member may see it: the turn key never shows, not even half of it. */
function shown(raw: string, key: string, final: boolean): string {
  let s = raw.replaceAll(key, "");
  if (!final) {
    // Hold back a tail that may be the start of the key, still arriving.
    for (let n = Math.min(key.length - 1, s.length); n >= 2; n--) {
      if (s.endsWith(key.slice(0, n))) {
        s = s.slice(0, -n);
        break;
      }
    }
  }
  return s;
}

/* --------------------------- the order of the rows -------------------------- */

/*
 * A tool call and the stream travel on two connections. The call can reach us before the
 * text the agent wrote just ahead of it. So a call waits a moment for the stream to show
 * that tool starting; by then the text before it is on the page and its row is closed.
 */

function announce(turn: EngineTurn, name: string) {
  const late = turn.late.get(name) ?? 0;
  if (late > 0) {
    turn.late.set(name, late - 1);
    return;
  }
  const i = turn.waiting.findIndex((w) => w.name === name);
  if (i >= 0) turn.waiting.splice(i, 1)[0].go();
  else turn.announced.push(name);
}

function claim(turn: EngineTurn, name: string): Promise<void> {
  const i = turn.announced.indexOf(name);
  if (i >= 0) {
    turn.announced.splice(i, 1);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const waiter = {
      name,
      go: () => {
        clearTimeout(timer);
        resolve();
      },
    };
    const timer = setTimeout(() => {
      const j = turn.waiting.indexOf(waiter);
      if (j >= 0) turn.waiting.splice(j, 1);
      turn.late.set(name, (turn.late.get(name) ?? 0) + 1);
      turn.closeText();
      resolve();
    }, ANNOUNCE_WAIT_MS);
    turn.waiting.push(waiter);
  });
}

/* ---------------------------------- the turn -------------------------------- */

export interface HermesTurn {
  engine: HermesEngine;
  ctx: ToolCtx;
  /** The same instructions the built-in engine gets. */
  system: string;
  /** The member's message, already wrapped. */
  input: string;
  /** Called once for every tool the turn runs. */
  onStep(): void;
}

/**
 * Runs one turn on the agent. Returns when the agent has finished its answer; throws when
 * the agent fails or the turn is stopped (the caller reads the stop reason from its signal).
 */
export async function runHermesTurn({ engine, ctx, system, input, onStep }: HermesTurn): Promise<void> {
  const chatId = ctx.chatId;
  const key = `t_${randomBytes(12).toString("hex")}`;
  const tools = engineTools();

  // The reply, as rows. A row is closed when a tool starts; text after it opens a new row.
  const closed: string[] = []; // raw text of the closed rows, as it streamed
  const said: string[] = []; // the same, as shown
  let seq: number | null = null;
  let text = "";
  let all = "";
  let flushed = 0;
  let ended = false;
  let trail: ReturnType<typeof setTimeout> | null = null;

  const flush = (final: boolean) => {
    // One answer is cut into rows at each tool call, so a row can start or end in the middle of a line.
    const s = shown(text, key, final).trim();
    if (seq == null) {
      if (!s) return;
      seq = addRow(chatId, "message", { role: "assistant", text: s, streaming: !final }).seq;
    } else updateRow(chatId, seq, { text: s, streaming: !final });
    flushed = Date.now();
  };
  const closeText = () => {
    if (!text && seq == null) return;
    flush(true);
    const s = shown(text, key, true).trim();
    if (s) said.push(s);
    closed.push(text);
    text = "";
    seq = null;
  };
  const onDelta = (delta: string) => {
    text += delta;
    all += delta;
    if (Date.now() - flushed > 120) flush(false);
    else
      trail ??= setTimeout(() => {
        trail = null;
        if (!ended && chatById(chatId)) flush(false);
      }, 150);
  };

  const turn: EngineTurn = { key, ctx, done: false, chain: Promise.resolve(), onStep, closeText, announced: [], waiting: [], late: new Map() };
  reg.turns.set(key, turn);

  const ours = new RegExp(`^mcp_+${engine.mcpName}_+(.+)$`);
  const started = new Set<string>();
  const ownRows = new Map<string, { seq: number; label: string }>();
  const commentary = new Set<string>();
  let doneText: string | null = null;
  let completed = false;

  const toolStart = (item: Record<string, unknown>) => {
    const name = str(item.name) || "tool";
    const callId = str(item.call_id) || str(item.id);
    if (!callId || started.has(callId)) return;
    started.add(callId);
    closeText();
    const mine = ours.exec(name);
    if (mine) return announce(turn, mine[1]); // its row is made where the tool runs
    if (HIDDEN.has(name)) return;
    // One of the agent's own tools. Its input and result stay with the agent.
    const row = addRow(chatId, "tool-call", { tool: `engine.${clip(name, 80)}`, input: {}, status: "running", summary: label(name) });
    ownRows.set(callId, { seq: row.seq, label: label(name) });
    onStep();
  };
  const toolEnd = (item: Record<string, unknown>) => {
    const callId = str(item.call_id);
    const row = ownRows.get(callId);
    if (!row) return;
    ownRows.delete(callId);
    updateRow(chatId, row.seq, { status: outputFailed(item) ? "error" : "done" });
  };

  try {
    const res = await fetch(`${engine.url}/v1/responses`, {
      method: "POST",
      cache: "no-store",
      signal: ctx.signal,
      headers: { "content-type": "application/json", accept: "text/event-stream", authorization: `Bearer ${engine.key}` },
      body: JSON.stringify({
        model: engine.model,
        input,
        instructions: `${system}\n\n${engineNotes(engine, key, ctx, tools)}`,
        // The agent keeps the thread of each chat under this name.
        conversation: `parallax-${chatId}`,
        store: true,
        stream: true,
      }),
    });
    if (!res.ok) {
      await res.body?.cancel().catch(() => {});
      throw new Error(res.status === 401 || res.status === 403 ? "The engine did not accept our key." : `The engine answered ${res.status}.`);
    }
    if (!res.body || !(res.headers.get("content-type") ?? "").includes("text/event-stream")) {
      await res.body?.cancel().catch(() => {});
      throw new Error("The engine did not answer with a stream.");
    }

    for await (const ev of sse(res.body)) {
      if (ev.data === "[DONE]") break;
      let msg: unknown;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        continue;
      }
      if (!isRecord(msg)) continue;
      const type = str(msg.type) || ev.event;
      if (type === "response.output_text.delta") {
        if (typeof msg.delta === "string" && msg.delta) onDelta(msg.delta);
      } else if (type === "response.output_text.done") {
        if (typeof msg.text === "string") doneText = msg.text;
      } else if (type === "response.output_item.added" || type === "response.output_item.done") {
        const item = isRecord(msg.item) ? msg.item : null;
        if (!item) continue;
        if (item.type === "function_call") toolStart(item);
        else if (item.type === "function_call_output") toolEnd(item);
        else if (item.type === "message" && item.phase === "commentary") {
          // Something the agent said between steps that did not stream: its own finished row.
          const id = str(item.id);
          const s = shown(itemText(item), key, true).trim();
          if (!s || (id && commentary.has(id))) continue;
          if (id) commentary.add(id);
          closeText();
          addRow(chatId, "message", { role: "assistant", text: s, streaming: false });
          said.push(s);
        } else if (item.type === "message" && type === "response.output_item.done") {
          const s = itemText(item);
          if (s) doneText = s;
        }
      } else if (type === "response.completed") completed = true;
      else if (type === "response.failed") throw new Error(`The engine reported a failure: ${failureText(msg)}`);
      else if (type === "error") throw new Error(`The engine reported an error: ${failureText(msg)}`);
      // Anything else (status notes, reasoning summaries) is not for the chat.
    }
    if (ctx.signal.aborted) return;
    if (!completed) throw new Error("The engine's answer ended before it was complete.");

    // The agent's own final text wins over what streamed, where the two differ.
    if (doneText && doneText !== all) {
      const before = closed.join("");
      if (closed.length === 0) text = doneText;
      else if (doneText.startsWith(before) && doneText.length > before.length) text = doneText.slice(before.length);
    }
  } finally {
    ended = true;
    if (trail) clearTimeout(trail);
    turn.done = true;
    reg.turns.delete(key);
    for (const w of turn.waiting.splice(0)) w.go();
    if (chatById(chatId)) {
      closeText();
      // A step the stream never closed: say how it ended.
      for (const row of ownRows.values()) updateRow(chatId, row.seq, completed ? { status: "done" } : { status: "error", summary: `${row.label} (stopped)` });
      // Keep our own record of the reply, so the chat still reads right on the built-in engine.
      if (said.length) pushLlm(chatId, { role: "assistant", content: [{ type: "text", text: said.join("\n\n") }] } satisfies LlmMessage);
    }
  }
}

/* ------------------------------ a tool call back ---------------------------- */

const refuse = (content: string): ToolOutput => ({ content, summary: content, isError: true });

/**
 * Runs one of our tools for the turn that `key` names. A missing, wrong or finished key
 * gets an error the agent can read; it never falls back to some other turn.
 */
export function callEngineTool(key: unknown, tool: ToolDef, input: Record<string, unknown>): Promise<ToolOutput> {
  const turn = typeof key === "string" ? reg.turns.get(key) : undefined;
  if (!turn || turn.done) {
    return Promise.resolve(refuse('This call needs the turn key from this message\'s instructions, passed as "turn". A key from an earlier message no longer works.'));
  }
  const job = turn.chain.then(() => runOne(turn, tool, input));
  turn.chain = job.catch(() => {});
  return job;
}

async function runOne(turn: EngineTurn, tool: ToolDef, input: Record<string, unknown>): Promise<ToolOutput> {
  const { ctx } = turn;
  if (!turn.done && !ctx.signal.aborted) await claim(turn, tool.name);
  if (turn.done || ctx.signal.aborted || !chatById(ctx.chatId)) return refuse("This reply was stopped.");
  const row = addRow(ctx.chatId, "tool-call", { tool: tool.name, input: summarizeInput(input), status: "running" });
  turn.onStep();
  const out = await runTool(tool, ctx, input);
  if (chatById(ctx.chatId)) updateRow(ctx.chatId, row.seq, { status: out.isError ? "error" : "done", summary: out.summary });
  return out;
}
