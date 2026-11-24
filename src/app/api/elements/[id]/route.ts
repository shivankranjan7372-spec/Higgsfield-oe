import { readJson, route } from "@/server/http";
import { deleteElement, elementInput, getElement, updateElement } from "@/server/library/elements";

export const GET = route<{ id: string }>(({ user, params }) => ({ element: getElement(user.id, params.id) }));

/** PATCH /api/elements/:id  { type?, name?, description?, tags?, assetIds? } */
export const PATCH = route<{ id: string }>(async ({ req, user, params }) => ({
  element: updateElement(user.id, params.id, elementInput(await readJson(req), false)),
}));

/** DELETE /api/elements/:id  The images stay in the library. */
export const DELETE = route<{ id: string }>(({ user, params }) => {
  deleteElement(user.id, params.id);
  return { ok: true };
});
