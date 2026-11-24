import { planOf, TOPUP_PACKS } from "@/config/economy";
import { demoBillingOn } from "@/server/account/billing";
import { syncSubscription } from "@/server/account/subscription";
import { userById } from "@/server/auth";
import { balance, history } from "@/server/credits";
import { intParam, route } from "@/server/http";

/** GET /api/wallet?limit=&before=   Balance, plan and the credit history, newest first. */
export const GET = route(({ req, user: signedIn }) => {
  // A plan that renewed while the member was away catches up here, before the numbers are read.
  if (!signedIn.isGuest) syncSubscription(signedIn.id);
  const user = userById(signedIn.id) ?? signedIn;
  const rows = history(user.id, intParam(req, "limit", 50, 1, 200), intParam(req, "before", 0, 0, Number.MAX_SAFE_INTEGER) || undefined);
  return {
    balance: balance(user.id),
    plan: planOf(user.plan),
    packs: TOPUP_PACKS,
    demoBilling: demoBillingOn(),
    history: rows.map((r) => ({ id: r.id, kind: r.kind, amount: r.amount, note: r.note ?? "", jobId: r.job_id, createdAt: r.created_at })),
  };
});
