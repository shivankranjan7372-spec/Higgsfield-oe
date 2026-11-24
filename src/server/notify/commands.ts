import "server-only";

import { primaryNav } from "@/config/brand";
import { matchOf } from "./search";

/**
 * Command palette entries: every top-level destination from `primaryNav`, plus our own
 * shortcuts and actions. `go` entries navigate to `href`. `action` entries call `api`
 * (same-origin fetch, JSON body) and then, if given, navigate to `href`.
 */
export interface Command {
  id: string;
  type: "go" | "action";
  group: "Go to" | "Library" | "Account" | "Actions";
  label: string;
  hint: string;
  href: string | null;
  api: { method: "POST" | "DELETE"; path: string; body: Record<string, unknown> | null } | null;
  keywords: string[];
  /** Suggested keyboard shortcut, display only. */
  shortcut: string | null;
  /** Who sees it: everyone, members only (guests count), or signed-out visitors only. */
  audience: "all" | "member" | "visitor";
}

const c = (x: Partial<Command> & Pick<Command, "id" | "type" | "group" | "label">): Command => ({
  hint: "", href: null, api: null, keywords: [], shortcut: null, audience: "all", ...x,
});

const OWN: Command[] = [
  c({ id: "library-favorites", type: "go", group: "Library", label: "Favorites", hint: "Files you starred", href: "/library?favorite=1", keywords: ["starred", "liked", "saved"], audience: "member" }),
  c({ id: "library-uploads", type: "go", group: "Library", label: "Uploads", hint: "Files you brought in", href: "/library?source=upload", keywords: ["uploaded", "my files"], audience: "member" }),
  c({ id: "library-videos", type: "go", group: "Library", label: "My videos", hint: "Every video you made", href: "/library?kind=video", keywords: ["clips"], audience: "member" }),
  c({ id: "library-images", type: "go", group: "Library", label: "My images", hint: "Every image you made", href: "/library?kind=image", keywords: ["pictures", "photos"], audience: "member" }),
  c({ id: "notifications", type: "go", group: "Account", label: "Notifications", hint: "What happened while you were away", href: "/notifications", keywords: ["alerts", "inbox", "bell"], audience: "member" }),
  c({ id: "notification-settings", type: "go", group: "Account", label: "Notification settings", hint: "Choose what you hear about", href: "/settings/notifications", keywords: ["preferences", "mute"], audience: "member" }),
  c({ id: "wallet", type: "go", group: "Account", label: "Credits", hint: "Balance, history and top-ups", href: "/wallet", keywords: ["wallet", "balance", "top up", "buy"], audience: "member" }),
  c({ id: "whats-new", type: "go", group: "Account", label: "What's new", hint: "Recent changes to Parallax", href: "/whats-new", keywords: ["changelog", "updates", "news"] }),
  c({ id: "upload", type: "action", group: "Actions", label: "Upload a file", hint: "Add an image, video or audio file", href: "/library?upload=1", keywords: ["import", "add"], shortcut: "U", audience: "member" }),
  c({ id: "mark-all-read", type: "action", group: "Actions", label: "Mark all notifications read", hint: "Clear the unread badge", api: { method: "POST", path: "/api/notifications/read", body: { all: true } }, keywords: ["clear", "dismiss"], audience: "member" }),
  c({ id: "clear-searches", type: "action", group: "Actions", label: "Clear recent searches", hint: "Forget what you searched for", api: { method: "DELETE", path: "/api/search/recent", body: null }, keywords: ["history", "forget"], audience: "member" }),
  c({ id: "sign-out", type: "action", group: "Actions", label: "Sign out", hint: "End this session", href: "/", api: { method: "POST", path: "/api/auth/logout", body: null }, keywords: ["log out", "logout"], audience: "member" }),
  c({ id: "sign-in", type: "go", group: "Actions", label: "Sign in", hint: "Use your Parallax account", href: "/login", keywords: ["log in", "login", "account"], audience: "visitor" }),
  c({ id: "try-as-guest", type: "action", group: "Actions", label: "Try without an account", hint: "Start as a guest with free credits", api: { method: "POST", path: "/api/auth/guest", body: null }, keywords: ["guest", "demo"], audience: "visitor" }),
];

export function commands(signedIn: boolean, rawQuery = ""): Command[] {
  const nav = primaryNav.map((n, i) =>
    c({ id: `go-${n.href.replace(/^\//, "") || "home"}`, type: "go", group: "Go to", label: n.label, hint: n.blurb, href: n.href, shortcut: i < 9 ? `G ${i + 1}` : null }),
  );
  const list = [...nav, ...OWN].filter((x) => x.audience === "all" || (x.audience === "member") === signedIn);
  const q = rawQuery.trim().toLowerCase();
  if (!q) return list;
  const order = new Map(list.map((x, i) => [x.id, i]));
  const rank = { prefix: 0, word: 1, contains: 2, detail: 3 } as const;
  return list
    .map((x) => ({ x, m: matchOf(q, x.label, [x.hint, ...x.keywords]) }))
    .filter((r) => r.m)
    .sort((a, b) => rank[a.m!] - rank[b.m!] || order.get(a.x.id)! - order.get(b.x.id)!)
    .map((r) => r.x);
}
