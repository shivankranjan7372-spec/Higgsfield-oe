import "server-only";

import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import type { User } from "@/server/auth";
import { ApiError, badRequest } from "@/server/errors";
import { clientKey, rateLimit } from "@/server/http";
import { notify, type NoticeKind } from "@/server/notify";

/** Small helpers shared by the community modules. */

export const MINUTE = 60_000;
export const HOUR = 3_600_000;
export const DAY = 86_400_000;

/** Guest accounts may like, save and hide, but anything others read under their name needs a full account. */
export function requireAccount(user: User, doing: string) {
  if (user.isGuest) throw new ApiError(403, "account_required", `Create a free account to ${doing}.`);
}

/**
 * Tells a member that someone did something with their work: a like, a comment, a follow.
 * Nobody is told about their own actions, and a notice that cannot be sent never fails the
 * action that caused it. The `key` makes it once only: liking again after unliking stays quiet.
 */
export function tell(to: string, from: User, kind: NoticeKind, key: string, notice: { title: string; body?: string; link: string; data?: Record<string, unknown> }) {
  if (to === from.id) return;
  try {
    notify(to, kind, { title: notice.title, body: notice.body, link: notice.link, data: { ...notice.data, fromUserId: from.id }, dedupeKey: key });
  } catch (err) {
    console.error("[community] notice not sent:", (err as Error).message);
  }
}

/** The name to show for whoever did it. */
export function nameOf(user: User): string {
  return user.name.trim() || `@${user.handle}`;
}

/** Abuse limits. Each one counts per member, so one noisy account cannot slow anyone else down. */
export const LIMITS = {
  publish: { max: 30, window: HOUR },
  like: { max: 120, window: MINUTE },
  save: { max: 120, window: MINUTE },
  comment: { max: 10, window: MINUTE },
  commentDaily: { max: 200, window: DAY },
  follow: { max: 60, window: HOUR },
  hide: { max: 60, window: HOUR },
  report: { max: 20, window: DAY },
  vote: { max: 120, window: HOUR },
  enter: { max: 20, window: HOUR },
  view: { max: 300, window: MINUTE },
} as const;

export function limit(action: keyof typeof LIMITS, key: string) {
  const l = LIMITS[action];
  rateLimit(`community:${action}:${key}`, l.max, l.window);
}

/** Who is looking: the member id, or a one-way hash of the address for signed-out visitors. */
export function viewerKey(req: NextRequest, user: User | null): string {
  if (user) return user.id;
  const ua = req.headers.get("user-agent") ?? "";
  return "anon:" + createHash("sha256").update(`${clientKey(req)}|${ua}`).digest("hex").slice(0, 24);
}

/* ---------------------------------- input --------------------------------- */

export function optionalText(value: unknown, field: string, max: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw badRequest(`The ${field} must be text.`);
  const text = value.replace(/\r\n/g, "\n").trim();
  if (text.length > max) throw badRequest(`Keep the ${field} under ${max.toLocaleString("en-US")} characters.`);
  return text;
}

export const MAX_TAGS = 8;
const TAG = /^[a-z0-9][a-z0-9-]{0,29}$/;

/** "#Night City" -> "night-city". Returns null when nothing usable is left. */
export function normalizeTag(raw: string): string | null {
  const tag = raw.trim().toLowerCase().replace(/^#+/, "").replace(/[\s_]+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return TAG.test(tag) ? tag : null;
}

export function cleanTags(value: unknown): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.some((t) => typeof t !== "string" || t.length > 60)) throw badRequest("Tags must be a list of short words.");
  const tags = [...new Set((value as string[]).map(normalizeTag).filter((t): t is string => t !== null))];
  if (tags.length > MAX_TAGS) throw badRequest(`Use at most ${MAX_TAGS} tags.`);
  return tags;
}

/* --------------------------------- cursors -------------------------------- */

/**
 * Cursors are opaque to the browser. Ranked lists (trending, top) page by offset and
 * pin the clock of the first page, so the time decay does not reshuffle later pages.
 */
export interface Cursor {
  /** Last seen row seq, for lists in publish order. */
  s?: number;
  /** Offset, for ranked lists. */
  o?: number;
  /** Clock of the first page. */
  t?: number;
}

export function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c)).toString("base64url");
}

export function decodeCursor(raw: string | null): Cursor {
  if (!raw) return {};
  try {
    const c = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Record<string, unknown>;
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : undefined);
    return { s: num(c.s), o: num(c.o), t: num(c.t) };
  } catch {
    throw badRequest("That page link is not valid. Reload the list.");
  }
}
