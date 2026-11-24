import { intParam, publicRoute } from "@/server/http";
import { listFollows } from "@/server/community/profiles";

/** GET /api/profiles/:handle/followers?limit=&cursor= */
export const GET = publicRoute<{ handle: string }>(({ req, params }) =>
  listFollows(params.handle, "followers", intParam(req, "limit", 30, 1, 100), req.nextUrl.searchParams.get("cursor")),
);
