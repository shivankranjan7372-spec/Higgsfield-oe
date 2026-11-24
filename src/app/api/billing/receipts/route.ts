import { listReceipts } from "@/server/account/receipts";
import { syncSubscription } from "@/server/account/subscription";
import { intParam, route } from "@/server/http";

/** GET /api/billing/receipts?limit=&before=   Newest first. */
export const GET = route(({ req, user }) => {
  syncSubscription(user.id);
  const receipts = listReceipts(user.id, intParam(req, "limit", 25, 1, 100), intParam(req, "before", 0, 0, Number.MAX_SAFE_INTEGER) || undefined);
  return { receipts };
});
