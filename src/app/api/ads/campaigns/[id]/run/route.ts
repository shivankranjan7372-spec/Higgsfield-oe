import { balance } from "@/server/credits";
import { readJson, route } from "@/server/http";
import { ensurePump, runCampaign } from "@/server/ads/campaigns";

/** POST /api/ads/campaigns/:id/run  { expectedCost? } */
export const POST = route<{ id: string }>(async ({ req, user, params }) => {
  const body = await readJson(req);
  ensurePump();
  const campaign = runCampaign(user, params.id, body.expectedCost);
  return { campaign, balance: balance(user.id) };
});
