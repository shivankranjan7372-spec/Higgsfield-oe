import { quoteDraft } from "@/server/cinema/takes";
import { publicRoute } from "@/server/http";

/**
 * GET /api/cinema/compose?mode=still|text&modelId=&aspect=&duration=&count=
 * The price of a first take, before a project or a shot exists. Works signed out.
 */
export const GET = publicRoute(({ req }) => {
  const q = req.nextUrl.searchParams;
  const count = Math.min(4, Math.max(1, Math.floor(Number(q.get("count") ?? 1)) || 1));
  return quoteDraft(
    { mode: q.get("mode") ?? undefined, modelId: q.get("modelId") ?? undefined, aspect: q.get("aspect") ?? undefined, duration: q.get("duration") ?? undefined },
    count,
  );
});
