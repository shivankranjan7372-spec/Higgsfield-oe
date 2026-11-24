import { demoBillingOn } from "@/server/account/billing";
import { catalog } from "@/server/account/plans";
import { subscriptionView, syncSubscription } from "@/server/account/subscription";
import { userById } from "@/server/auth";
import { publicRoute } from "@/server/http";

/** GET /api/billing/plans   The plan catalog. Signed in, it also says which plan is yours. */
export const GET = publicRoute(({ user }) => {
  let current = null;
  if (user) {
    syncSubscription(user.id);
    current = subscriptionView(user.id, userById(user.id)?.plan ?? user.plan);
  }
  return { plans: catalog(), current, demoBilling: demoBillingOn(), currency: "usd" };
});
