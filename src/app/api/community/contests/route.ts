import { publicRoute } from "@/server/http";
import { listContests } from "@/server/community/contests";

/** GET /api/community/contests  Running, then upcoming, then past. Works signed out. */
export const GET = publicRoute(({ user }) => ({ contests: listContests(user) }));
