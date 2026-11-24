import { cancelSubscription, subscriptionView } from "@/server/account/subscription";
import { userById } from "@/server/auth";
import { route } from "@/server/http";

/** POST /api/billing/subscription/cancel   Keep the plan to the end of the period, then move to Free. */
export const POST = route(({ user }) => {
  cancelSubscription(user.id);
  return { subscription: subscriptionView(user.id, userById(user.id)?.plan ?? user.plan) };
});
