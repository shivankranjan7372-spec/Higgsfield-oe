import { createScene, toScene } from "@/server/cinema/store";
import { readJson, route } from "@/server/http";

/** POST /api/cinema/projects/:id/scenes  { title?, notes? }  Adds a scene at the end. */
export const POST = route<{ id: string }>(async ({ req, user, params }) => ({ scene: toScene(createScene(user.id, params.id, await readJson(req))) }));
