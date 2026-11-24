import { intParam, publicRoute } from "@/server/http";
import { popularTags } from "@/server/community/posts";

/** GET /api/explore/tags?limit=  Most used tags on public posts, for filter chips. */
export const GET = publicRoute(({ req }) => ({ tags: popularTags(intParam(req, "limit", 20, 1, 100)) }));
