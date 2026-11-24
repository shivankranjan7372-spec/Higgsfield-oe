import "server-only";

import { getModel, models } from "@/registry";
import { listAssets, toAsset } from "@/server/assets";
import { all, newId, run } from "@/server/db";
import { badRequest, notFound } from "@/server/errors";
import { modelItem } from "./search";

/** Recent searches kept per member. */
const KEEP = 20;

export interface RecentSearch {
  id: string;
  query: string;
  createdAt: number;
}

export function listRecent(userId: string, limit = 10): RecentSearch[] {
  return all<{ id: string; query: string; created_at: number }>(
    "SELECT id, query, created_at FROM notify_recent_searches WHERE user_id = ? ORDER BY created_at DESC, id LIMIT ?",
    userId, limit,
  ).map((r) => ({ id: r.id, query: r.query, createdAt: r.created_at }));
}

/** Saves a query. Saving the same query again moves it to the top. */
export function saveRecent(userId: string, raw: unknown): RecentSearch {
  if (typeof raw !== "string") throw badRequest("Send the search as text.");
  const query = raw.trim().replace(/\s+/g, " ");
  if (!query) throw badRequest("There is nothing to save.");
  if (query.length > 100) throw badRequest("Keep searches under 100 characters.");
  const now = Date.now();
  run(
    `INSERT INTO notify_recent_searches (id, user_id, query, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (user_id, query) DO UPDATE SET created_at = excluded.created_at`,
    newId("rsq"), userId, query, now,
  );
  run(
    `DELETE FROM notify_recent_searches WHERE user_id = ? AND id NOT IN
       (SELECT id FROM notify_recent_searches WHERE user_id = ? ORDER BY created_at DESC, id LIMIT ?)`,
    userId, userId, KEEP,
  );
  return listRecent(userId, 1)[0];
}

export function clearRecent(userId: string): number {
  return run("DELETE FROM notify_recent_searches WHERE user_id = ?", userId).changes;
}

export function removeRecent(userId: string, id: string) {
  if (run("DELETE FROM notify_recent_searches WHERE id = ? AND user_id = ?", id, userId).changes === 0) {
    throw notFound("That search is not in your history.");
  }
}

/**
 * The empty state of the search box: popular models (most used across Parallax in the
 * last 30 days, topped up with featured ones), plus the member's recent files and searches.
 */
export function suggestions(userId: string | null) {
  const used = all<{ model_id: string; n: number }>(
    "SELECT model_id, COUNT(*) AS n FROM jobs WHERE created_at > ? GROUP BY model_id ORDER BY n DESC LIMIT 20",
    Date.now() - 30 * 86_400_000,
  );
  const picked: string[] = [];
  for (const r of used) {
    const m = getModel(r.model_id);
    if (m && m.status === "available" && !picked.includes(m.id)) picked.push(m.id);
  }
  for (const m of models) if (m.featured && m.status === "available" && !picked.includes(m.id)) picked.push(m.id);
  const popularModels = picked.slice(0, 6).map((id) => modelItem(getModel(id)!, "prefix"));

  const recentItems = userId
    ? listAssets(userId, { limit: 6 }).map((r) => {
        const a = toAsset(r);
        return {
          type: "files" as const,
          id: a.id,
          title: a.title || a.prompt.slice(0, 80) || "Untitled",
          subtitle: a.kind,
          href: `/library?asset=${a.id}`,
          thumbUrl: a.posterUrl ?? (a.kind === "image" ? a.url : null),
          createdAt: a.createdAt,
          extra: { kind: a.kind, source: a.source, url: a.url },
        };
      })
    : [];
  return { popularModels, recentItems, recentSearches: userId ? listRecent(userId, 8) : [] };
}
