import { badRequest, readJson, route } from "@/server/http";
import { restoreAll, restoreAssets } from "@/server/library/trash";

/** POST /api/library/trash/restore  { ids } or { all: true } */
export const POST = route(async ({ req, user }) => {
  const body = await readJson(req);
  if (body.all === true) return { ok: true, ...restoreAll(user.id) };
  if (body.ids === undefined) throw badRequest("Pick files to restore, or restore all.");
  return { ok: true, ...restoreAssets(user.id, body.ids) };
});
