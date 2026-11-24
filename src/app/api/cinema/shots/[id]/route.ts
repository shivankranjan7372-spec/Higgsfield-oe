import { deleteShot, ownedShot, updateShot } from "@/server/cinema/store";
import { shotWithTakes } from "@/server/cinema/takes";
import { readJson, route } from "@/server/http";

/** GET /api/cinema/shots/:id  The shot with every take. */
export const GET = route<{ id: string }>(({ user, params }) => ({ shot: shotWithTakes(ownedShot(user.id, params.id)) }));

/** PATCH /api/cinema/shots/:id  Any shot field, plus selectedTakeId and sceneId (move). */
export const PATCH = route<{ id: string }>(async ({ req, user, params }) => ({ shot: shotWithTakes(updateShot(user.id, params.id, await readJson(req))) }));

/** DELETE /api/cinema/shots/:id */
export const DELETE = route<{ id: string }>(({ user, params }) => {
  deleteShot(user.id, params.id);
  return { ok: true };
});
