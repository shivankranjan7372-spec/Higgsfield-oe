import { claimReferral } from "@/server/account/codes";
import { balance } from "@/server/credits";
import { rateLimit, readJson, route } from "@/server/http";

/** POST /api/account/referral/claim  { code }   Both members get the invite bonus, once. */
export const POST = route(async ({ req, user }) => {
  rateLimit(`referral:${user.id}`, 20, 3_600_000);
  const body = await readJson(req);
  const out = claimReferral(user, body.code);
  return { credits: out.credits, balance: balance(user.id) };
});
