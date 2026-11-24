import { badRequest, readJson, route } from "@/server/http";
import { removeNotice, setRead, unreadCount } from "@/server/notify";

/** PATCH /api/notifications/:id  { read: boolean } */
export const PATCH = route<{ id: string }>(async ({ req, user, params }) => {
  const body = await readJson(req);
  if (typeof body.read !== "boolean") throw badRequest("Say whether it is read: true or false.");
  return { notice: setRead(user.id, params.id, body.read), unread: unreadCount(user.id) };
});

/** DELETE /api/notifications/:id */
export const DELETE = route<{ id: string }>(({ user, params }) => {
  removeNotice(user.id, params.id);
  return { ok: true, unread: unreadCount(user.id) };
});
