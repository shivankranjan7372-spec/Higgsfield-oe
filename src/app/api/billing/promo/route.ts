import { redeemPromo } from "@/server/account/codes";
import { balance } from "@/server/credits";
import { rateLimit, readJson, route } from "@/server/http";

/** POST /api/billing/promo  { code }   Adds the code's credits, once per member. */
export const POST = route(async ({ req, user }) => {
  rateLimit(`promo:${user.id}`, 20, 3_600_000);
  const body = await readJson(req);
  const out = redeemPromo(user.id, body.code);
  return { code: out.code, credits: out.credits, balance: balance(user.id) };
});
