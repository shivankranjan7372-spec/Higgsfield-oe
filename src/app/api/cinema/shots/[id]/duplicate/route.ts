import { duplicateShot } from "@/server/cinema/store";
import { shotWithTakes } from "@/server/cinema/takes";
import { route } from "@/server/http";

/** POST /api/cinema/shots/:id/duplicate  Copies the shot (not its takes) right after it. */
export const POST = route<{ id: string }>(({ user, params }) => ({ shot: shotWithTakes(duplicateShot(user.id, params.id)) }));
