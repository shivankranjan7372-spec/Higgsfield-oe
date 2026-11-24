import { route } from "@/server/http";
import { setFollow } from "@/server/community/profiles";
import { limit } from "@/server/community/shared";

/** POST /api/profiles/:handle/follow  and  DELETE ...  Full accounts only. Idempotent. */
export const POST = route<{ handle: string }>(({ user, params }) => {
  limit("follow", user.id);
  return setFollow(user, params.handle, true);
});

export const DELETE = route<{ handle: string }>(({ user, params }) => {
  limit("follow", user.id);
  return setFollow(user, params.handle, false);
});
