import { resumeSubscription, subscriptionView } from "@/server/account/subscription";
import { userById } from "@/server/auth";
import { route } from "@/server/http";

/** POST /api/billing/subscription/resume   Undo a cancel before the period ends. */
export const POST = route(({ user }) => {
  resumeSubscription(user.id);
  return { subscription: subscriptionView(user.id, userById(user.id)?.plan ?? user.plan) };
});
