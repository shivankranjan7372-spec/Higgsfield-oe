import { readJson, route } from "@/server/http";
import { campaignView, deleteCampaign, ensurePump, pump, saveCampaign } from "@/server/ads/campaigns";

/** GET /api/ads/campaigns/:id — the campaign with every ad, grouped by format. Poll while status is "running". */
export const GET = route<{ id: string }>(({ user, params }) => {
  ensurePump();
  pump(user);
  return { campaign: campaignView(user.id, params.id) };
});

/** PATCH /api/ads/campaigns/:id — only the fields sent change. */
export const PATCH = route<{ id: string }>(async ({ req, user, params }) => ({ campaign: saveCampaign(user.id, await readJson(req), params.id) }));

/** DELETE /api/ads/campaigns/:id */
export const DELETE = route<{ id: string }>(({ user, params }) => {
  deleteCampaign(user.id, params.id);
  return { ok: true };
});
