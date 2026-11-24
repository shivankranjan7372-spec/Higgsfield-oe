/**
 * The credit economy. Isomorphic: imported by the browser (live price on the Generate button)
 * and by the server (the authoritative price at submit).
 *
 * Credits are stored as integers in millicredits (1 credit = 1000), so the ledger never
 * does floating-point money maths.
 */

/** Retail value of one credit in US dollars. */
export const CREDIT_USD = 0.05;

/** Multiplier applied to the provider price. 1.4 = 40 % gross margin on cost. */
export const MARGIN = 1.4;

export const MILLI = 1000;

/** Prices are rounded up to this step (0.1 credit). */
export const PRICE_STEP = 100;

/** Provider price in USD -> what we charge, in millicredits. Never less than one step. */
export function usdToMillicredits(usd: number): number {
  if (!Number.isFinite(usd) || usd <= 0) return PRICE_STEP;
  const exact = (usd * MARGIN * MILLI) / CREDIT_USD;
  // The small epsilon stops 3.3600000001 from rounding up a whole step.
  return Math.max(PRICE_STEP, Math.ceil(exact / PRICE_STEP - 1e-6) * PRICE_STEP);
}

/** 3400 -> "3.4", 12000 -> "12", 1250000 -> "1,250". */
export function formatCredits(millicredits: number): string {
  const credits = millicredits / MILLI;
  const digits = Number.isInteger(credits) || Math.abs(credits) >= 1000 ? 0 : 1;
  return credits.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export interface Plan {
  id: string;
  name: string;
  /** Jobs a member may have queued or running at once. */
  concurrency: number;
  /** Credits granted each month, in whole credits. Informational until billing exists. */
  monthlyCredits: number;
  priceUsd: number;
}

export const PLANS: Record<string, Plan> = {
  free: { id: "free", name: "Free", concurrency: 4, monthlyCredits: 0, priceUsd: 0 },
  plus: { id: "plus", name: "Plus", concurrency: 6, monthlyCredits: 400, priceUsd: 19 },
  pro: { id: "pro", name: "Pro", concurrency: 10, monthlyCredits: 1200, priceUsd: 49 },
  studio: { id: "studio", name: "Studio", concurrency: 16, monthlyCredits: 3600, priceUsd: 129 },
};

export function planOf(id: string | null | undefined): Plan {
  return PLANS[id ?? "free"] ?? PLANS.free;
}

/** Credits a new account starts with, in whole credits. */
export const SIGNUP_CREDITS = 150;
export const GUEST_CREDITS = 60;

/**
 * Demo top-up packs. There is no payment processor yet: the wallet page adds these for free
 * and labels them as a demo. Real spend is capped by the provider budget on the server.
 */
export const TOPUP_PACKS = [
  { id: "pack-100", credits: 100, priceUsd: 5 },
  { id: "pack-500", credits: 500, priceUsd: 22 },
  { id: "pack-2000", credits: 2000, priceUsd: 80 },
] as const;

/** The most separate results one press of Generate may ask for. */
export const MAX_BATCH = 4;
