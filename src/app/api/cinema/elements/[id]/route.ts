import { deleteElement, ownedElement, toElement, updateElement } from "@/server/cinema/store";
import { readJson, route } from "@/server/http";

/** GET /api/cinema/elements/:id */
export const GET = route<{ id: string }>(({ user, params }) => ({ element: toElement(ownedElement(user.id, params.id)) }));

/** PATCH /api/cinema/elements/:id  { name?, description?, refAssetIds? } */
export const PATCH = route<{ id: string }>(async ({ req, user, params }) => ({ element: toElement(updateElement(user.id, params.id, await readJson(req))) }));

/** DELETE /api/cinema/elements/:id  Also removes it from every shot. */
export const DELETE = route<{ id: string }>(({ user, params }) => {
  deleteElement(user.id, params.id);
  return { ok: true };
});
