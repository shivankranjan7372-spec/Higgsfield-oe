import { route } from "@/server/http";
import { duplicateCampaign } from "@/server/ads/campaigns";

/** POST /api/ads/campaigns/:id/duplicate — a new draft with the same settings. */
export const POST = route<{ id: string }>(({ user, params }) => ({ campaign: duplicateCampaign(user.id, params.id) }));
