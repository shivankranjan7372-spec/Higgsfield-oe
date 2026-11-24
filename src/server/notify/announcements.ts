import "server-only";

import { all, run } from "@/server/db";

/**
 * "What's new": short product news, kept as data. Newest first. Add an entry to publish.
 * `id` must never change once shipped: seen state is stored against it.
 */
export interface Announcement {
  id: string;
  title: string;
  body: string;
  link: string | null;
  tag: "new" | "improved" | "fixed";
  publishedAt: number;
}

export const ANNOUNCEMENTS: Announcement[] = [
  {
    id: "2026-11-search",
    title: "Find anything from one box",
    body: "Search now looks through models, your files, your generations, folders and public posts at once. Press the search button or start typing on any page.",
    link: null,
    tag: "new",
    publishedAt: Date.UTC(2026, 10, 12),
  },
  {
    id: "2026-11-notices",
    title: "Know when your work is done",
    body: "You get a notice when a generation finishes or fails, and a heads-up before your credits run out. Choose which ones you want in notification settings.",
    link: "/settings/notifications",
    tag: "new",
    publishedAt: Date.UTC(2026, 10, 10),
  },
  {
    id: "2026-11-prices",
    title: "See the price before you press Generate",
    body: "Every studio shows the exact credit cost for your settings as you change them. Failed generations always give their credits back.",
    link: "/image",
    tag: "improved",
    publishedAt: Date.UTC(2026, 10, 3),
  },
];

const ids = new Set(ANNOUNCEMENTS.map((a) => a.id));

export function whatsNew(userId: string | null) {
  const seen = new Set(
    userId ? all<{ announcement_id: string }>("SELECT announcement_id FROM notify_seen WHERE user_id = ?", userId).map((r) => r.announcement_id) : [],
  );
  const items = ANNOUNCEMENTS.map((a) => ({ ...a, seen: seen.has(a.id) }));
  return { items, unseen: items.filter((a) => !a.seen).length };
}

/** Marks the given announcements, or all of them, as seen. Unknown ids are ignored. */
export function markSeen(userId: string, which: string[] | "all") {
  const list = which === "all" ? [...ids] : which.filter((id) => ids.has(id));
  const now = Date.now();
  for (const id of list) run("INSERT OR IGNORE INTO notify_seen (user_id, announcement_id, seen_at) VALUES (?, ?, ?)", userId, id, now);
  return whatsNew(userId);
}
