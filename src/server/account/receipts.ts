import "server-only";

import { planOf } from "@/config/economy";
import { all } from "@/server/db";

interface ReceiptRow {
  id: string;
  provider: string;
  plan_id: string;
  interval: string;
  amount_cents: number;
  currency: string;
  description: string;
  status: string;
  period_start: number;
  period_end: number;
  created_at: number;
}

/** Receipts, newest first. `before` is a `createdAt` from the last page. */
export function listReceipts(userId: string, limit: number, before: number | undefined) {
  return all<ReceiptRow>(
    "SELECT * FROM account_receipts WHERE user_id = ? AND created_at < ? ORDER BY created_at DESC, id DESC LIMIT ?",
    userId,
    before ?? Number.MAX_SAFE_INTEGER,
    limit,
  ).map((r) => ({
    id: r.id,
    number: `PX-${r.id.slice(4, 12).toUpperCase()}`,
    provider: r.provider,
    demo: r.provider === "demo",
    planId: r.plan_id,
    planName: planOf(r.plan_id).name,
    interval: r.interval,
    amountCents: r.amount_cents,
    currency: r.currency,
    description: r.description,
    status: r.status,
    periodStart: r.period_start,
    periodEnd: r.period_end,
    createdAt: r.created_at,
  }));
}
