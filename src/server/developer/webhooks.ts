import "server-only";

import { createHmac, randomBytes } from "node:crypto";
import http from "node:http";
import https from "node:https";
import type { User } from "../auth";
import { assetsOfJobs } from "../assets";
import { all, get, newId, parseJson, run, tx } from "../db";
import { ApiError, badRequest, notFound } from "../errors";
import { toJob, type JobRow } from "../jobs";
import { checkResolves, guardedLookup, isAllowedLocal, parseWebhookUrl, UrlRefused } from "./netguard";
import { generationOut } from "./service";

/**
 * Webhooks: a member's endpoints, signed deliveries, retries and the delivery log.
 *
 * The foundation has no "job finished" hook, so a small dispatcher loop (one per
 * process, like the job worker) looks for jobs that finished since it last looked,
 * queues a delivery for each matching endpoint, and sends what is due.
 */

export const EVENTS = ["generation.succeeded", "generation.failed", "generation.canceled"] as const;
export type EventName = (typeof EVENTS)[number];
export const TEST_EVENT = "webhook.test";
export const MAX_WEBHOOKS = 10;
export const MAX_ATTEMPTS = 6;
/** Wait after attempt n fails (n = 1..5). */
const BACKOFF_MS = [30_000, 120_000, 600_000, 3_600_000, 6 * 3_600_000];
const TIMEOUT_MS = 10_000;

interface WebhookRow {
  id: string;
  user_id: string;
  url: string;
  description: string;
  secret: string;
  events: string;
  enabled: number;
  created_at: number;
}

interface DeliveryRow {
  id: string;
  webhook_id: string;
  user_id: string;
  event: string;
  job_id: string | null;
  payload: string;
  status: "pending" | "delivered" | "failed";
  attempts: number;
  next_attempt_at: number;
  last_status: number | null;
  last_error: string | null;
  created_at: number;
  delivered_at: number | null;
}

function toWebhook(r: WebhookRow) {
  return {
    id: r.id,
    url: r.url,
    description: r.description,
    events: parseJson<EventName[]>(r.events, []),
    enabled: r.enabled === 1,
    /** The last four characters, to tell secrets apart. The full secret is shown once. */
    secretHint: r.secret.slice(-4),
    createdAt: r.created_at,
  };
}
export type Webhook = ReturnType<typeof toWebhook>;

function toDelivery(r: DeliveryRow) {
  return {
    id: r.id,
    webhookId: r.webhook_id,
    event: r.event,
    generationId: r.job_id,
    status: r.status,
    attempts: r.attempts,
    nextAttemptAt: r.status === "pending" ? r.next_attempt_at : null,
    responseStatus: r.last_status,
    error: r.last_error,
    createdAt: r.created_at,
    deliveredAt: r.delivered_at,
    payload: parseJson<Record<string, unknown>>(r.payload, {}),
  };
}

/* ---------------------------------- manage --------------------------------- */

const newSecret = () => "whsec_" + randomBytes(24).toString("base64url");

function cleanEvents(raw: unknown): EventName[] {
  if (raw === undefined || raw === null) return [...EVENTS];
  if (!Array.isArray(raw) || raw.length === 0) throw badRequest("Pick at least one event.");
  const set = new Set<EventName>();
  for (const e of raw) {
    const ev = EVENTS.find((x) => x === e);
    if (!ev) throw badRequest(`Unknown event. Use ${EVENTS.join(", ")}.`);
    set.add(ev);
  }
  return EVENTS.filter((e) => set.has(e));
}

function cleanDescription(raw: unknown): string {
  if (raw === undefined || raw === null) return "";
  if (typeof raw !== "string") throw badRequest("The description must be text.");
  if (raw.length > 200) throw badRequest("Keep the description under 200 characters.");
  return raw.trim();
}

async function checkedUrl(raw: unknown): Promise<string> {
  try {
    const url = parseWebhookUrl(raw);
    await checkResolves(url);
    return url.toString();
  } catch (err) {
    if (err instanceof UrlRefused) throw new ApiError(400, "invalid_url", err.message);
    throw err;
  }
}

function ownedWebhook(userId: string, id: string): WebhookRow {
  const row = get<WebhookRow>("SELECT * FROM dev_webhooks WHERE id = ? AND user_id = ?", id, userId);
  if (!row) throw notFound("That endpoint does not exist.");
  return row;
}

export const listWebhooks = (userId: string) => (ensureDispatcher(), all<WebhookRow>("SELECT * FROM dev_webhooks WHERE user_id = ? ORDER BY created_at DESC", userId).map(toWebhook));
export const getWebhook = (userId: string, id: string) => toWebhook(ownedWebhook(userId, id));

export async function createWebhook(user: User, body: Record<string, unknown>): Promise<{ webhook: Webhook; secret: string }> {
  if (user.isGuest) throw new ApiError(403, "account_required", "Create a free account to use webhooks.");
  const events = cleanEvents(body.events);
  const description = cleanDescription(body.description);
  const url = await checkedUrl(body.url);
  const id = newId("whk");
  const secret = newSecret();
  tx(() => {
    const n = get<{ n: number }>("SELECT COUNT(*) AS n FROM dev_webhooks WHERE user_id = ?", user.id)!.n;
    if (n >= MAX_WEBHOOKS) throw new ApiError(409, "limit_reached", `You can have ${MAX_WEBHOOKS} endpoints. Delete one first.`);
    run(
      "INSERT INTO dev_webhooks (id, user_id, url, description, secret, events, enabled, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)",
      id,
      user.id,
      url,
      description,
      secret,
      JSON.stringify(events),
      Date.now(),
    );
  });
  ensureDispatcher();
  return { webhook: getWebhook(user.id, id), secret };
}

export async function updateWebhook(userId: string, id: string, body: Record<string, unknown>): Promise<Webhook> {
  ownedWebhook(userId, id);
  const url = body.url !== undefined ? await checkedUrl(body.url) : undefined;
  const events = body.events !== undefined ? cleanEvents(body.events) : undefined;
  const description = body.description !== undefined ? cleanDescription(body.description) : undefined;
  if (body.enabled !== undefined && typeof body.enabled !== "boolean") throw badRequest("enabled must be true or false.");
  if (url !== undefined) run("UPDATE dev_webhooks SET url = ? WHERE id = ?", url, id);
  if (events !== undefined) run("UPDATE dev_webhooks SET events = ? WHERE id = ?", JSON.stringify(events), id);
  if (description !== undefined) run("UPDATE dev_webhooks SET description = ? WHERE id = ?", description, id);
  if (typeof body.enabled === "boolean") run("UPDATE dev_webhooks SET enabled = ? WHERE id = ?", body.enabled ? 1 : 0, id);
  return getWebhook(userId, id);
}

export function deleteWebhook(userId: string, id: string) {
  ownedWebhook(userId, id);
  run("DELETE FROM dev_webhooks WHERE id = ?", id);
}

export function rotateSecret(userId: string, id: string): { webhook: Webhook; secret: string } {
  ownedWebhook(userId, id);
  const secret = newSecret();
  run("UPDATE dev_webhooks SET secret = ? WHERE id = ?", secret, id);
  return { webhook: getWebhook(userId, id), secret };
}

export function listDeliveries(userId: string, webhookId: string, limit: number, before?: number) {
  ownedWebhook(userId, webhookId);
  return all<DeliveryRow>(
    "SELECT * FROM dev_webhook_deliveries WHERE webhook_id = ? AND user_id = ? AND created_at < ? ORDER BY created_at DESC, id DESC LIMIT ?",
    webhookId,
    userId,
    before ?? Number.MAX_SAFE_INTEGER,
    limit,
  ).map(toDelivery);
}

/** Queues a test event and tries it right away. Answers with the delivery as it stands. */
export async function sendTest(userId: string, webhookId: string) {
  const hook = ownedWebhook(userId, webhookId);
  const id = newId("dlv");
  const now = Date.now();
  const payload = { id, type: TEST_EVENT, createdAt: now, data: { message: "This is a test event from Parallax." } };
  run(
    `INSERT INTO dev_webhook_deliveries (id, webhook_id, user_id, event, job_id, payload, status, next_attempt_at, created_at)
     VALUES (?, ?, ?, ?, NULL, ?, 'pending', ?, ?)`,
    id,
    hook.id,
    userId,
    TEST_EVENT,
    JSON.stringify(payload),
    now,
    now,
  );
  state.inflight.add(id); // keeps the dispatcher from sending it a second time meanwhile
  try {
    await attempt(get<DeliveryRow>("SELECT * FROM dev_webhook_deliveries WHERE id = ?", id)!);
  } finally {
    state.inflight.delete(id);
  }
  return toDelivery(get<DeliveryRow>("SELECT * FROM dev_webhook_deliveries WHERE id = ?", id)!);
}

/** Puts a finished delivery back in the queue for one more round of attempts. */
export function retryDelivery(userId: string, webhookId: string, deliveryId: string) {
  ownedWebhook(userId, webhookId);
  const row = get<DeliveryRow>("SELECT * FROM dev_webhook_deliveries WHERE id = ? AND webhook_id = ? AND user_id = ?", deliveryId, webhookId, userId);
  if (!row) throw notFound("That delivery does not exist.");
  if (row.status === "pending") throw new ApiError(409, "invalid_request", "That delivery is already waiting to be sent.");
  run("UPDATE dev_webhook_deliveries SET status = 'pending', attempts = 0, next_attempt_at = ? WHERE id = ?", Date.now(), deliveryId);
  kickDispatcher();
  return toDelivery(get<DeliveryRow>("SELECT * FROM dev_webhook_deliveries WHERE id = ?", deliveryId)!);
}

/* ---------------------------------- signing -------------------------------- */

/** `v1=` + hex HMAC-SHA256 of `<timestamp>.<body>` with the endpoint's secret. */
export function sign(secret: string, timestamp: number, body: string): string {
  return "v1=" + createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

/* --------------------------------- sending --------------------------------- */

function post(urlText: string, body: string, headers: Record<string, string>): Promise<number> {
  const url = new URL(urlText);
  const local = isAllowedLocal(url);
  const lib = url.protocol === "https:" ? https : http;
  if (url.protocol !== "https:" && !local) return Promise.reject(new UrlRefused("The endpoint must use https."));
  return new Promise((resolve, reject) => {
    const req = lib.request(
      url,
      {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json", "Content-Length": String(Buffer.byteLength(body)), "User-Agent": "Parallax-Webhooks/1" },
        lookup: guardedLookup(local),
        timeout: TIMEOUT_MS,
      },
      (res) => {
        // Redirects are not followed: a redirect could point somewhere private.
        res.resume();
        res.on("end", () => resolve(res.statusCode ?? 0));
        res.on("error", reject);
      },
    );
    req.on("timeout", () => req.destroy(new Error("Timed out after 10 seconds.")));
    req.on("error", reject);
    req.end(body);
  });
}

async function attempt(d: DeliveryRow) {
  const hook = get<WebhookRow>("SELECT * FROM dev_webhooks WHERE id = ?", d.webhook_id);
  if (!hook) return;
  const ts = Math.floor(Date.now() / 1000);
  let status: number | null = null;
  let error: string | null = null;
  try {
    status = await post(hook.url, d.payload, {
      "Parallax-Webhook-Id": d.id,
      "Parallax-Webhook-Event": d.event,
      "Parallax-Webhook-Timestamp": String(ts),
      "Parallax-Webhook-Signature": sign(hook.secret, ts, d.payload),
    });
    if (status < 200 || status >= 300) error = `The endpoint answered ${status}.`;
  } catch (err) {
    error = err instanceof UrlRefused ? "Refused: the endpoint is not on the public internet." : "Could not connect to the endpoint.";
  }
  const attempts = d.attempts + 1;
  const now = Date.now();
  if (!error) {
    run("UPDATE dev_webhook_deliveries SET status = 'delivered', attempts = ?, last_status = ?, last_error = NULL, delivered_at = ? WHERE id = ?", attempts, status, now, d.id);
  } else if (attempts >= MAX_ATTEMPTS) {
    run("UPDATE dev_webhook_deliveries SET status = 'failed', attempts = ?, last_status = ?, last_error = ? WHERE id = ?", attempts, status, error, d.id);
  } else {
    run(
      "UPDATE dev_webhook_deliveries SET attempts = ?, last_status = ?, last_error = ?, next_attempt_at = ? WHERE id = ?",
      attempts,
      status,
      error,
      now + BACKOFF_MS[attempts - 1],
      d.id,
    );
  }
}

/* -------------------------------- dispatcher ------------------------------- */

const STATUS_EVENT: Record<string, EventName> = { succeeded: "generation.succeeded", failed: "generation.failed", canceled: "generation.canceled" };

/** Queues deliveries for jobs that finished since the last look. */
function scan() {
  if (!get("SELECT 1 FROM dev_webhooks WHERE enabled = 1 LIMIT 1")) return;
  const mark = Number(get<{ value: string }>("SELECT value FROM dev_state WHERE name = 'watermark'")?.value ?? 0) || Date.now() - 60_000;
  const rows = all<JobRow & { wid: string; wevents: string; wcreated: number }>(
    `SELECT j.*, w.id AS wid, w.events AS wevents, w.created_at AS wcreated
       FROM jobs j JOIN dev_webhooks w ON w.user_id = j.user_id AND w.enabled = 1
      WHERE j.finished_at >= ? AND j.finished_at >= w.created_at AND j.status IN ('succeeded', 'failed', 'canceled')
      ORDER BY j.finished_at LIMIT 500`,
    mark,
  );
  let high = mark;
  const assets = assetsOfJobs([...new Set(rows.filter((r) => r.status === "succeeded").map((r) => r.id))]);
  for (const r of rows) {
    high = Math.max(high, r.finished_at ?? 0);
    const event = STATUS_EVENT[r.status];
    if (!parseJson<string[]>(r.wevents, []).includes(event)) continue;
    const id = newId("dlv");
    const now = Date.now();
    const payload = JSON.stringify({ id, type: event, createdAt: now, data: { generation: generationOut(toJob(r, assets.get(r.id) ?? [])) } });
    run(
      `INSERT OR IGNORE INTO dev_webhook_deliveries (id, webhook_id, user_id, event, job_id, payload, status, next_attempt_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      id,
      r.wid,
      r.user_id,
      event,
      r.id,
      payload,
      now,
      now,
    );
  }
  // `>=` above re-reads the last millisecond; the unique index drops the repeats.
  run("INSERT INTO dev_state (name, value) VALUES ('watermark', ?) ON CONFLICT(name) DO UPDATE SET value = excluded.value", String(high));
}

interface DispatchState {
  owner: symbol | null;
  timer: ReturnType<typeof setTimeout> | null;
  inflight: Set<string>;
}
const shared = globalThis as typeof globalThis & { __parallaxDispatch?: DispatchState };
const state: DispatchState = (shared.__parallaxDispatch ??= { owner: null, timer: null, inflight: new Set() });
const me = Symbol("dispatcher");
const TICK_MS = 1000;

/** Starts the loop if this process is not running it yet. Cheap; called on every API request. */
export function ensureDispatcher() {
  if (state.owner === me) return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  state.owner = me;
  schedule(100);
}

function kickDispatcher() {
  if (state.owner === me) schedule(20);
  else ensureDispatcher();
}

function schedule(ms: number) {
  if (state.owner !== me) return;
  if (state.timer) clearTimeout(state.timer);
  state.timer = setTimeout(tick, ms);
  state.timer.unref?.();
}

function tick() {
  if (state.owner !== me) return;
  try {
    scan();
    const due = all<DeliveryRow>("SELECT * FROM dev_webhook_deliveries WHERE status = 'pending' AND next_attempt_at <= ? ORDER BY next_attempt_at LIMIT 20", Date.now());
    for (const d of due) {
      if (state.inflight.has(d.id) || state.inflight.size >= 8) continue;
      state.inflight.add(d.id);
      attempt(d)
        .catch((err) => console.error("[webhooks] attempt failed:", err instanceof Error ? err.message : err))
        .finally(() => state.inflight.delete(d.id));
    }
  } catch (err) {
    console.error("[webhooks] tick failed:", err instanceof Error ? err.message : err);
  }
  schedule(TICK_MS);
}
