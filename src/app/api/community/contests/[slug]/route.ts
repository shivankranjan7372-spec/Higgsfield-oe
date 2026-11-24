import { publicRoute } from "@/server/http";
import { getContest } from "@/server/community/contests";

/** GET /api/community/contests/:slug */
export const GET = publicRoute<{ slug: string }>(({ user, params }) => ({ contest: getContest(user, params.slug) }));
