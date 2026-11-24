import { intParam, route } from "@/server/http";
import { listSaved } from "@/server/community/posts";

/** GET /api/community/saved?limit=&cursor=  The viewer's saved posts, most recently saved first. */
export const GET = route(({ req, user }) => listSaved(user, intParam(req, "limit", 24, 1, 60), req.nextUrl.searchParams.get("cursor")));
