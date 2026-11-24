import { syncSubscription } from "@/server/account/subscription";
import { publicUser, userById } from "@/server/auth";
import { balance } from "@/server/credits";
import { publicRoute } from "@/server/http";

/**
 * Who is signed in, and what they have to spend. `user` is null when signed out.
 * Every page asks this first, so it is also where a plan that renewed while the member
 * was away catches up: the new period and its credits show at once.
 */
export const GET = publicRoute(({ user }) => {
  if (!user) return { user: null, balance: 0 };
  if (!user.isGuest) syncSubscription(user.id);
  return { user: publicUser(userById(user.id) ?? user), balance: balance(user.id) };
});
