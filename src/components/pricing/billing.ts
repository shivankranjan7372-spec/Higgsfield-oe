"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/api";
import { pricingCopy as t, fill } from "@/content/pricing";

/** Shapes from docs/api/account.md. Money is US cents; plan credits are whole credits. */
export interface PlanCard {
  id: string;
  name: string;
  tagline: string;
  rank: number;
  priceMonthCents: number;
  priceYearCents: number;
  priceYearPerMonthCents: number;
  yearlySavingPercent: number;
  monthlyCredits: number;
  concurrency: number;
  features: string[];
  highlight: string | null;
}

export type Interval = "month" | "year";

export interface Subscription {
  planId: string;
  plan: PlanCard;
  interval: Interval | null;
  status: "free" | "active" | "canceling";
  currentPeriodStart: number | null;
  currentPeriodEnd: number | null;
  renewsAt: number | null;
  nextChargeCents: number | null;
  pendingChange: { planId: string; planName: string; interval: Interval; startsAt: number } | null;
  monthlyCredits: { amount: number; windowStart: number; windowEnd: number; nextGrantAt: number | null } | null;
  demoBilling: boolean;
}

export interface PlansResponse {
  plans: PlanCard[];
  current: Subscription | null;
  demoBilling: boolean;
  currency: string;
}

export const PLANS_KEY = "/api/billing/plans";
export const SUB_KEY = "/api/billing/subscription";

export function usePlans() {
  return useSWR<PlansResponse>(PLANS_KEY, fetcher, { revalidateOnFocus: false });
}

/** Only asked for when someone is signed in (guests included). */
export function useSubscription(enabled: boolean) {
  return useSWR<{ subscription: Subscription; balance: number }>(enabled ? SUB_KEY : null, fetcher);
}

/** 1900 -> "$19", 1583 -> "$15.83". */
export function money(cents: number): string {
  const whole = cents % 100 === 0;
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  });
}

export function day(ms: number): string {
  return new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", year: "numeric" }).format(ms);
}

/** What paying yearly saves against twelve monthly payments, in cents. */
export function yearlySaving(plan: PlanCard): number {
  return Math.max(0, plan.priceMonthCents * 12 - plan.priceYearCents);
}

export type Action =
  | { kind: "signin" }
  | { kind: "current" }
  | { kind: "change"; label: string; when: "now" | "period_end" }
  | { kind: "keep"; label: string }
  | { kind: "resume"; label: string };

/**
 * The button for one card, from the "Which button to show" table in docs/api/account.md.
 * `sub` is null for a visitor or guest, who must sign in first.
 */
export function actionFor(target: PlanCard, interval: Interval, sub: Subscription | null, member: boolean): Action {
  if (!member || !sub) return { kind: "signin" };
  const current = sub.plan;
  if (sub.status === "free" || current.rank === 0) {
    return { kind: "change", label: fill(t.card.get, { plan: target.name }), when: "now" };
  }
  const sameInterval = sub.interval === interval;
  if (target.id === current.id && sameInterval) {
    if (sub.status === "canceling") return { kind: "resume", label: fill(t.button.keep, { plan: target.name }) };
    if (sub.pendingChange) return { kind: "keep", label: fill(t.button.keep, { plan: target.name }) };
    return { kind: "current" };
  }
  if (target.id === current.id) {
    return interval === "year"
      ? { kind: "change", label: t.button.toYearly, when: "now" }
      : { kind: "change", label: t.button.toMonthly, when: "period_end" };
  }
  if (target.rank > current.rank) return { kind: "change", label: t.button.upgrade, when: "now" };
  return { kind: "change", label: t.button.downgrade, when: "period_end" };
}
