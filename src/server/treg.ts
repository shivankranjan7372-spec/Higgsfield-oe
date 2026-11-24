import "server-only";

import { lookup } from "node:dns/promises";
import net from "node:net";
import { catalogEndpoint } from "@/registry/quote";

/**
 * The only file that talks to Treg (https://treg.to), the gateway in front of every
 * image, video and audio provider. One call format covers them all:
 *
 *   POST /call/<endpoint-id>   provider's own JSON body, unchanged
 *   GET  /tasks/<call-id>      status of an asynchronous call (free)
 *   POST /media                raw bytes in, public URL out (free)
 *
 * Rules this file keeps:
 *  - The token comes from the environment and is never logged.
 *  - Result URLs are signed. They are never logged and never sent to a browser.
 *  - Treg's account-level errors (balance, caps, keys) are never shown to members.
 */

const base = () => (process.env.TREG_BASE_URL ?? "https://treg.to").replace(/\/+$/, "");
const token = () => (process.env.TREG_TOKEN ?? "").trim();

/** `mock` makes every generation locally, with no provider call and no cost. */
export function tregMode(): "live" | "mock" {
  const mode = process.env.TREG_MODE;
  if (mode === "mock") return "mock";
  if (mode === "live") return "live";
  return token() ? "live" : "mock";
}

/** Strips anything that could carry a credential before text reaches a log. */
export function redact(text: string): string {
  let out = text.replace(/https?:\/\/([^\s"'<>\\/]+)[^\s"'<>\\]*/g, "https://$1/...");
  const t = token();
  if (t) out = out.split(t).join("[token]");
  return out.length > 2000 ? out.slice(0, 2000) + "..." : out;
}

/** Treg could not be reached, or did not answer in time. */
export class TregUnreachable extends Error {
  constructor(
    message: string,
    public status = 0,
  ) {
    super(message);
  }
}

export interface TregReply {
  status: number;
  /** A 2xx answer that Treg did not flag as its own error. */
  ok: boolean;
  callId: string | null;
  /** What Treg charged (or reserved, for an asynchronous call), in millionths of a dollar. */
  costMicro: number | null;
  /** True when the provider only accepted the job: poll `/tasks/<callId>` for the result. */
  isAsync: boolean;
  /** True when the error is Treg's own (`X-Treg-Error: 1`), not the provider's. */
  tregError: boolean;
  contentType: string;
  /** The parsed body when it is JSON. */
  json: unknown;
  /** The raw body when it is anything else (an image, a clip, speech). */
  bytes: Buffer | null;
}

export interface CallOptions {
  body?: unknown;
  /** Path and query parameters. Treg takes both in the query string. */
  query?: Record<string, string | number | boolean | undefined>;
  /** Headers for the provider. Ours always win, so a model cannot replace the token. */
  headers?: Record<string, string>;
  /** Sending the same key again returns the stored answer and charges nothing. */
  idempotencyKey?: string;
  /** Our member id. Lets Treg attribute spend and enforce per-customer caps. */
  customer?: string;
  /** Treg refuses the call (402) when it would cost more than this. */
  maxCostUsd?: number;
  timeoutMs?: number;
  maxBytes?: number;
}

const MB = 1_000_000;

async function readCapped(res: Response, maxBytes: number): Promise<Buffer> {
  const declared = Number(res.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new TregUnreachable("The result is too large.");
  if (!res.body) return Buffer.alloc(0);
  const chunks: Buffer[] = [];
  let total = 0;
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new TregUnreachable("The result is too large.");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

async function send(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    throw new TregUnreachable(name === "TimeoutError" || name === "AbortError" ? "timed out" : "network error");
  }
}

async function toReply(res: Response, maxBytes: number): Promise<TregReply> {
  const contentType = res.headers.get("content-type") ?? "";
  let raw: Buffer;
  try {
    raw = await readCapped(res, maxBytes);
  } catch (err) {
    throw err instanceof TregUnreachable ? err : new TregUnreachable("network error");
  }
  let json: unknown;
  let bytes: Buffer | null = null;
  const looksJson = /json/i.test(contentType) || (raw.length > 0 && (raw[0] === 0x7b || raw[0] === 0x5b) && !/^(image|video|audio)\//i.test(contentType));
  if (looksJson) {
    try {
      json = JSON.parse(raw.toString("utf8"));
    } catch {
      bytes = raw;
    }
  } else if (raw.length > 0) bytes = raw;

  const cost = Number(res.headers.get("x-treg-cost-micro"));
  const tregError = res.headers.get("x-treg-error") === "1";
  return {
    status: res.status,
    ok: res.status >= 200 && res.status < 300 && !tregError,
    callId: res.headers.get("x-treg-call-id"),
    costMicro: res.headers.has("x-treg-cost-micro") && Number.isFinite(cost) ? cost : null,
    isAsync: res.headers.has("x-treg-async"),
    tregError,
    contentType,
    json,
    bytes,
  };
}

/** Header names a model definition may never set: the gateway's own, and transport ones. */
const RESERVED_HEADER = /^(x-treg-.*|idempotency-key|authorization|cookie|host|content-type|content-length|connection|transfer-encoding)$/i;

/** Calls one catalog endpoint. Throws `TregUnreachable` only when no answer came back. */
export async function tregCall(endpointId: string, opts: CallOptions = {}): Promise<TregReply> {
  const method = (catalogEndpoint(endpointId)?.method ?? "POST").toUpperCase();
  const url = new URL(`${base()}/call/${encodeURIComponent(endpointId)}`);
  for (const [k, v] of Object.entries(opts.query ?? {})) if (v !== undefined) url.searchParams.set(k, String(v));

  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(opts.headers ?? {})) {
    if (/^[A-Za-z0-9-]{1,64}$/.test(name) && !RESERVED_HEADER.test(name) && /^[\x20-\x7e]{1,256}$/.test(value)) headers[name] = value;
  }
  headers["X-Treg-Token"] = token();
  if (opts.customer && /^[A-Za-z0-9._:-]{1,128}$/.test(opts.customer)) headers["X-Treg-Meta"] = `customer=${opts.customer}`;
  if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;
  if (opts.maxCostUsd && opts.maxCostUsd > 0) headers["X-Treg-Route-Max-Cost"] = opts.maxCostUsd.toFixed(4);

  const init: RequestInit = { method, headers, redirect: "error" };
  if (method !== "GET" && method !== "HEAD") {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(opts.body ?? {});
  }
  const res = await send(url.toString(), init, opts.timeoutMs ?? 180_000);
  return toReply(res, opts.maxBytes ?? 64 * MB);
}

/* --------------------------------- failures -------------------------------- */

export type FailureKind =
  /** Nothing ran. Send the same call again later, with the same idempotency key. */
  | "retry"
  /** This member is blocked or capped at the gateway. */
  | "customer"
  /** Our gateway account needs attention. The member only sees "unavailable". */
  | "operator"
  /** We built a request the gateway refused. */
  | "bug"
  /** The provider itself said no. */
  | "provider";

export interface TregFailure {
  kind: FailureKind;
  /** Stored on the job as `error_code`. */
  code: string;
  /** Written for the member. Never contains account details. */
  message: string;
  /** For the server log, already redacted. */
  detail: string;
}

const RETRY = new Set(["share_busy", "provider_rate_limited", "provider_capacity_unavailable", "route_failed"]);
const OPERATOR = new Set(["insufficient_balance", "funds_required", "own_key_required", "platform_daily_cap_reached", "unauthorized", "invalid_token"]);
const UNAVAILABLE = "This model is unavailable right now. Try again later, or pick another model.";
const BUSY = "The model is busy or unavailable. Try again shortly.";

/** Makes a provider's message safe and short enough to show. */
export function tidy(text: string, max = 300): string {
  const clean = text
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return clean.length > max ? clean.slice(0, max - 1).trimEnd() + "…" : clean;
}

/** Finds the human message in the many error shapes providers use. */
const ALL_FINE = /^(success(ful)?|succeeded|ok|done|completed?)[.!]?$/i;

export function providerMessage(body: unknown): string | null {
  if (typeof body === "string") return tidy(body) || null;
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const picks: unknown[] = [
    (o.error as Record<string, unknown> | undefined)?.message,
    typeof o.error === "string" ? o.error : undefined,
    o.detail,
    o.message,
    (o.base_resp as Record<string, unknown> | undefined)?.status_msg,
    o.fail_reason,
    o.failure_reason,
    o.title,
  ];
  for (const p of picks) {
    // Some providers put "success" in the same field they use for errors.
    if (typeof p === "string" && tidy(p) && !ALL_FINE.test(tidy(p))) return tidy(p);
    // FastAPI style: detail is a list of { msg }.
    if (Array.isArray(p) && p[0] && typeof (p[0] as { msg?: unknown }).msg === "string") return tidy((p[0] as { msg: string }).msg);
  }
  for (const nest of ["error", "data", "task"]) {
    const inner = o[nest];
    if (inner && typeof inner === "object" && !Array.isArray(inner)) {
      const found = providerMessage(inner);
      if (found) return found;
    }
  }
  return null;
}

/** Sorts a failed reply into what the worker should do about it. */
export function classify(reply: TregReply): TregFailure {
  const body = reply.json as Record<string, unknown> | undefined;
  const detail = redact(`${reply.status} ${reply.json !== undefined ? JSON.stringify(reply.json) : `<${reply.contentType || "no body"}>`}`);

  if (reply.tregError) {
    const code = typeof body?.error === "string" ? body.error : `gateway_${reply.status}`;
    if (RETRY.has(code)) return { kind: "retry", code, message: BUSY, detail };
    if (OPERATOR.has(code) || reply.status === 401) return { kind: "operator", code: "model_unavailable", message: UNAVAILABLE, detail };
    if (code === "tag_blocked") {
      return { kind: "customer", code: "account_paused", message: "Generation is paused on this account. Contact support.", detail };
    }
    if (code === "tag_spend_cap_reached") {
      return { kind: "customer", code: "spend_cap", message: "You have reached your spending limit for now. Try again later.", detail };
    }
    if (reply.status === 429 || reply.status >= 500) return { kind: "retry", code, message: BUSY, detail };
    if (reply.status === 403) return { kind: "operator", code: "model_unavailable", message: UNAVAILABLE, detail };
    return { kind: "bug", code: "request_refused", message: "This request could not be sent. Try different settings.", detail };
  }

  // The provider's own answer, relayed as is. It cost nothing.
  const said = providerMessage(reply.json);
  const showable = reply.status >= 400 && reply.status < 500 && ![401, 402, 403, 429].includes(reply.status);
  return { kind: "provider", code: "provider_error", message: showable && said ? said : BUSY, detail };
}

/* ---------------------------------- tasks ---------------------------------- */

export interface TregTask {
  call_id: string;
  endpoint_id: string;
  task_id: string | null;
  /** Treg's summary word. */
  state: string | null;
  /** The provider's own status word. */
  status: string | null;
  response: { http_status?: number; content_type?: string; body?: unknown } | null;
  /** The value at the catalog's result path: a URL, a list, or an object. */
  result: unknown;
  result_url: string | null;
  fetch_command: string | null;
  /** Seconds until the next poll is worth making. */
  retry_after: number | null;
  error: unknown;
}

/** Reads the status of an asynchronous call. Polling is free. */
export async function tregTask(callId: string): Promise<TregTask> {
  const res = await send(`${base()}/tasks/${encodeURIComponent(callId)}`, { headers: { "X-Treg-Token": token() }, redirect: "error" }, 30_000);
  const reply = await toReply(res, 32 * MB);
  if (reply.status < 200 || reply.status >= 300 || !reply.json || typeof reply.json !== "object") {
    throw new TregUnreachable(`task status ${reply.status}`, reply.status);
  }
  return reply.json as TregTask;
}

/** The provider's final status body. Treg hands it over as JSON text. */
export function taskBody(task: TregTask): unknown {
  const body = task.response?.body;
  if (typeof body !== "string") return body;
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

const DONE = new Set(["succeeded", "success", "completed", "complete", "done", "finished"]);
const DEAD = new Set(["failed", "fail", "failure", "error", "errored", "canceled", "cancelled", "expired", "timeout", "timed_out", "moderated", "nsfw", "rejected"]);

/**
 * Where an asynchronous call stands. Treg's summary word decides when we know it;
 * otherwise the provider's status is checked against the catalog's own word lists.
 */
export function taskOutcome(endpointId: string, task: TregTask): "succeeded" | "failed" | "running" {
  const state = String(task.state ?? "").toLowerCase();
  if (DONE.has(state)) return "succeeded";
  if (DEAD.has(state)) return "failed";
  const rule = catalogEndpoint(endpointId)?.async;
  const status = String(task.status ?? "").toLowerCase();
  if (status && rule) {
    if (rule.success?.some((w) => w.toLowerCase() === status)) return "succeeded";
    if (rule.failure?.some((w) => w.toLowerCase() === status)) return "failed";
  }
  return "running";
}

/** Why an asynchronous call failed, in words fit for the member. */
export function taskFailure(task: TregTask): string {
  const own = typeof task.error === "string" ? tidy(task.error) : providerMessage(task.error);
  return own || providerMessage(taskBody(task)) || "The model could not finish this one.";
}

/* ---------------------------------- media ---------------------------------- */

/** Parks a file at a public URL that providers can fetch for the next 7 days. Free. */
export async function tregUploadMedia(bytes: Buffer, mime: string): Promise<string> {
  const res = await send(
    `${base()}/media`,
    { method: "POST", headers: { "X-Treg-Token": token(), "Content-Type": mime }, body: new Uint8Array(bytes), redirect: "error" },
    120_000,
  );
  const reply = await toReply(res, MB);
  const url = reply.ok ? firstUrl(reply.json) : null;
  if (!url) throw new TregUnreachable(`media upload ${reply.status}`, reply.status);
  return url;
}

function firstUrl(v: unknown, depth = 0): string | null {
  if (typeof v === "string") return /^https:\/\//.test(v) ? v : null;
  if (!v || typeof v !== "object" || depth > 4) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.url === "string" && /^https:\/\//.test(o.url)) return o.url;
  for (const inner of Object.values(o)) {
    const found = firstUrl(inner, depth + 1);
    if (found) return found;
  }
  return null;
}

function privateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v6 = ip.toLowerCase();
  return v6 === "::1" || v6 === "::" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80") || v6.startsWith("::ffff:");
}

/** Result URLs come from providers. Only fetch public web hosts, whatever they say. */
async function assertPublic(url: URL) {
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new TregUnreachable("refused result address");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host) || host === "localhost" || /\.(internal|local|localhost)$/i.test(host)) throw new TregUnreachable("refused result address");
  const found = await lookup(host, { all: true }).catch(() => []);
  if (found.length === 0 || found.some((a) => privateAddress(a.address))) throw new TregUnreachable("refused result address");
}

/** Downloads a result file. Result URLs expire, so this runs the moment a job finishes. */
export async function downloadResult(link: string, maxBytes = 400 * MB): Promise<Buffer> {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    throw new TregUnreachable("bad result address");
  }
  // Some providers hand out plain-http links to storage that also answers on https.
  // Ask the encrypted way first, and use the link as given only when that fails.
  if (url.protocol === "http:" && !url.port) {
    const secure = new URL(url.toString());
    secure.protocol = "https:";
    try {
      return await follow(secure, maxBytes, 60_000);
    } catch {
      /* this host has no https, or it was too slow */
    }
  }
  return follow(url, maxBytes, 300_000);
}

async function follow(start: URL, maxBytes: number, timeoutMs: number): Promise<Buffer> {
  let url = start;
  for (let hop = 0; hop < 4; hop++) {
    await assertPublic(url);
    const res = await send(url.toString(), { redirect: "manual" }, timeoutMs);
    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get("location");
      if (!next) break;
      url = new URL(next, url);
      continue;
    }
    if (!res.ok) throw new TregUnreachable(`result download ${res.status}`, res.status);
    try {
      return await readCapped(res, maxBytes);
    } catch (err) {
      throw err instanceof TregUnreachable ? err : new TregUnreachable("network error");
    }
  }
  throw new TregUnreachable("result download redirected too often");
}
