import { intParam, publicRoute, readJson, route } from "@/server/http";
import { addComment, listComments } from "@/server/community/social";
import { limit } from "@/server/community/shared";

/** GET /api/community/posts/:id/comments?limit=&cursor=  Oldest first. Works signed out. */
export const GET = publicRoute<{ id: string }>(({ req, user, params }) =>
  listComments(user, params.id, intParam(req, "limit", 30, 1, 100), req.nextUrl.searchParams.get("cursor")),
);

/** POST /api/community/posts/:id/comments  { body }  Full accounts only. */
export const POST = route<{ id: string }>(async ({ req, user, params }) => {
  const body = await readJson(req, 16_000);
  limit("comment", user.id);
  limit("commentDaily", user.id);
  return { comment: addComment(user, params.id, body.body) };
});
