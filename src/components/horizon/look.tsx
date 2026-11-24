"use client";

import { useState } from "react";
import { horizonCopy } from "@/content/horizon";
import { Artwork, cn } from "@/ui";
import { Display, onTabKeys } from "./parts";

const copy = horizonCopy.look;

/** The full-width picture with the look chips at the bottom left. Each chip swaps the picture. */
export function HorizonLook() {
  const [index, setIndex] = useState(0);
  const look = copy.items[index];
  return (
    <section className="relative flex h-[600px] flex-col items-start justify-between overflow-hidden px-4 py-12 desktop:h-[900px] desktop:justify-center desktop:gap-[604px] desktop:px-16 desktop:py-0">
      <Artwork key={look.id} name={`horizon/look-${look.id}`} className="absolute inset-0 size-full animate-fade-in" />
      <div aria-hidden className="absolute inset-0 bg-[#0000001A]" />
      <div aria-hidden className="absolute inset-0" style={{ backgroundImage: "linear-gradient(180deg, #00000000 70.77%, #00000099 100%)" }} />

      <Display lines={copy.title} className="relative text-3xl leading-9 desktop:text-[40px] desktop:leading-[48px]" />

      <div role="tablist" aria-label={copy.label} className="relative flex max-w-full items-center gap-2 overflow-x-auto scroll-none">
        {copy.items.map((it, i) => {
          const on = i === index;
          return (
            <button
              key={it.id}
              type="button"
              role="tab"
              aria-selected={on}
              tabIndex={on ? 0 : -1}
              onClick={() => setIndex(i)}
              onKeyDown={(e) => onTabKeys(e, i, copy.items.length, setIndex)}
              className={cn(
                "flex h-10 shrink-0 items-center rounded-[96px] px-[10px] text-[15px] leading-5 font-medium transition-colors duration-150",
                on
                  ? "bg-text-primary text-text-inverse [box-shadow:#FFFFFF0D_0px_0px_0px_1.25px_inset,#FFFFFF0D_0px_2.5px_3.75px_inset,#0000001F_0px_2.5px_5px_-0.625px]"
                  : "text-text-primary hover:bg-[#FFFFFF1A]",
              )}
            >
              <span aria-hidden className="size-5 shrink-0 rounded-full border border-border-strong" style={{ backgroundColor: it.swatch }} />
              <span className="px-[5px]">{it.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
