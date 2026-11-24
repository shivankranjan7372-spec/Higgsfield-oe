import { badRequest, readJson, route } from "@/server/http";
import { markSeen } from "@/server/notify";

/** POST /api/notifications/whats-new/seen  { all: true } or { ids: string[] } */
export const POST = route(async ({ req, user }) => {
  const body = await readJson(req);
  if (body.all === true) return markSeen(user.id, "all");
  if (Array.isArray(body.ids) && body.ids.length <= 100 && body.ids.every((x) => typeof x === "string")) return markSeen(user.id, body.ids as string[]);
  throw badRequest('Send { "all": true } or a list of announcement ids.');
});
