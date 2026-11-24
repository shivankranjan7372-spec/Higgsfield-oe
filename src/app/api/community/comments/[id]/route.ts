import { route } from "@/server/http";
import { deleteComment } from "@/server/community/social";

/** DELETE /api/community/comments/:id  The comment's author or the post's owner. */
export const DELETE = route<{ id: string }>(({ user, params }) => {
  deleteComment(user, params.id);
  return { ok: true };
});
