import { readJson, route } from "@/server/http";
import { deleteKit, ownedKit, saveKit, toKit } from "@/server/ads/library";

/** GET /api/ads/brands/:id */
export const GET = route<{ id: string }>(({ user, params }) => ({ brandKit: toKit(ownedKit(user.id, params.id)) }));

/** PATCH /api/ads/brands/:id — only the fields sent change. */
export const PATCH = route<{ id: string }>(async ({ req, user, params }) => ({ brandKit: saveKit(user.id, await readJson(req), params.id) }));

/** DELETE /api/ads/brands/:id */
export const DELETE = route<{ id: string }>(({ user, params }) => {
  deleteKit(user.id, params.id);
  return { ok: true };
});
