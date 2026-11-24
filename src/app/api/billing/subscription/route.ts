import { isPlanId } from "@/server/account/plans";
import { changePlan, parseInterval, subscriptionView, syncSubscription } from "@/server/account/subscription";
import { userById } from "@/server/auth";
import { balance } from "@/server/credits";
import { badRequest, rateLimit, readJson, route } from "@/server/http";

function view(userId: string, fallbackPlan: string) {
  return { subscription: subscriptionView(userId, userById(userId)?.plan ?? fallbackPlan), balance: balance(userId) };
}

/** GET /api/billing/subscription */
export const GET = route(({ user }) => {
  syncSubscription(user.id);
  return view(user.id, user.plan);
});

/** POST /api/billing/subscription  { planId?, interval? }   Change plan or billing interval. */
export const POST = route(async ({ req, user }) => {
  rateLimit(`plan-change:${user.id}`, 30, 3_600_000);
  const body = await readJson(req);
  syncSubscription(user.id);
  const current = view(user.id, user.plan).subscription;
  const planId = body.planId === undefined ? current.planId : body.planId;
  if (!isPlanId(planId)) throw badRequest("Pick a plan.");
  const interval = parseInterval(body.interval, current.interval ?? "month");
  const change = changePlan(user.id, planId, interval);
  return { ...change, ...view(user.id, user.plan) };
});
