import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { serviceMode } from "./config";
import { clip, sleep } from "./util";

/**
 * The language model behind the assistant. Live: the Messages API through the official
 * SDK, streaming, adaptive thinking and tool use. Mock: a small scripted brain for tests.
 *
 * History is kept in the Messages API's own shapes and replayed unchanged (append-only),
 * so thinking blocks stay valid from one call to the next.
 */

export type LlmMessage = Anthropic.Beta.BetaMessageParam;
export type LlmBlock = Anthropic.Beta.BetaContentBlockParam;
export type LlmTool = Anthropic.Beta.BetaTool;

export interface LlmRequest {
  model: string;
  system: string;
  messages: LlmMessage[];
  tools: LlmTool[];
  signal: AbortSignal;
  /** Called with each new piece of reply text as it streams. */
  onText: (delta: string) => void;
}

export interface LlmResult {
  /** The assistant message content, exactly as the model returned it. */
  content: LlmBlock[];
  stopReason: "end_turn" | "tool_use" | "max_tokens" | "refusal" | "other";
}

export interface LlmClient {
  readonly live: boolean;
  respond(req: LlmRequest): Promise<LlmResult>;
}

/* ---------------------------------- live ---------------------------------- */

class AnthropicLlm implements LlmClient {
  readonly live = true;
  private client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2, timeout: 10 * 60_000 });

  async respond(req: LlmRequest): Promise<LlmResult> {
    const stream = this.client.beta.messages.stream(
      {
        model: req.model,
        max_tokens: 32_000,
        system: [{ type: "text", text: req.system, cache_control: { type: "ephemeral" } }],
        messages: req.messages,
        tools: req.tools.map((t) => ({ ...t, eager_input_streaming: true })),
        thinking: { type: "adaptive" },
        output_config: { effort: "medium" },
        // On a policy decline the API re-runs the request on a fallback model.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      },
      { signal: req.signal },
    );
    stream.on("text", (delta) => req.onText(delta));
    const msg = await stream.finalMessage();
    const reason = msg.stop_reason;
    return {
      content: msg.content as unknown as LlmBlock[],
      stopReason: reason === "end_turn" || reason === "tool_use" || reason === "max_tokens" || reason === "refusal" ? reason : "other",
    };
  }
}

/* ---------------------------------- mock ---------------------------------- */

let mockIds = 0;

function lastUserText(messages: LlmMessage[]): { text: string; toolResults: string[] } {
  const last = messages[messages.length - 1];
  if (!last || last.role !== "user") return { text: "", toolResults: [] };
  if (typeof last.content === "string") return { text: last.content, toolResults: [] };
  const toolResults: string[] = [];
  let text = "";
  for (const b of last.content) {
    if (b.type === "text") text += b.text;
    if (b.type === "tool_result") {
      const c = b.content;
      toolResults.push(typeof c === "string" ? c : (c ?? []).map((x) => (x.type === "text" ? x.text : `[${x.type}]`)).join(" "));
    }
  }
  return { text, toolResults };
}

/** Pulls the member's own words out of the message the loop builds. */
function memberWords(text: string): string {
  const m = /<member-message>\n?([\s\S]*?)\n?<\/member-message>/.exec(text);
  return (m ? m[1] : text).trim();
}

/**
 * A finished generation said in plain words. Any other tool result is passed on as it is, so
 * the mock's reply shows exactly what the model was given.
 */
function plainResult(result: string): { text: string; failed: boolean } {
  let r: { status?: unknown; files?: unknown; errors?: unknown };
  try {
    r = JSON.parse(result);
  } catch {
    return { text: result, failed: false };
  }
  if (!r || typeof r.status !== "string" || !Array.isArray(r.files)) return { text: result, failed: false };
  const kinds = (r.files as { kind?: unknown }[]).map((f) => (f.kind === "image" ? "picture" : f.kind === "video" ? "video" : f.kind === "audio" ? "audio" : "file"));
  const made = kinds.length === 1 ? `Your ${kinds[0]} is ready.` : `Your ${kinds.length} files are ready.`;
  const why = Array.isArray(r.errors) && typeof r.errors[0] === "string" ? r.errors[0] : "";
  if (r.status === "succeeded") return { text: made, failed: false };
  if (r.status === "partial") return { text: `${made} The rest did not work. ${why}`.trim(), failed: false };
  return { text: why || "Nothing was made.", failed: true };
}

/**
 * A scripted brain:
 *   "generate an image of X"  -> generate_media
 *   "look up X on the web"    -> computer_open_page
 *   "email X ..."             -> the mail app's send tool (needs approval)
 *   "check my mail"           -> the mail app's read-only list tool (runs at once)
 *   "remember X" / "what do you remember" / "ask me ..." -> memory and question tools
 *   anything else             -> a short reply
 * After tool results it answers with a one-line summary.
 */
class MockLlm implements LlmClient {
  readonly live = false;

  async respond(req: LlmRequest): Promise<LlmResult> {
    const has = (name: string) => req.tools.some((t) => t.name === name);
    const { text, toolResults } = lastUserText(req.messages);
    const call = (name: string, input: Record<string, unknown>, say: string): LlmResult => {
      return { content: [{ type: "text", text: say }, { type: "tool_use", id: `toolu_mock_${++mockIds}`, name, input }], stopReason: "tool_use" };
    };

    if (toolResults.length) {
      const said = toolResults.map(plainResult);
      const lead = said.some((r) => r.failed) ? "That did not go through." : "All done.";
      return this.say(`${lead} ${clip(said.map((r) => r.text).join(" ").replace(/\s+/g, " "), 160)}`, req);
    }

    const words = memberWords(text);
    if (/\[llm-fail\]/i.test(words)) throw new Error("mock model failure");
    if (/\[slow\]/i.test(words)) await sleep(3_000);
    let m = /generate (?:an? )?(image|picture|photo|video|clip|song|music|track|speech|voiceover)? ?of (.+)/i.exec(words);
    if (m && has("generate_media")) {
      const kind = /video|clip/i.test(m[1] ?? "") ? "video" : /song|music|track/i.test(m[1] ?? "") ? "music" : /speech|voice/i.test(m[1] ?? "") ? "audio" : "image";
      return call("generate_media", { kind, prompt: m[2].trim().replace(/[.!]+$/, "") }, "Let me set that up.");
    }
    m = /look up (.+?) on the web/i.exec(words);
    if (m && has("computer_open_page")) {
      return call("computer_open_page", { url: `https://duckduckgo.com/?q=${encodeURIComponent(m[1])}` }, "Opening a browser on your computer.");
    }
    m = /^email (\S+)\s*(.*)$/i.exec(words);
    if (m) {
      if (has("app_MAIL_SEND_EMAIL")) {
        return call("app_MAIL_SEND_EMAIL", { to: m[1], subject: "A note", body: m[2] || "Hello!" }, "Drafting that email.");
      }
      if (has("connect_app")) return call("connect_app", { app: "mail", reason: "to send email for you" }, "I need your mail app first.");
    }
    if (/check my (mail|inbox)/i.test(words) && has("app_MAIL_LIST_MESSAGES")) return call("app_MAIL_LIST_MESSAGES", { query: "" }, "Checking your inbox.");
    m = /^remember (?:that )?(.+)$/i.exec(words);
    if (m && has("remember")) return call("remember", { fact: m[1] }, "Noting that.");
    if (/what do you remember/i.test(words) && has("recall")) return call("recall", { query: "" }, "Let me check.");
    m = /^ask me (.+)$/i.exec(words);
    if (m && has("ask_user")) return call("ask_user", { question: m[1], choices: ["Yes", "No"] }, "Quick question.");
    if (/list (the )?models/i.test(words) && has("list_models")) return call("list_models", {}, "Checking the models.");
    return this.say(`Got it. You said: "${clip(words, 80)}". Tell me what to make and I will plan it.`, req);
  }

  private async say(reply: string, req: LlmRequest): Promise<LlmResult> {
    // Streams in a few chunks so the screens can show a reply growing.
    const parts = reply.match(/.{1,24}(\s|$)/g) ?? [reply];
    for (const p of parts) {
      if (req.signal.aborted) break;
      req.onText(p);
      await sleep(40);
    }
    return { content: [{ type: "text", text: reply }], stopReason: "end_turn" };
  }
}

const holder = globalThis as unknown as { __agentLlm?: LlmClient };

export function llm(): LlmClient {
  const live = serviceMode("llm") === "live";
  if (!holder.__agentLlm || holder.__agentLlm.live !== live) holder.__agentLlm = live ? new AnthropicLlm() : new MockLlm();
  return holder.__agentLlm;
}
