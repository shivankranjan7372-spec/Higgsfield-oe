"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { communityWords as w } from "@/content/community";
import { routes } from "@/content/site";
import { cn } from "@/ui";
import type { Contest } from "./types";

/** The contest bar: breadcrumb on the left, the page's tabs after it, 52 high on black. */
export function ContestBar({ crumb, tabs }: { crumb?: string; tabs?: ReactNode }) {
  return (
    <div className="sticky top-0 z-20 bg-black">
      <div className="flex min-h-[52px] flex-col gap-0 px-4 md:flex-row md:items-center md:gap-5">
        <nav aria-label="Breadcrumb" className="flex h-[44px] min-w-0 items-center gap-1 text-sm leading-5 font-medium md:h-5 md:w-[580px] md:shrink-0">
          {crumb ? (
            <>
              <Link href={routes.contests} className="shrink-0 text-text-tertiary transition-colors duration-150 hover:text-text-primary">
                {w.contests.title}
              </Link>
              <span className="text-text-tertiary" aria-hidden>
                /
              </span>
              <span aria-current="page" className="truncate text-text-primary">
                {crumb}
              </span>
            </>
          ) : (
            <span aria-current="page" className="text-text-primary">
              {w.contests.title}
            </span>
          )}
        </nav>
        {tabs}
      </div>
    </div>
  );
}

/** "3d 4h", from seconds. */
export function span(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s % 60}s`;
}

/** The next date that matters for a contest, as a short line. */
export function timeLine(c: Contest, now: number | null): string {
  const at = (ms: number) => (now === null ? "" : ` in ${span(ms / 1000 - now)}`);
  if (c.phase === "upcoming") return `${w.contests.opens}${at(c.opensAt)}`;
  if (c.phase === "open") return `${w.contests.closes}${at(c.closesAt)}`;
  if (c.phase === "voting") return `${w.contests.ends}${at(c.endsAt)}`;
  return w.contests.ended;
}

export function PhaseTag({ phase, className }: { phase: Contest["phase"]; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-[10px] text-xs leading-4 font-semibold",
        phase === "open" ? "bg-brand-tint text-brand" : phase === "voting" ? "bg-border-default text-text-primary" : "bg-border-subtle text-text-tab",
        className,
      )}
    >
      {w.phase[phase]}
    </span>
  );
}

/** The metallic call-to-action as drawn under the contest title. */
export const chromeButton =
  "flex h-[48px] items-center justify-center rounded-xl border border-[#F2F2F2] bg-origin-border px-5 text-base leading-5 font-semibold text-text-inverse [box-shadow:#00000066_0px_-1px_1px_inset,#FFFFFFE6_0px_1px_1px_inset,#00000059_0px_4px_8px] transition-[filter] duration-150 hover:brightness-110 disabled:opacity-50 bg-[linear-gradient(in_oklab_180deg,#FAFAFA_0%,#C2C2C2_14%,#F0F0F0_43%,#E5E5E5_49%,#C4C4C4_69%,#F0F0F0_100%)]";
