import "server-only";

import { createHash, randomBytes } from "node:crypto";
import type { User } from "../auth";
import { userById } from "../auth";
import { all, get, newId, parseJson, run, tx } from "../db";
import { ApiError, badRequest, notFound } from "../errors";

/**
 * API keys. A key is `pxk_` plus 32 random bytes. Only its SHA-256 is stored, so a
 * leaked database does not leak working keys. The member sees the key once, at creation.
 */

export const SCOPES = ["read", "generate"] as const;
export type Scope = (typeof SCOPES)[number];

/** Active (not revoked) keys a member may hold. */
export const MAX_KEYS = 10;
const KEY_PREFIX = "pxk_";

export interface KeyRow {
  id: string;
  user_id: string;
  name: string;
  prefix: string;
  key_hash: string;
  scopes: string;
  created_at: number;
  last_used_at: number | null;
  revoked_at: number | null;
}

export interface ApiKey {
  id: string;
  name: string;
  /** The first characters of the key, for telling keys apart. */
  prefix: string;
  scopes: Scope[];
  createdAt: number;
  lastUsedAt: number | null;
  revokedAt: number | null;
}

export function toKey(r: KeyRow): ApiKey {
  return {
    id: r.id,
    name: r.name,
    prefix: r.prefix,
    scopes: parseJson<Scope[]>(r.scopes, []),
    createdAt: r.created_at,
    lastUsedAt: r.last_used_at,
    revokedAt: r.revoked_at,
  };
}

export const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");

export function cleanName(raw: unknown): string {
  if (raw === undefined || raw === null) return "Untitled key";
  if (typeof raw !== "string") throw badRequest("The key name must be text.");
  const name = raw.replace(/\s+/g, " ").trim();
  if (name.length > 60) throw badRequest("Keep the key name under 60 characters.");
  return name || "Untitled key";
}

export function cleanScopes(raw: unknown): Scope[] {
  if (raw === undefined || raw === null) return [...SCOPES];
  if (!Array.isArray(raw) || raw.length === 0) throw badRequest("Pick at least one scope: read or generate.");
  const out = new Set<Scope>();
  for (const s of raw) {
    const scope = SCOPES.find((x) => x === s);
    if (!scope) throw badRequest("Scopes can only be read and generate.");
    out.add(scope);
  }
  return SCOPES.filter((s) => out.has(s));
}

function requireAccount(user: User) {
  if (user.isGuest) throw new ApiError(403, "account_required", "Create a free account to use API keys.");
}

export function listKeys(userId: string): ApiKey[] {
  return all<KeyRow>("SELECT * FROM dev_api_keys WHERE user_id = ? ORDER BY revoked_at IS NOT NULL, created_at DESC", userId).map(toKey);
}

export function createKey(user: User, input: { name?: unknown; scopes?: unknown }): { key: ApiKey; secret: string } {
  requireAccount(user);
  const name = cleanName(input.name);
  const scopes = cleanScopes(input.scopes);
  const secret = KEY_PREFIX + randomBytes(32).toString("base64url");
  const id = newId("key");
  tx(() => {
    const n = get<{ n: number }>("SELECT COUNT(*) AS n FROM dev_api_keys WHERE user_id = ? AND revoked_at IS NULL", user.id)!.n;
    if (n >= MAX_KEYS) throw new ApiError(409, "limit_reached", `You can have ${MAX_KEYS} active keys. Revoke one first.`);
    run(
      "INSERT INTO dev_api_keys (id, user_id, name, prefix, key_hash, scopes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      id,
      user.id,
      name,
      secret.slice(0, 12),
      hashKey(secret),
      JSON.stringify(scopes),
      Date.now(),
    );
  });
  return { key: toKey(get<KeyRow>("SELECT * FROM dev_api_keys WHERE id = ?", id)!), secret };
}

function ownedKey(userId: string, id: string): KeyRow {
  const row = get<KeyRow>("SELECT * FROM dev_api_keys WHERE id = ? AND user_id = ?", id, userId);
  if (!row) throw notFound("That key does not exist.");
  return row;
}

export function getKey(userId: string, id: string): ApiKey {
  return toKey(ownedKey(userId, id));
}

export function updateKey(userId: string, id: string, input: { name?: unknown; scopes?: unknown }): ApiKey {
  const row = ownedKey(userId, id);
  if (row.revoked_at) throw new ApiError(409, "invalid_request", "That key was revoked. Create a new one.");
  if (input.name !== undefined) run("UPDATE dev_api_keys SET name = ? WHERE id = ?", cleanName(input.name), id);
  if (input.scopes !== undefined) run("UPDATE dev_api_keys SET scopes = ? WHERE id = ?", JSON.stringify(cleanScopes(input.scopes)), id);
  return getKey(userId, id);
}

/** Revoking is permanent. The row stays so the usage table still names the key. */
export function revokeKey(userId: string, id: string): ApiKey {
  ownedKey(userId, id);
  run("UPDATE dev_api_keys SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL", Date.now(), id);
  return getKey(userId, id);
}

export interface KeyAuth {
  key: ApiKey;
  user: User;
}

/** Resolves `Authorization: Bearer <key>`. Null when absent, unknown or revoked. */
export function authenticate(header: string | null): KeyAuth | null {
  const m = /^Bearer\s+(\S+)\s*$/i.exec(header ?? "");
  if (!m || !m[1].startsWith(KEY_PREFIX) || m[1].length > 200) return null;
  const row = get<KeyRow>("SELECT * FROM dev_api_keys WHERE key_hash = ? AND revoked_at IS NULL", hashKey(m[1]));
  if (!row) return null;
  const user = userById(row.user_id);
  if (!user) return null;
  // Write last-used at most once a minute: it is shown to the member, not used for security.
  const now = Date.now();
  if (!row.last_used_at || now - row.last_used_at > 60_000) run("UPDATE dev_api_keys SET last_used_at = ? WHERE id = ?", now, row.id);
  return { key: toKey({ ...row, last_used_at: now }), user };
}
