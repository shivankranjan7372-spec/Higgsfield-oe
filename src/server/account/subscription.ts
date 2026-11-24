import "server-only";

import { MILLI, planOf } from "@/config/economy";
import { grant } from "@/server/credits";
import { get, run, tx } from "@/server/db";
import { ApiError, badRequest } from "@/server/errors";
import { billingProvider, demoBillingOn, requireProvider } from "./billing";
import { INTERVALS, isPlanId, planCard, priceCents, type Interval, type PlanCard } from "./plans";

/**
 * Subscriptions. Nothing runs on a timer: every read calls `syncSubscription`, which
 * renews or ends periods that are over and grants the current month's credits once.
 *
 * - Upgrades (a bigger plan, or monthly -> yearly) start now, with a new period and a charge.
 * - Downgrades (a smaller plan, or yearly -> monthly) wait for the end of the period.
 * - Cancel keeps the plan to the end of the period, then the member is on Free.
 * - Credits come per calendar month from the period start, on monthly and yearly billing.
 */

interface SubRow {
  user_id: string;
  plan_id: string;
  interval: Interval;
  status: "active" | "ended";
  period_start: number;
  period_end: number;
  cancel_at_period_end: number;
  pending_plan_id: string | null;
  pending_interval: Interval | null;
  created_at: number;
  updated_at: number;
}

export function addMonths(ms: number, n: number): number {
  const d = new Date(ms);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.getTime();
}

const periodMonths = (i: Interval) => (i === "year" ? 12 : 1);

function subRow(userId: string): SubRow | undefined {
  return get<SubRow>("SELECT * FROM account_subscriptions WHERE user_id = ?", userId);
}

function endSubscription(userId: string) {
  const now = Date.now();
  run(
    "UPDATE account_subscriptions SET status = 'ended', cancel_at_period_end = 0, pending_plan_id = NULL, pending_interval = NULL, updated_at = ? WHERE user_id = ?",
    now,
    userId,
  );
  run("UPDATE users SET plan = 'free' WHERE id = ?", userId);
}

function describe(planId: string, interval: Interval): string {
  return `${planOf(planId).name} plan, ${interval === "year" ? "yearly" : "monthly"} (demo, no money taken)`;
}

/** The credit month that contains `now`, inside the subscription period. */
function creditWindow(sub: SubRow, now: number): { start: number; end: number } {
  let start = sub.period_start;
  for (let i = 0; i < 12; i++) {
    const next = addMonths(start, 1);
    if (next > now || next >= sub.period_end) break;
    start = next;
  }
  return { start, end: Math.min(addMonths(start, 1), sub.period_end) };
}

/** Grants this month's plan credits if they were not granted yet. Exactly once per window. */
function grantMonthlyCredits(sub: SubRow, now: number) {
  if (sub.status !== "active" || now >= sub.period_end) return;
  const plan = planOf(sub.plan_id);
  if (plan.monthlyCredits <= 0) return;
  const w = creditWindow(sub, now);
  const amount = plan.monthlyCredits * MILLI;
  const added = run(
    "INSERT OR IGNORE INTO account_credit_grants (user_id, window_start, window_end, plan_id, amount, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    sub.user_id,
    w.start,
    w.end,
    plan.id,
    amount,
    now,
  );
  if (added.changes === 1) grant(sub.user_id, "grant", amount, `${plan.name} plan: monthly credits`);
}

/** Renews or ends finished periods, then grants this month's credits. Safe to call on every request. */
export function syncSubscription(userId: string) {
  // Most members have no paid plan. Answer that from one read, without opening a write.
  if (subRow(userId)?.status !== "active") return;
  tx(() => {
    let sub = subRow(userId);
    if (!sub || sub.status !== "active") return;
    const now = Date.now();
    for (let guard = 0; sub.period_end <= now; guard++) {
      const planId = sub.pending_plan_id ?? sub.plan_id;
      const interval = sub.pending_interval ?? sub.interval;
      const provider = billingProvider();
      if (sub.cancel_at_period_end || planId === "free" || !isPlanId(planId) || !provider) return endSubscription(userId);
      // A member away for years is not billed for every missed period: restart from today.
      const start = guard >= 24 ? now : sub.period_end;
      const end = addMonths(start, periodMonths(interval));
      const paid = provider.charge({ userId, planId, interval, amountCents: priceCents(planId, interval), description: `Renewal: ${describe(planId, interval)}`, periodStart: start, periodEnd: end });
      if (!paid.ok) return endSubscription(userId);
      run(
        "UPDATE account_subscriptions SET plan_id = ?, interval = ?, period_start = ?, period_end = ?, pending_plan_id = NULL, pending_interval = NULL, updated_at = ? WHERE user_id = ?",
        planId,
        interval,
        start,
        end,
        now,
        userId,
      );
      run("UPDATE users SET plan = ? WHERE id = ?", planId, userId);
      sub = subRow(userId)!;
    }
    grantMonthlyCredits(sub, now);
  });
}

/* ---------------------------------- view ---------------------------------- */

export interface SubscriptionView {
  planId: string;
  plan: PlanCard;
  interval: Interval | null;
  /** free: no paid plan. active: renews. canceling: ends at currentPeriodEnd. */
  status: "free" | "active" | "canceling";
  currentPeriodStart: number | null;
  currentPeriodEnd: number | null;
  renewsAt: number | null;
  nextChargeCents: number | null;
  pendingChange: { planId: string; planName: string; interval: Interval; startsAt: number } | null;
  monthlyCredits: { amount: number; windowStart: number; windowEnd: number; nextGrantAt: number | null } | null;
  demoBilling: boolean;
}

export function subscriptionView(userId: string, userPlan: string): SubscriptionView {
  const sub = subRow(userId);
  const demoBilling = demoBillingOn();
  if (!sub || sub.status !== "active") {
    const plan = planCard(userPlan);
    return { planId: plan.id, plan, interval: null, status: "free", currentPeriodStart: null, currentPeriodEnd: null, renewsAt: null, nextChargeCents: null, pendingChange: null, monthlyCredits: null, demoBilling };
  }
  const canceling = sub.cancel_at_period_end === 1;
  const nextPlan = sub.pending_plan_id ?? sub.plan_id;
  const nextInterval = sub.pending_interval ?? sub.interval;
  const w = creditWindow(sub, Date.now());
  const plan = planCard(sub.plan_id);
  return {
    planId: sub.plan_id,
    plan,
    interval: sub.interval,
    status: canceling ? "canceling" : "active",
    currentPeriodStart: sub.period_start,
    currentPeriodEnd: sub.period_end,
    renewsAt: canceling ? null : sub.period_end,
    nextChargeCents: canceling || nextPlan === "free" ? null : priceCents(nextPlan, nextInterval),
    pendingChange:
      sub.pending_plan_id && !canceling
        ? { planId: sub.pending_plan_id, planName: planOf(sub.pending_plan_id).name, interval: sub.pending_interval ?? sub.interval, startsAt: sub.period_end }
        : null,
    monthlyCredits:
      plan.monthlyCredits > 0
        ? { amount: plan.monthlyCredits * MILLI, windowStart: w.start, windowEnd: w.end, nextGrantAt: w.end < sub.period_end || !canceling ? w.end : null }
        : null,
    demoBilling,
  };
}

/* --------------------------------- changes -------------------------------- */

export interface ChangeResult {
  /** now: the new plan is active. period_end: it starts at the end of the period. none: nothing to do. */
  effective: "now" | "period_end";
  receiptId: string | null;
}

export function parseInterval(raw: unknown, fallback: Interval): Interval {
  if (raw === undefined || raw === null) return fallback;
  if (typeof raw !== "string" || !INTERVALS.includes(raw as Interval)) throw badRequest("Billing must be monthly or yearly.");
  return raw as Interval;
}

export function changePlan(userId: string, planId: string, interval: Interval): ChangeResult {
  const provider = requireProvider();
  syncSubscription(userId);
  return tx(() => {
    const now = Date.now();
    const sub = subRow(userId);
    const active = sub?.status === "active" ? sub : undefined;

    if (planId === "free") {
      if (!active) throw new ApiError(409, "already_current", "You are already on the Free plan.");
      cancelSubscription(userId);
      return { effective: "period_end", receiptId: null };
    }

    if (active && active.plan_id === planId && active.interval === interval) {
      if (!active.pending_plan_id && !active.cancel_at_period_end) throw new ApiError(409, "already_current", "You are already on this plan.");
      // Choosing the current plan again drops a scheduled change or cancellation.
      run("UPDATE account_subscriptions SET pending_plan_id = NULL, pending_interval = NULL, cancel_at_period_end = 0, updated_at = ? WHERE user_id = ?", now, userId);
      return { effective: "now", receiptId: null };
    }

    const target = planCard(planId);
    const upgrade = !active || target.rank > planCard(active.plan_id).rank || (target.rank === planCard(active.plan_id).rank && interval === "year");
    if (!upgrade) {
      run(
        "UPDATE account_subscriptions SET pending_plan_id = ?, pending_interval = ?, cancel_at_period_end = 0, updated_at = ? WHERE user_id = ?",
        planId,
        interval,
        now,
        userId,
      );
      return { effective: "period_end", receiptId: null };
    }

    const end = addMonths(now, periodMonths(interval));
    const paid = provider.charge({ userId, planId, interval, amountCents: priceCents(planId, interval), description: describe(planId, interval), periodStart: now, periodEnd: end });
    if (!paid.ok) throw new ApiError(402, "payment_failed", paid.message);
    run(
      `INSERT INTO account_subscriptions (user_id, plan_id, interval, status, period_start, period_end, cancel_at_period_end, pending_plan_id, pending_interval, created_at, updated_at)
       VALUES (?, ?, ?, 'active', ?, ?, 0, NULL, NULL, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET plan_id = excluded.plan_id, interval = excluded.interval, status = 'active',
         period_start = excluded.period_start, period_end = excluded.period_end, cancel_at_period_end = 0,
         pending_plan_id = NULL, pending_interval = NULL, updated_at = excluded.updated_at`,
      userId,
      planId,
      interval,
      now,
      end,
      now,
      now,
    );
    run("UPDATE users SET plan = ? WHERE id = ?", planId, userId);
    grantMonthlyCredits(subRow(userId)!, now);
    return { effective: "now", receiptId: paid.receiptId };
  });
}

export function cancelSubscription(userId: string) {
  syncSubscription(userId);
  const sub = subRow(userId);
  if (!sub || sub.status !== "active") throw new ApiError(409, "no_subscription", "You are on the Free plan, so there is nothing to cancel.");
  if (sub.cancel_at_period_end) throw new ApiError(409, "already_canceling", "Your plan is already set to end.");
  run("UPDATE account_subscriptions SET cancel_at_period_end = 1, pending_plan_id = NULL, pending_interval = NULL, updated_at = ? WHERE user_id = ?", Date.now(), userId);
}

export function resumeSubscription(userId: string) {
  syncSubscription(userId);
  const sub = subRow(userId);
  if (!sub || sub.status !== "active") throw new ApiError(409, "no_subscription", "Your plan has already ended. Pick a plan to start again.");
  if (!sub.cancel_at_period_end) throw new ApiError(409, "not_canceling", "Your plan is not set to end, so there is nothing to resume.");
  run("UPDATE account_subscriptions SET cancel_at_period_end = 0, updated_at = ? WHERE user_id = ?", Date.now(), userId);
}

/**
 * Demo only: pretend the current period is over, so the next read renews it (or ends it).
 * Lets people and tests see a renewal without waiting a month.
 */
export function demoEndPeriodNow(userId: string) {
  requireProvider();
  const sub = subRow(userId);
  if (!sub || sub.status !== "active") throw new ApiError(409, "no_subscription", "You are on the Free plan, so there is no period to end.");
  const now = Date.now();
  // Shift the whole period back so its months stay whole; the next one starts now.
  const shift = sub.period_end - now;
  run("UPDATE account_subscriptions SET period_start = period_start - ?, period_end = ?, updated_at = ? WHERE user_id = ?", shift, now, now, userId);
  syncSubscription(userId);
}
