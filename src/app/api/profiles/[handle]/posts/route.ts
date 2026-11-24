import { badRequest, intParam, publicRoute } from "@/server/http";
import { listFeed } from "@/server/community/posts";
import { memberByHandle } from "@/server/community/profiles";

/** GET /api/profiles/:handle/posts?sort=new|top&kind=&limit=&cursor=  The profile grid. */
export const GET = publicRoute<{ handle: string }>(({ req, user, params }) => {
  const q = req.nextUrl.searchParams;
  const sort = q.get("sort") ?? "new";
  if (sort !== "new" && sort !== "top") throw badRequest("Unknown sort.");
  const kind = (["image", "video", "audio"] as const).find((k) => k === q.get("kind"));
  if (q.get("kind") && !kind) throw badRequest("Unknown kind.");
  const member = memberByHandle(params.handle);
  return listFeed(user, { tab: sort, period: "all", kind, authorId: member.id, limit: intParam(req, "limit", 24, 1, 60), cursor: q.get("cursor") });
});
