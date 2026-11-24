import "server-only";

import { catalogEndpoint, readPath } from "@/registry/quote";
import type { MediaType } from "@/registry/types";
import { sniff, wavFromPcm } from "./media";
import { downloadResult, providerMessage, taskBody, tidy, tregCall, type TregReply, type TregTask } from "./treg";

/**
 * Turns whatever a provider returned into files.
 *
 * Providers answer in a dozen shapes: a URL, a list of URLs, base64 in JSON, hex in
 * JSON, raw bytes, or "call this second endpoint for the file". Everything funnels
 * through one collector, and every file is identified from its bytes, so a new provider
 * usually needs no code here.
 */

/** The provider answered, but with nothing usable. `message` is safe to show. */
export class ResultError extends Error {}

type Candidate = { url: string } | { bytes: Buffer; mime?: string };

/** Keys that hold the request we sent, logs or API links: never results. */
const SKIP = new Set(["input", "request", "urls", "logs", "metrics", "webhook", "usage", "usageMetadata", "meta", "config", "error"]);
const HEX = /^[0-9a-fA-F]+$/;
const B64 = /^[A-Za-z0-9+/_-]+={0,2}$/;

function collect(value: unknown, out: Candidate[], mime?: string, depth = 0) {
  if (out.length >= 24 || depth > 8 || value == null) return;
  if (typeof value === "string") {
    const s = value.trim();
    if (/^https?:\/\//.test(s)) out.push({ url: s });
    else if (s.startsWith("data:")) {
      const m = /^data:([^;,]+)[^,]*;base64,([\s\S]+)$/.exec(s);
      if (m) out.push({ bytes: Buffer.from(m[2], "base64"), mime: m[1] });
    } else if (s.length >= 64 && s.length % 2 === 0 && HEX.test(s)) out.push({ bytes: Buffer.from(s, "hex"), mime });
    else if (s.length >= 64) {
      // Base64 may be wrapped over lines. Prose has spaces, so it never matches.
      const packed = s.replace(/[\r\n]+/g, "");
      if (B64.test(packed)) out.push({ bytes: Buffer.from(packed, "base64"), mime });
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collect(item, out, mime, depth + 1);
    return;
  }
  if (typeof value !== "object") return;
  const o = value as Record<string, unknown>;
  const hint = [o.mimeType, o.mime_type, o.mime, o.content_type].find((m): m is string => typeof m === "string") ?? mime;
  for (const [key, inner] of Object.entries(o)) {
    if (SKIP.has(key)) continue;
    collect(inner, out, hint, depth + 1);
  }
}

function pcmRate(mime: string | undefined): number | null {
  if (!mime || !/audio\/(l16|pcm)|codec=pcm/i.test(mime)) return null;
  const rate = /rate=(\d+)/i.exec(mime);
  return rate ? Number(rate[1]) : 24_000;
}

/** Downloads or decodes each candidate and keeps the ones that are the kind we asked for. */
async function materialize(found: Candidate[], want: MediaType, limit: number): Promise<Buffer[]> {
  const files: Buffer[] = [];
  const seen = new Set<string>();
  for (const c of found) {
    if (files.length >= limit) break;
    let bytes: Buffer;
    let mime: string | undefined;
    if ("url" in c) {
      if (seen.has(c.url)) continue;
      seen.add(c.url);
      try {
        bytes = await downloadResult(c.url);
      } catch (err) {
        // The address is signed, so it never goes in the log. The reason does.
        console.warn(`[extract] result download failed: ${err instanceof Error ? err.message : "unknown"}`);
        continue;
      }
    } else {
      bytes = c.bytes;
      mime = c.mime;
    }
    const kind = sniff(bytes)?.kind;
    if (kind === want) files.push(bytes);
    else if (!kind && want === "audio") {
      const rate = pcmRate(mime);
      if (rate && bytes.length > 2000) files.push(wavFromPcm(bytes, rate));
    }
  }
  return files;
}

async function firstThatYields(sources: (() => unknown | Promise<unknown>)[], want: MediaType, limit: number): Promise<Buffer[]> {
  for (const source of sources) {
    const value = await source();
    if (value == null) continue;
    const found: Candidate[] = [];
    if (Buffer.isBuffer(value)) found.push({ bytes: value });
    else collect(value, found);
    const files = await materialize(found, want, limit);
    if (files.length > 0) return files;
  }
  return [];
}

/** Some providers hand over the file through a second, free endpoint. */
async function fetchResult(endpointId: string, task: TregTask, body: unknown): Promise<unknown> {
  const rule = catalogEndpoint(endpointId)?.async;
  if (!rule?.fetch || !rule.fetchParam) return null;
  let value = readPath(body, rule.fetchParam.valueFrom) ?? null;
  if (value == null && task.fetch_command) {
    const m = new RegExp(`${rule.fetchParam.name}=([^\\s"']+)`).exec(task.fetch_command);
    if (m) value = m[1];
  }
  value ??= task.task_id;
  if (value == null) return null;
  const reply = await tregCall(rule.fetch, { query: { [rule.fetchParam.name]: String(value) }, maxBytes: 400_000_000, timeoutMs: 300_000 });
  if (!reply.ok) return null;
  return reply.bytes ?? reply.json;
}

/** Files from a finished asynchronous call. */
export async function mediaFromTask(endpointId: string, task: TregTask, want: MediaType, limit: number): Promise<Buffer[]> {
  const body = taskBody(task);
  const rule = catalogEndpoint(endpointId)?.async;
  const files = await firstThatYields(
    [
      () => task.result,
      () => task.result_url,
      () => fetchResult(endpointId, task, body),
      () => (rule?.resultPath ? readPath(body, rule.resultPath) : null),
      () => body,
    ],
    want,
    limit,
  );
  if (files.length === 0) throw new ResultError("The model returned no result.");
  return files;
}

const SAFETY = /SAFETY|PROHIBITED|BLOCK|RECITATION|SPII/i;

/** A provider can say no inside a 200. Throws when it did. */
function refusal(json: unknown) {
  if (!json || typeof json !== "object") return;
  const o = json as Record<string, unknown>;
  const base = o.base_resp as { status_code?: number; status_msg?: string } | undefined;
  if (base && typeof base.status_code === "number" && base.status_code !== 0) {
    throw new ResultError(tidy(base.status_msg ?? "") || "The model could not finish this one.");
  }
  const blocked = (o.promptFeedback as { blockReason?: string } | undefined)?.blockReason;
  if (blocked) throw new ResultError("The model declined this prompt (safety filter). Try rewording it.");
  const reason = (o.candidates as { finishReason?: string }[] | undefined)?.[0]?.finishReason;
  if (reason && SAFETY.test(reason)) throw new ResultError("The model declined this prompt (safety filter). Try rewording it.");
}

/** Files from a synchronous reply. */
export async function mediaFromReply(reply: TregReply, want: MediaType, limit: number): Promise<Buffer[]> {
  refusal(reply.json);
  const files = await firstThatYields([() => reply.bytes, () => reply.json], want, limit);
  if (files.length > 0) return files;
  // A text-only answer usually explains itself ("I can't create that image...").
  const said = providerMessage(reply.json);
  throw new ResultError(said ? tidy(said) : "The model returned no result.");
}
