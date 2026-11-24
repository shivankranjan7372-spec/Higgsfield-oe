import { deleteScene, toScene, updateScene } from "@/server/cinema/store";
import { readJson, route } from "@/server/http";

/** PATCH /api/cinema/scenes/:id  { title?, notes? } */
export const PATCH = route<{ id: string }>(async ({ req, user, params }) => ({ scene: toScene(updateScene(user.id, params.id, await readJson(req))) }));

/** DELETE /api/cinema/scenes/:id  Deletes the scene and its shots. */
export const DELETE = route<{ id: string }>(({ user, params }) => {
  deleteScene(user.id, params.id);
  return { ok: true };
});
