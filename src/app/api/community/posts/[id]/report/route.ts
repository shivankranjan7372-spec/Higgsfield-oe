import { readJson, route } from "@/server/http";
import { reportPost } from "@/server/community/social";
import { limit } from "@/server/community/shared";

/** POST /api/community/posts/:id/report  { reason, note? }  Stored for a moderator. */
export const POST = route<{ id: string }>(async ({ req, user, params }) => {
  limit("report", user.id);
  const body = await readJson(req, 8_000);
  reportPost(user, params.id, body.reason, body.note);
  return { reported: true };
});
