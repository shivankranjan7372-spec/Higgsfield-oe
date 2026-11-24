import { balance } from "@/server/credits";
import { badRequest, readJson, route } from "@/server/http";
import { ensurePump, rerunFormat } from "@/server/ads/campaigns";

/** POST /api/ads/campaigns/:id/rerun  { formatId, expectedCost? } — a fresh round of variations for one format. */
export const POST = route<{ id: string }>(async ({ req, user, params }) => {
  const body = await readJson(req);
  if (typeof body.formatId !== "string" || body.formatId.length > 60) throw badRequest("Pick the format to run again.");
  ensurePump();
  const campaign = rerunFormat(user, params.id, body.formatId, body.expectedCost);
  return { campaign, balance: balance(user.id) };
});
