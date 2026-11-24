import { duplicateScene, shotsOfScene, toScene, toShotFields } from "@/server/cinema/store";
import { route } from "@/server/http";

/** POST /api/cinema/scenes/:id/duplicate  Copies the scene and its shots (not takes) right after it. */
export const POST = route<{ id: string }>(({ user, params }) => {
  const scene = duplicateScene(user.id, params.id);
  return { scene: toScene(scene), shots: shotsOfScene(scene.id).map(toShotFields) };
});
