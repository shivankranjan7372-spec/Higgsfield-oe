import "server-only";

import type { NextRequest } from "next/server";
import { SESSION_COOKIE, publicUser, userById, type User } from "@/server/auth";
import { balance } from "@/server/credits";
import { getPreferences } from "./prefs";
import { subscriptionView, syncSubscription } from "./subscription";

export { syncSubscription } from "./subscription";

/** The session token from the request, used to tell "this device" apart from the others. */
export function currentToken(req: NextRequest): string | undefined {
  return req.cookies.get(SESSION_COOKIE)?.value;
}

/** Everything a settings screen needs in one read. Renews the plan and grants credits first. */
export function accountOverview(user: User) {
  syncSubscription(user.id);
  const fresh = userById(user.id) ?? user;
  return {
    user: publicUser(fresh),
    balance: balance(fresh.id),
    subscription: subscriptionView(fresh.id, fresh.plan),
    preferences: getPreferences(fresh.id),
    hasPassword: !fresh.isGuest,
  };
}
