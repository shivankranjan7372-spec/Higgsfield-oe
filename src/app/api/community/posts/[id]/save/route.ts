import { route } from "@/server/http";
import { setReaction } from "@/server/community/social";
import { limit } from "@/server/community/shared";

/** POST /api/community/posts/:id/save  and  DELETE ...  Guests may save too. Both are idempotent. */
export const POST = route<{ id: string }>(({ user, params }) => {
  limit("save", user.id);
  const r = setReaction(user, params.id, "save", true);
  return { saved: r.active, saves: r.count };
});

export const DELETE = route<{ id: string }>(({ user, params }) => {
  limit("save", user.id);
  const r = setReaction(user, params.id, "save", false);
  return { saved: r.active, saves: r.count };
});
