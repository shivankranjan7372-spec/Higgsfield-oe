import { publicRoute } from "@/server/http";
import { listApps } from "@/server/apps/service";

/**
 * GET /api/apps?category=&tag=&q=&sort=featured|popular|new|name&status=all|available|soon
 * The app catalog. Works signed out; `pinned` is null then.
 */
export const GET = publicRoute(({ req, user }) => {
  const q = req.nextUrl.searchParams;
  return listApps(user?.id ?? null, { category: q.get("category"), tag: q.get("tag"), q: q.get("q"), sort: q.get("sort"), status: q.get("status") });
});
