import { route } from "@/server/http";
import { withdraw } from "@/server/community/contests";

/** DELETE /api/community/contests/:slug/entries/:postId  Withdraws the member's own entry. */
export const DELETE = route<{ slug: string; postId: string }>(({ user, params }) => {
  withdraw(user, params.slug, params.postId);
  return { ok: true };
});
