import "server-only";

import { all, get, newId, parseJson, run, type Param } from "@/server/db";
import { badRequest, notFound } from "@/server/errors";
import { publish } from "./bus";
import { KIND_INFO, NOTICE_KINDS, isKind, type NoticeKind } from "./kinds";

/** Notices kept per member. Older ones are pruned when new ones arrive. */
const KEEP = 500;

interface NoticeRow {
  seq: number;
  id: string;
  user_id: string;
  kind: NoticeKind;
  title: string;
  body: string;
  link: string | null;
  data: string;
  dedupe_key: string | null;
  read_at: number | null;
  created_at: number;
}

/** What the browser gets. */
export interface Notice {
  id: string;
  kind: NoticeKind;
  title: string;
  body: string;
  link: string | null;
  data: Record<string, unknown>;
  read: boolean;
  readAt: number | null;
  createdAt: number;
  /** Pass as `before` to read the next page. */
  cursor: number;
}

function toNotice(r: NoticeRow): Notice {
  return {
    id: r.id,
    kind: r.kind,
    title: r.title,
    body: r.body,
    link: r.link,
    data: parseJson<Record<string, unknown>>(r.data, {}),
    read: r.read_at != null,
    readAt: r.read_at,
    createdAt: r.created_at,
    cursor: r.seq,
  };
}

export interface NotifyInput {
  title: string;
  body?: string;
  /** An in-app path such as `/library?job=...`. Anything else is dropped. */
  link?: string | null;
  data?: Record<string, unknown>;
  /** At most one notice per member and key, ever. Use it to make a call safe to repeat. */
  dedupeKey?: string | null;
}

export function kindEnabled(userId: string, kind: NoticeKind): boolean {
  if (!KIND_INFO[kind].canMute) return true;
  const row = get<{ enabled: number }>("SELECT enabled FROM notify_prefs WHERE user_id = ? AND kind = ?", userId, kind);
  return row ? row.enabled === 1 : true;
}

const safeLink = (link: unknown): string | null =>
  typeof link === "string" && link.startsWith("/") && !link.startsWith("//") && link.length <= 500 ? link : null;

/**
 * Creates a notice for one member and pushes it to their open event streams.
 * Returns null when the member muted this kind, when `dedupeKey` was already used,
 * or when the member does not exist. Never throws for those cases, so callers in other
 * features can fire and forget.
 */
export function notify(userId: string, kind: NoticeKind, input: NotifyInput): Notice | null {
  if (!isKind(kind)) throw new Error(`Unknown notice kind: ${String(kind)}`);
  const title = String(input.title ?? "").trim().slice(0, 140);
  if (!title) throw new Error("A notice needs a title.");
  if (!get("SELECT 1 FROM users WHERE id = ?", userId)) return null;
  if (!kindEnabled(userId, kind)) return null;
  const dedupe = input.dedupeKey ? String(input.dedupeKey).slice(0, 200) : null;
  const id = newId("ntc");
  const data = JSON.stringify(input.data ?? {});
  const r = run(
    `INSERT INTO notify_notices (id, user_id, kind, title, body, link, data, dedupe_key, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
    id, userId, kind, title, String(input.body ?? "").slice(0, 1000), safeLink(input.link), data.length > 8000 ? "{}" : data, dedupe, Date.now(),
  );
  if (r.changes === 0) return null;
  run(
    `DELETE FROM notify_notices WHERE user_id = ? AND seq <= (SELECT seq FROM notify_notices WHERE user_id = ? ORDER BY seq DESC LIMIT 1 OFFSET ?)`,
    userId, userId, KEEP,
  );
  const notice = toNotice(get<NoticeRow>("SELECT * FROM notify_notices WHERE id = ?", id)!);
  publish(userId, { event: "notice", data: { notice, unread: unreadCount(userId) } });
  return notice;
}

export function unreadCount(userId: string): number {
  return get<{ n: number }>("SELECT COUNT(*) AS n FROM notify_notices WHERE user_id = ? AND read_at IS NULL AND deleted_at IS NULL", userId)!.n;
}

export interface NoticeFilter {
  unread?: boolean;
  kinds?: NoticeKind[];
  limit: number;
  before?: number;
}

export function listNotices(userId: string, f: NoticeFilter): Notice[] {
  const where = ["user_id = ?", "deleted_at IS NULL"];
  const params: Param[] = [userId];
  if (f.unread) where.push("read_at IS NULL");
  if (f.kinds?.length) {
    where.push(`kind IN (${f.kinds.map(() => "?").join(",")})`);
    params.push(...f.kinds);
  }
  if (f.before) (where.push("seq < ?"), params.push(f.before));
  return all<NoticeRow>(`SELECT * FROM notify_notices WHERE ${where.join(" AND ")} ORDER BY seq DESC LIMIT ?`, ...params, f.limit).map(toNotice);
}

function owned(userId: string, id: string): NoticeRow {
  const row = get<NoticeRow>("SELECT * FROM notify_notices WHERE id = ? AND user_id = ? AND deleted_at IS NULL", id, userId);
  if (!row) throw notFound("That notification does not exist.");
  return row;
}

const pushUnread = (userId: string) => publish(userId, { event: "unread", data: { unread: unreadCount(userId) } });

export function setRead(userId: string, id: string, read: boolean): Notice {
  owned(userId, id);
  run("UPDATE notify_notices SET read_at = ? WHERE id = ? AND user_id = ?", read ? Date.now() : null, id, userId);
  pushUnread(userId);
  return toNotice(owned(userId, id));
}

/** Marks the given ids (only the member's own; others are ignored) or every notice as read. */
export function markRead(userId: string, ids: string[] | "all"): number {
  const now = Date.now();
  let changed = 0;
  if (ids === "all") changed = run("UPDATE notify_notices SET read_at = ? WHERE user_id = ? AND read_at IS NULL AND deleted_at IS NULL", now, userId).changes;
  else if (ids.length) {
    changed = run(
      `UPDATE notify_notices SET read_at = ? WHERE user_id = ? AND read_at IS NULL AND deleted_at IS NULL AND id IN (${ids.map(() => "?").join(",")})`,
      now, userId, ...ids,
    ).changes;
  }
  if (changed) pushUnread(userId);
  return changed;
}

export function removeNotice(userId: string, id: string) {
  owned(userId, id);
  // A tombstone, not a DELETE: the dedupe key must survive or the job scan would bring it back.
  run("UPDATE notify_notices SET deleted_at = ? WHERE id = ? AND user_id = ?", Date.now(), id, userId);
  pushUnread(userId);
}

/* ------------------------------ preferences ------------------------------- */

export function preferences(userId: string) {
  const rows = all<{ kind: string; enabled: number }>("SELECT kind, enabled FROM notify_prefs WHERE user_id = ?", userId);
  const set = new Map(rows.map((r) => [r.kind, r.enabled === 1]));
  return NOTICE_KINDS.map((kind) => ({
    kind,
    label: KIND_INFO[kind].label,
    group: KIND_INFO[kind].group,
    canMute: KIND_INFO[kind].canMute,
    enabled: KIND_INFO[kind].canMute ? (set.get(kind) ?? true) : true,
  }));
}

export function setPreferences(userId: string, changes: Record<string, unknown>) {
  const entries = Object.entries(changes);
  if (entries.length === 0) throw badRequest("Say which kinds to turn on or off.");
  for (const [kind, enabled] of entries) {
    if (!isKind(kind)) throw badRequest(`"${kind.slice(0, 40)}" is not a kind of notification.`);
    if (typeof enabled !== "boolean") throw badRequest("Use true or false for each kind.");
    if (!KIND_INFO[kind].canMute && !enabled) throw badRequest(`"${KIND_INFO[kind].label}" cannot be turned off.`);
  }
  const now = Date.now();
  for (const [kind, enabled] of entries) {
    run(
      `INSERT INTO notify_prefs (user_id, kind, enabled, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (user_id, kind) DO UPDATE SET enabled = excluded.enabled, updated_at = excluded.updated_at`,
      userId, kind, enabled ? 1 : 0, now,
    );
  }
  return preferences(userId);
}
