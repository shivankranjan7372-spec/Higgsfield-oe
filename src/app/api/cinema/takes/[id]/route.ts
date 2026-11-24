import { deleteTake, ownedTake, toTake } from "@/server/cinema/takes";
import { route } from "@/server/http";

/** GET /api/cinema/takes/:id */
export const GET = route<{ id: string }>(({ user, params }) => ({ take: toTake(ownedTake(user.id, params.id)) }));

/** DELETE /api/cinema/takes/:id  Takes it off the shot. The file stays in the library. */
export const DELETE = route<{ id: string }>(({ user, params }) => {
  deleteTake(user.id, params.id);
  return { ok: true };
});
