import "server-only";

import { headers } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { run } from "../db";
import { ApiError } from "../errors";
import { ensureWorker } from "../worker";
import { ensureDispatcher } from "./webhooks";
import { authenticate, type ApiKey, type KeyAuth, type Scope } from "./keys";
import { ROUTES, type RouteId } from "./routes";
import type { User } from "../auth";

/**
 * The wrapper for every `/api/v1` route. The foundation's `route()` reads a cookie
 * session; this one reads `Authorization: Bearer <key>` instead, applies the key's
 * scope and rate limit, logs the request for the usage table, and keeps the same
 * error shape: { "error": { "code", "message" } }.
 */

export interface ApiCtx<P> {
  req: NextRequest;
  user: User;
  key: ApiKey;
  params: P;
  /** Records the credits this request held, for the request log. */
  spent(millicredits: number): void;
}

type Result = Response | Record<string, unknown>;

/* ------------------------------- rate limit ------------------------------- */

export const RATE_WINDOW_MS = 60_000;
export function rateLimitMax(): number {
  const n = Number(process.env.PARALLAX_API_RATE_LIMIT);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 120;
}

interface Bucket {
  n: number;
  reset: number;
}
const buckets = ((globalThis as unknown as { __parallaxApiLimits?: Map<string, Bucket> }).__parallaxApiLimits ??= new Map());

export interface RateState {
  limit: number;
  remaining: number;
  reset: number;
  allowed: boolean;
}

/** A fixed one-minute window per key. In memory, so per process. */
export function takeToken(keyId: string): RateState {
  const now = Date.now();
  const limit = rateLimitMax();
  let b = buckets.get(keyId);
  if (!b || b.reset <= now) {
    b = { n: 0, reset: now + RATE_WINDOW_MS };
    buckets.set(keyId, b);
    if (buckets.size > 10_000) for (const [k, v] of buckets) if (v.reset <= now) buckets.delete(k);
  }
  b.n++;
  return { limit, remaining: Math.max(0, limit - b.n), reset: b.reset, allowed: b.n <= limit };
}

export function rateHeaders(res: Response, s: RateState) {
  res.headers.set("X-RateLimit-Limit", String(s.limit));
  res.headers.set("X-RateLimit-Remaining", String(s.remaining));
  res.headers.set("X-RateLimit-Reset", String(Math.ceil(s.reset / 1000)));
  if (!s.allowed) res.headers.set("Retry-After", String(Math.max(1, Math.ceil((s.reset - Date.now()) / 1000))));
}

/* ------------------------------- request log ------------------------------ */

let writes = 0;

export function logRequest(auth: KeyAuth, method: string, routePath: string, status: number, credits: number) {
  try {
    run(
      "INSERT INTO dev_request_log (key_id, user_id, method, route, status, credits, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      auth.key.id,
      auth.user.id,
      method,
      routePath,
      status,
      Math.max(0, Math.round(credits)),
      Date.now(),
    );
    // Keep 30 days. Trim now and then rather than on every write.
    if (++writes % 500 === 0) run("DELETE FROM dev_request_log WHERE created_at < ?", Date.now() - 30 * 86_400_000);
  } catch (err) {
    console.error("[developer] request log failed:", err instanceof Error ? err.message : err);
  }
}

/* --------------------------------- errors --------------------------------- */

export function errorResponse(err: unknown): Response {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.status });
  }
  console.error("[api/v1] unexpected error:", err instanceof Error ? (err.stack ?? err.message) : err);
  return NextResponse.json({ error: { code: "server_error", message: "Something went wrong on our side." } }, { status: 500 });
}

export const unauthorized = () => new ApiError(401, "unauthorized", "Send a valid API key as Authorization: Bearer <key>.");
export const missingScope = (scope: Scope) => new ApiError(403, "forbidden", `This key does not have the "${scope}" scope.`);
export const rateLimited = () => new ApiError(429, "rate_limited", "Too many requests for this key. Wait a moment and try again.");

/**
 * Key check shared by the REST wrapper and the MCP endpoint. Returns the auth and
 * the rate state; throws 401 or 429 (the caller still adds the rate headers).
 */
export function openKey(authorization: string | null): { auth: KeyAuth; rate: RateState } {
  ensureWorker();
  ensureDispatcher();
  const auth = authenticate(authorization);
  if (!auth) throw unauthorized();
  return { auth, rate: takeToken(auth.key.id) };
}

/* --------------------------------- wrapper -------------------------------- */

export function apiRoute<P = Record<string, never>>(id: RouteId, handler: (ctx: ApiCtx<P>) => Promise<Result> | Result) {
  const spec = ROUTES[id];
  return async (req: NextRequest, context: { params: Promise<P> }): Promise<Response> => {
    // Reading headers marks the route as request-time; Next's build probe rejects here, uncaught on purpose.
    const h = await headers();
    let auth: KeyAuth | null = null;
    let rate: RateState | null = null;
    let credits = 0;
    let res: Response;
    try {
      const opened = openKey(h.get("authorization"));
      auth = opened.auth;
      rate = opened.rate;
      if (!rate.allowed) throw rateLimited();
      if (!auth.key.scopes.includes(spec.scope)) throw missingScope(spec.scope);
      const out = await handler({ req, user: auth.user, key: auth.key, params: await context.params, spent: (n) => (credits = n) });
      res = out instanceof Response ? out : NextResponse.json(out);
    } catch (err) {
      res = errorResponse(err);
    }
    if (rate) rateHeaders(res, rate);
    if (auth) logRequest(auth, spec.method, spec.path, res.status, res.status < 300 ? credits : 0);
    return res;
  };
}
