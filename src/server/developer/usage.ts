import "server-only";

import { all, get, type Param } from "../db";
import { notFound } from "../errors";

/** The request log behind the usage table. */

interface LogRow {
  id: number;
  key_id: string;
  method: string;
  route: string;
  status: number;
  credits: number;
  created_at: number;
}

export function usage(userId: string, f: { keyId?: string; limit: number; before?: number }) {
  if (f.keyId && !get("SELECT 1 FROM dev_api_keys WHERE id = ? AND user_id = ?", f.keyId, userId)) throw notFound("That key does not exist.");
  const where = ["user_id = ?", "id < ?"];
  const params: Param[] = [userId, f.before ?? Number.MAX_SAFE_INTEGER];
  if (f.keyId) (where.push("key_id = ?"), params.push(f.keyId));
  const rows = all<LogRow>(`SELECT * FROM dev_request_log WHERE ${where.join(" AND ")} ORDER BY id DESC LIMIT ?`, ...params, f.limit);
  const since = Date.now() - 86_400_000;
  const totals = all<{ key_id: string; requests: number; errors: number; credits: number }>(
    `SELECT key_id, COUNT(*) AS requests, SUM(CASE WHEN status >= 400 THEN 1 ELSE 0 END) AS errors, COALESCE(SUM(credits), 0) AS credits
       FROM dev_request_log WHERE user_id = ? AND created_at > ? GROUP BY key_id`,
    userId,
    since,
  );
  return {
    requests: rows.map((r) => ({ id: r.id, keyId: r.key_id, method: r.method, route: r.route, status: r.status, credits: r.credits, createdAt: r.created_at, cursor: r.id })),
    last24h: totals.map((t) => ({ keyId: t.key_id, requests: t.requests, errors: t.errors, credits: t.credits })),
  };
}
