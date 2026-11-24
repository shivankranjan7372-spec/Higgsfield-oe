import { MILLI, TOPUP_PACKS } from "@/config/economy";
import { demoBillingOn } from "@/server/account/billing";
import { balance, grant } from "@/server/credits";
import { ApiError, badRequest, rateLimit, readJson, route } from "@/server/http";

/**
 * POST /api/wallet/topup  { packId }
 * There is no payment processor yet, so this adds the credits for free and says so.
 * Open by default only in mock mode; a live server needs PARALLAX_DEMO_BILLING=on.
 * Never turn it on for a public server: anyone could mint credits and spend your gateway
 * money up to TREG_DAILY_BUDGET_USD.
 */
export const POST = route(async ({ req, user }) => {
  if (!demoBillingOn()) throw new ApiError(403, "forbidden", "Top-ups are not open yet.");
  const { packId } = await readJson(req);
  const pack = TOPUP_PACKS.find((p) => p.id === packId);
  if (!pack) throw badRequest("Pick a credit pack.");
  rateLimit(`topup:${user.id}`, 20, 3_600_000);
  grant(user.id, "topup", pack.credits * MILLI, `${pack.credits} credits (demo top-up)`);
  return { balance: balance(user.id) };
});
