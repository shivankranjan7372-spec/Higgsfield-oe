import { createElement, elementsOf, ownedProject, toElement } from "@/server/cinema/store";
import { readJson, route } from "@/server/http";

/** GET /api/cinema/projects/:id/elements  Cast, places and props. */
export const GET = route<{ id: string }>(({ user, params }) => {
  ownedProject(user.id, params.id);
  return { elements: elementsOf(params.id).map(toElement) };
});

/** POST /api/cinema/projects/:id/elements  { kind, name, description?, refAssetIds? } */
export const POST = route<{ id: string }>(async ({ req, user, params }) => ({ element: toElement(createElement(user.id, params.id, await readJson(req))) }));
