import { createShot } from "@/server/cinema/store";
import { shotWithTakes } from "@/server/cinema/takes";
import { readJson, route } from "@/server/http";

/** POST /api/cinema/scenes/:id/shots  Shot fields. Adds a shot at the end of the scene. */
export const POST = route<{ id: string }>(async ({ req, user, params }) => ({ shot: shotWithTakes(createShot(user.id, params.id, await readJson(req))) }));
