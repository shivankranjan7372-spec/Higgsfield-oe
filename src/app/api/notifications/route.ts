import { badRequest, intParam, route } from "@/server/http";
import { isKind, listNotices, syncNotices, unreadCount } from "@/server/notify";

/**
 * GET /api/notifications?unread=1&kind=a,b&limit=&before=
 * The member's notices, newest first, plus the unread count.
 */
export const GET = route(({ req, user }) => {
  const q = req.nextUrl.searchParams;
  const kinds = (q.get("kind") ?? "").split(",").filter(Boolean);
  if (kinds.length > 20 || !kinds.every(isKind)) throw badRequest("Unknown kind of notification.");
  syncNotices(user.id, true);
  const limit = intParam(req, "limit", 30, 1, 100);
  const notices = listNotices(user.id, {
    unread: q.get("unread") === "1" || q.get("unread") === "true",
    kinds: kinds.filter(isKind),
    limit: limit + 1,
    before: intParam(req, "before", 0, 0, Number.MAX_SAFE_INTEGER) || undefined,
  });
  const more = notices.length > limit;
  const page = notices.slice(0, limit);
  return { notices: page, unread: unreadCount(user.id), nextCursor: more ? page[page.length - 1].cursor : null };
});
