import { demoEndPeriodNow, subscriptionView } from "@/server/account/subscription";
import { userById } from "@/server/auth";
import { balance } from "@/server/credits";
import { rateLimit, route } from "@/server/http";

/**
 * POST /api/billing/demo/end-period   Demo billing only: end the current period now, so the
 * renewal (or the end of a canceled plan) and the next month's credits happen at once.
 */
export const POST = route(({ user }) => {
  rateLimit(`demo-period:${user.id}`, 30, 3_600_000);
  demoEndPeriodNow(user.id);
  return { subscription: subscriptionView(user.id, userById(user.id)?.plan ?? user.plan), balance: balance(user.id) };
});
