import { orderShots, shotsOfScene, toShotFields } from "@/server/cinema/store";
import { idList } from "@/server/cinema/validate";
import { readJson, route } from "@/server/http";

/** PUT /api/cinema/scenes/:id/shots/order  { shotIds: [...] }  every shot of the scene, in the new order. */
export const PUT = route<{ id: string }>(async ({ req, user, params }) => {
  orderShots(user.id, params.id, idList(await readJson(req), "shotIds", "Shots", 100) ?? []);
  return { shots: shotsOfScene(params.id).map(toShotFields) };
});
