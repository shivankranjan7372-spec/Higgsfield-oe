import { publicRoute, readJson, route } from "@/server/http";
import { editPost, getPost, unpublish } from "@/server/community/posts";

/** GET /api/community/posts/:id  One post. Works signed out. */
export const GET = publicRoute<{ id: string }>(({ user, params }) => ({ post: getPost(user, params.id) }));

/** PATCH /api/community/posts/:id  { title?, description?, tags?, allowRecreate? }  Author only. */
export const PATCH = route<{ id: string }>(async ({ req, user, params }) => ({ post: editPost(user, params.id, await readJson(req)) }));

/** DELETE /api/community/posts/:id  Unpublishes. The file stays in the author's library, private again. */
export const DELETE = route<{ id: string }>(({ user, params }) => {
  unpublish(user, params.id);
  return { ok: true };
});
