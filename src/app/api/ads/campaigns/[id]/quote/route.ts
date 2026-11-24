import { route } from "@/server/http";
import { quoteCampaign } from "@/server/ads/campaigns";

/** GET /api/ads/campaigns/:id/quote?formatId= — exact price of a run (or of re-running one format). */
export const GET = route<{ id: string }>(({ req, user, params }) => ({
  quote: quoteCampaign(user.id, params.id, req.nextUrl.searchParams.get("formatId") ?? undefined),
}));
