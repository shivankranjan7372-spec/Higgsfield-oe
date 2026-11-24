import { intParam, route } from "@/server/http";
import { recentApps } from "@/server/apps/service";

/** GET /api/apps/recent?limit=  Apps the member ran lately, most recent first. */
export const GET = route(({ req, user }) => ({ apps: recentApps(user.id, intParam(req, "limit", 12, 1, 50)) }));
