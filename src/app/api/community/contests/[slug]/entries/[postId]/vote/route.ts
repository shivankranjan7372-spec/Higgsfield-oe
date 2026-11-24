import { route } from "@/server/http";
import { setVote } from "@/server/community/contests";
import { limit } from "@/server/community/shared";

/** POST /api/community/contests/:slug/entries/:postId/vote  and  DELETE ...  One vote per member per entry. */
export const POST = route<{ slug: string; postId: string }>(({ user, params }) => {
  limit("vote", user.id);
  return setVote(user, params.slug, params.postId, true);
});

export const DELETE = route<{ slug: string; postId: string }>(({ user, params }) => {
  limit("vote", user.id);
  return setVote(user, params.slug, params.postId, false);
});
