"use client";

import { useState, type CSSProperties } from "react";
import { horizonCopy } from "@/content/horizon";
import { Artwork, cn } from "@/ui";
import { onTabKeys } from "./parts";

const copy = horizonCopy.steps;
const items = copy.items;

/**
 * The tabbed strip: five steps from brief to film. The chosen slide sits in the middle
 * (762 × 504 at 1440); its neighbours are taller (608) and run off the sides.
 * `--w` is the slide width, so the strip shrinks on small screens.
 */
export function HorizonSteps() {
  const [index, setIndex] = useState<number>(copy.start);
  const step = items[index];
  const track: CSSProperties = { transform: `translateX(calc(-1 * var(--w) / 2 - ${index} * (var(--w) + 20px)))` };

  return (
    <section
      aria-label={copy.label}
      className="flex flex-col items-center gap-[20px] pt-20 pb-[120px] [--w:min(762px,calc(100vw-64px))]"
    >
      <div role="tablist" aria-label={copy.label} className="flex h-10 max-w-[calc(100vw-32px)] items-center justify-center gap-1 overflow-x-auto scroll-none rounded-full border border-border-subtle bg-border-subtle px-[3px]">
        {items.map((it, i) => {
          const on = i === index;
          return (
            <button
              key={it.id}
              type="button"
              role="tab"
              id={`step-tab-${it.id}`}
              aria-selected={on}
              aria-controls="step-panel"
              tabIndex={on ? 0 : -1}
              onClick={() => setIndex(i)}
              onKeyDown={(e) => onTabKeys(e, i, items.length, setIndex)}
              className={cn(
                "flex h-8 shrink-0 items-center justify-center rounded-full border px-2 text-xs leading-4 font-medium transition-colors duration-150",
                on
                  ? "border-border-subtle bg-surface-glass text-text-primary [box-shadow:#FFFFFF0D_0px_2px_3px_inset,#0000001F_0px_2px_2px]"
                  : "border-transparent text-text-tab hover:text-text-primary",
              )}
            >
              {it.tab}
            </button>
          );
        })}
      </div>

      <div id="step-panel" role="tabpanel" aria-labelledby={`step-tab-${step.id}`} className="flex w-full flex-col items-center gap-[20px]">
        <div className="relative w-full overflow-hidden" style={{ height: "calc(var(--w) * 608 / 762 + 64px)" }}>
          <ul className="absolute top-0 left-1/2 flex h-full items-center gap-[20px] transition-transform duration-500 ease-out-soft" style={track}>
            {items.map((it, i) => {
              const on = i === index;
              return (
                <li key={it.id} className="shrink-0">
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-hidden={!on}
                    onClick={() => setIndex(i)}
                    aria-label={it.tab}
                    className={cn("block w-(--w) overflow-hidden rounded-2xl bg-border-subtle transition-[height] duration-500 ease-out-soft", !on && "cursor-pointer")}
                    style={{ height: on ? "calc(var(--w) * 504 / 762)" : "calc(var(--w) * 608 / 762)" }}
                  >
                    <Artwork name={`horizon/step-${it.id}`} className="size-full" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        <p className="flex max-w-[552px] flex-col items-center gap-1 px-6 text-center text-base leading-6 font-medium desktop:flex-row desktop:items-start desktop:gap-[11px] desktop:px-0 desktop:text-lg">
          <span className="shrink-0 text-text-primary">{step.lead}</span>
          <span className="text-text-idle desktop:w-[461px]">{step.text}</span>
        </p>
        <span className="sr-only" aria-live="polite">
          {copy.slideOf(index + 1, items.length)}
        </span>
      </div>
    </section>
  );
}
