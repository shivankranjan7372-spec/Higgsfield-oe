import { route } from "@/server/http";
import { setReaction } from "@/server/community/social";
import { limit } from "@/server/community/shared";

/** POST /api/community/posts/:id/like  and  DELETE ...  Guests may like too. Both are idempotent. */
export const POST = route<{ id: string }>(({ user, params }) => {
  limit("like", user.id);
  const r = setReaction(user, params.id, "like", true);
  return { liked: r.active, likes: r.count };
});

export const DELETE = route<{ id: string }>(({ user, params }) => {
  limit("like", user.id);
  const r = setReaction(user, params.id, "like", false);
  return { liked: r.active, likes: r.count };
});
