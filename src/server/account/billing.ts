import "server-only";

import { newId, run } from "@/server/db";
import { ApiError } from "@/server/errors";
import { tregMode } from "@/server/treg";
import type { Interval } from "./plans";

/**
 * Billing sits behind this interface so a real payment provider can replace the demo one
 * without touching plan logic. There is no real provider in Parallax: the `demo` provider
 * approves every charge at once and writes a receipt. No card data exists anywhere.
 */

export interface ChargeRequest {
  userId: string;
  planId: string;
  interval: Interval;
  amountCents: number;
  description: string;
  periodStart: number;
  periodEnd: number;
}

export type ChargeResult = { ok: true; receiptId: string } | { ok: false; message: string };

export interface BillingProvider {
  id: string;
  charge(req: ChargeRequest): ChargeResult;
}

/** Approves at once. The receipt says "demo" so nobody mistakes it for a real payment. */
export const demoProvider: BillingProvider = {
  id: "demo",
  charge(req) {
    const id = newId("rcp");
    run(
      `INSERT INTO account_receipts (id, user_id, provider, reference, plan_id, interval, amount_cents, currency, description, status, period_start, period_end, created_at)
       VALUES (?, ?, 'demo', ?, ?, ?, ?, 'usd', ?, 'paid', ?, ?, ?)`,
      id,
      req.userId,
      newId("demo"),
      req.planId,
      req.interval,
      req.amountCents,
      req.description,
      req.periodStart,
      req.periodEnd,
      Date.now(),
    );
    return { ok: true, receiptId: id };
  },
};

/**
 * Demo billing hands out credits for free (top-ups, plan upgrades and their monthly credits).
 * Credits buy real generations once a gateway key is set, so it is open by default only in
 * mock mode. A live server opens it only with PARALLAX_DEMO_BILLING=on (or 1). `off` closes it
 * everywhere.
 */
export function demoBillingOn(): boolean {
  const v = (process.env.PARALLAX_DEMO_BILLING ?? "").trim().toLowerCase();
  if (v === "off" || v === "0") return false;
  if (v === "on" || v === "1") return true;
  return tregMode() === "mock";
}

/** The provider in use, or null when billing is closed. */
export function billingProvider(): BillingProvider | null {
  return demoBillingOn() ? demoProvider : null;
}

export function requireProvider(): BillingProvider {
  const p = billingProvider();
  if (!p) throw new ApiError(503, "billing_closed", "Plan changes are not open yet. Your current plan stays as it is.");
  return p;
}
