import { route } from "@/server/http";
import { syncNotices, unreadCount } from "@/server/notify";

/** GET /api/notifications/unread  ->  { unread } . Cheap enough to poll for the badge. */
export const GET = route(({ user }) => {
  syncNotices(user.id, true);
  return { unread: unreadCount(user.id) };
});
