"use client";

import { LoaderCircle, Sparkles } from "lucide-react";
import { formatCredits } from "@/config/economy";
import type { Studio } from "@/lib/studio";

/**
 * The lime Generate button with the live price under its label. It is never greyed out:
 * pressing it while something is missing says what is missing. While the request is on its
 * way a spinner takes the price's place.
 */
export function GenerateButton({ studio, label = "Generate" }: { studio: Studio; label?: string }) {
  const price = studio.quote ? formatCredits(studio.quote.millicredits) : null;
  return (
    <button
      type="button"
      disabled={studio.busy}
      aria-disabled={studio.blocker ? true : undefined}
      aria-label={price ? `${label}, ${price} credits` : label}
      onClick={() => void studio.generate()}
      className="relative flex h-12 w-full shrink-0 items-center justify-center overflow-clip rounded-xl bg-brand pb-[2px] shadow-lime-deep transition-[filter] duration-150 hover:brightness-105 active:brightness-90 disabled:cursor-progress sm:h-20 sm:w-[120px]"
    >
      {/* The warm light in the lower right corner, as drawn. */}
      <span aria-hidden className="pointer-events-none absolute inset-0 overflow-clip rounded-[14px]">
        <span className="absolute top-[36px] left-[38px] h-[136px] w-[78px] origin-top-left rotate-[102.79deg] rounded-[50%] bg-brand-glow blur-[41.5px]" />
      </span>
      <span className="relative flex flex-col items-center">
        <span className="font-display text-xs leading-[18px] font-bold text-ink uppercase">{label}</span>
        <span className="flex h-4 items-center gap-[2px] font-display text-xs leading-4 font-medium text-ink">
          {studio.busy ? (
            <LoaderCircle className="size-3 animate-spin" strokeWidth={2} aria-hidden />
          ) : (
            <>
              <Sparkles className="size-3 fill-current" strokeWidth={1.5} aria-hidden />
              {price ?? "–"}
            </>
          )}
        </span>
      </span>
    </button>
  );
}
