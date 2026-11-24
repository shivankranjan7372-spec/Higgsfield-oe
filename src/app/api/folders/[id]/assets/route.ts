import { readJson, route } from "@/server/http";
import { moveAssets } from "@/server/library/folders";

/** POST /api/folders/:id/assets  { ids }  Moves files into the folder. Use `none` as the id to take them out of any folder. */
export const POST = route<{ id: string }>(async ({ req, user, params }) => {
  const body = await readJson(req);
  return { ok: true, ...moveAssets(user.id, body.ids, params.id === "none" ? null : params.id) };
});
