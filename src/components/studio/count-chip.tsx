"use client";

import { Minus, Plus } from "lucide-react";
import type { Studio } from "@/lib/studio";

const step =
  "flex h-8 w-[31px] items-center text-text-muted transition-colors duration-150 hover:text-text-primary disabled:pointer-events-none disabled:opacity-40";

/** "− 1/4 +": how many results one press of Generate makes. Hidden when the model makes one at a time. */
export function CountChip({ studio }: { studio: Studio }) {
  const { count, maxCount } = studio;
  if (maxCount <= 1) return null;
  return (
    <div role="group" aria-label="How many to make" className="inline-flex h-8 shrink-0 items-center rounded-md bg-border-subtle">
      <button type="button" aria-label="One fewer" disabled={count <= 1} onClick={() => studio.setCount(count - 1)} className={`${step} justify-end rounded-l-md pr-[2px]`}>
        <Minus className="size-4" strokeWidth={1.5} aria-hidden />
      </button>
      <span aria-live="polite" aria-label={`${count} of ${maxCount}`} className="flex h-4 w-9 items-center justify-center text-sm leading-4 font-semibold text-text-primary tabular-nums">
        {count}
        <span className="text-[#FFFFFF99]">/{maxCount}</span>
      </span>
      <button type="button" aria-label="One more" disabled={count >= maxCount} onClick={() => studio.setCount(count + 1)} className={`${step} justify-start rounded-r-md pl-[2px]`}>
        <Plus className="size-4" strokeWidth={1.5} aria-hidden />
      </button>
    </div>
  );
}
