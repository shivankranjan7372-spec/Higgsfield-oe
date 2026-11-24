import { badRequest, intParam, publicRoute, readJson, route } from "@/server/http";
import { enter, listEntries } from "@/server/community/contests";
import { limit } from "@/server/community/shared";

/** GET /api/community/contests/:slug/entries?sort=top|new&limit=&cursor=  `top` is the leaderboard. */
export const GET = publicRoute<{ slug: string }>(({ req, user, params }) => {
  const sort = req.nextUrl.searchParams.get("sort") ?? "top";
  if (sort !== "top" && sort !== "new") throw badRequest("Unknown sort.");
  return listEntries(user, params.slug, sort, intParam(req, "limit", 24, 1, 60), req.nextUrl.searchParams.get("cursor"));
});

/** POST /api/community/contests/:slug/entries  { postId }  Enters one of the member's own posts. */
export const POST = route<{ slug: string }>(async ({ req, user, params }) => {
  limit("enter", user.id);
  const body = await readJson(req, 4_000);
  return { contest: enter(user, params.slug, body.postId) };
});
