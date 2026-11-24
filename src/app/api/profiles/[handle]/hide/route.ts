import { route } from "@/server/http";
import { setHidden } from "@/server/community/profiles";
import { limit } from "@/server/community/shared";

/** POST /api/profiles/:handle/hide  and  DELETE ...  Hides a member's posts from the viewer's own feeds. */
export const POST = route<{ handle: string }>(({ user, params }) => {
  limit("hide", user.id);
  return setHidden(user, params.handle, true);
});

export const DELETE = route<{ handle: string }>(({ user, params }) => {
  limit("hide", user.id);
  return setHidden(user, params.handle, false);
});
