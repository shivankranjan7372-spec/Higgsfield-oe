import { PLANS, planOf } from "@/config/economy";

/**
 * What the plan picker shows. Plan ids, concurrency, monthly credits and the monthly price
 * come from `PLANS` in `@/config/economy`, so there is one source for limits. Wording, yearly
 * prices and feature lists live here.
 */

export type Interval = "month" | "year";
export const INTERVALS: Interval[] = ["month", "year"];

export interface PlanCard {
  id: string;
  name: string;
  tagline: string;
  /** Order on the page, cheapest first. Higher rank = bigger plan. */
  rank: number;
  /** Price in US cents for one month on monthly billing. */
  priceMonthCents: number;
  /** Price in US cents for one year on yearly billing (charged once a year). */
  priceYearCents: number;
  /** The yearly price spread over twelve months, for "per month, billed yearly". */
  priceYearPerMonthCents: number;
  /** Whole percent saved by paying yearly. */
  yearlySavingPercent: number;
  /** Whole credits granted each month, on either billing interval. */
  monthlyCredits: number;
  /** Jobs that may be queued or running at once. */
  concurrency: number;
  features: string[];
  highlight: string | null;
}

interface Copy {
  tagline: string;
  features: string[];
  highlight: string | null;
  /** Months charged for a year. 10 means two months free. */
  yearMonths: number;
}

const COPY: Record<string, Copy> = {
  free: {
    tagline: "Try every studio at your own pace.",
    features: ["Starter credits when you sign up", "All image, video and audio studios", "Private library", "Personal use"],
    highlight: null,
    yearMonths: 0,
  },
  plus: {
    tagline: "For steady weekly making.",
    features: ["Fresh credits every month", "More jobs running at once", "Commercial use", "Top up any time"],
    highlight: null,
    yearMonths: 10,
  },
  pro: {
    tagline: "For people who create every day.",
    features: ["Three times the credits of Plus", "Faster queue with more jobs at once", "Commercial use", "Early access to new models"],
    highlight: "Most chosen",
    yearMonths: 10,
  },
  studio: {
    tagline: "For heavy video and batch work.",
    features: ["The largest monthly credit pool", "The most jobs running at once", "Commercial use", "Early access to new models and tools"],
    highlight: "Best value per credit",
    yearMonths: 10,
  },
};

const FALLBACK: Copy = { tagline: "", features: [], highlight: null, yearMonths: 10 };

const ORDER = Object.keys(PLANS);

export function planCard(id: string): PlanCard {
  const p = planOf(id);
  const copy = COPY[p.id] ?? FALLBACK;
  const month = Math.round(p.priceUsd * 100);
  const year = month * copy.yearMonths;
  return {
    id: p.id,
    name: p.name,
    tagline: copy.tagline,
    rank: ORDER.indexOf(p.id),
    priceMonthCents: month,
    priceYearCents: year,
    priceYearPerMonthCents: Math.round(year / 12),
    yearlySavingPercent: month > 0 ? Math.round((1 - year / (month * 12)) * 100) : 0,
    monthlyCredits: p.monthlyCredits,
    concurrency: p.concurrency,
    features: copy.features,
    highlight: copy.highlight,
  };
}

export function catalog(): PlanCard[] {
  return ORDER.map(planCard);
}

export function isPlanId(id: unknown): id is string {
  return typeof id === "string" && Object.prototype.hasOwnProperty.call(PLANS, id);
}

export function priceCents(planId: string, interval: Interval): number {
  const c = planCard(planId);
  return interval === "year" ? c.priceYearCents : c.priceMonthCents;
}
