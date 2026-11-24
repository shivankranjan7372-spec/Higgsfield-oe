import { route } from "@/server/http";
import { removeRecent } from "@/server/notify";

/** DELETE /api/search/recent/:id */
export const DELETE = route<{ id: string }>(({ user, params }) => {
  removeRecent(user.id, params.id);
  return { ok: true };
});
