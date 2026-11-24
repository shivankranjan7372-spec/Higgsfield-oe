import { intParam, readJson, route } from "@/server/http";
import { clearRecent, listRecent, saveRecent } from "@/server/notify";

/** GET /api/search/recent?limit=10 */
export const GET = route(({ req, user }) => ({ searches: listRecent(user.id, intParam(req, "limit", 10, 1, 20)) }));

/** POST /api/search/recent  { query } */
export const POST = route(async ({ req, user }) => {
  const body = await readJson(req, 4000);
  return { search: saveRecent(user.id, body.query) };
});

/** DELETE /api/search/recent  (clears all) */
export const DELETE = route(({ user }) => ({ ok: true, removed: clearRecent(user.id) }));
