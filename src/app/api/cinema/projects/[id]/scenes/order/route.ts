import { orderScenes } from "@/server/cinema/store";
import { idList } from "@/server/cinema/validate";
import { readJson, route } from "@/server/http";
import { storyboard } from "@/server/cinema/storyboard";

/** PUT /api/cinema/projects/:id/scenes/order  { sceneIds: [...] }  every scene, in the new order. */
export const PUT = route<{ id: string }>(async ({ req, user, params }) => {
  orderScenes(user.id, params.id, idList(await readJson(req), "sceneIds", "Scenes", 100) ?? []);
  return storyboard(user.id, params.id);
});
