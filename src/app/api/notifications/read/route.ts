import { badRequest, readJson, route } from "@/server/http";
import { markRead, unreadCount } from "@/server/notify";

/** POST /api/notifications/read  { all: true } or { ids: string[] } */
export const POST = route(async ({ req, user }) => {
  const body = await readJson(req);
  let changed: number;
  if (body.all === true) changed = markRead(user.id, "all");
  else if (Array.isArray(body.ids) && body.ids.length <= 200 && body.ids.every((x) => typeof x === "string" && x.length <= 64)) {
    changed = markRead(user.id, body.ids as string[]);
  } else throw badRequest('Send { "all": true } or a list of up to 200 notification ids.');
  return { changed, unread: unreadCount(user.id) };
});
