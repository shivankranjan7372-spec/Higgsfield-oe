import { publicRoute } from "@/server/http";
import { recordView } from "@/server/community/social";
import { limit, viewerKey } from "@/server/community/shared";

/** POST /api/community/posts/:id/view  Counts a view, once per viewer per day. Works signed out. */
export const POST = publicRoute<{ id: string }>(({ req, user, params }) => {
  const viewer = viewerKey(req, user);
  limit("view", viewer);
  return { views: recordView(viewer, params.id) };
});
