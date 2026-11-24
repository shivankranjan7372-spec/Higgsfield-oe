import { readJson, route } from "@/server/http";
import { ensurePump, listCampaigns, pump, saveCampaign } from "@/server/ads/campaigns";

/** GET /api/ads/campaigns */
export const GET = route(({ user }) => {
  ensurePump();
  pump(user);
  return { campaigns: listCampaigns(user.id) };
});

/** POST /api/ads/campaigns  { productId, formats, variations?, brandKitId?, name?, script?, presenterAssetId? } — creates a draft. */
export const POST = route(async ({ req, user }) => ({ campaign: saveCampaign(user.id, await readJson(req)) }));
