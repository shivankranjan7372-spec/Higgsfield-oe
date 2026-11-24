"use client";

import { Wand2 } from "lucide-react";
import { useState } from "react";
import {
  remixCategories,
  remixCopy,
  remixExamples,
  type RemixCategory,
} from "@/content/remix";
import { Artwork, cn } from "@/ui";

/* The tile as drawn: 16px corners, a hairline, a dark fade at the foot and a soft inner glow. */
const card =
  "group relative block w-full overflow-clip rounded-2xl border border-border-subtle bg-surface-secondary text-left";

/**
 * The Directions tab: a heading, a category row and a three-column wall of sample directions.
 * Picking one puts its direction in the prompt box.
 */
export function RemixExamples({
  onPick,
}: {
  onPick: (direction: string) => void;
}) {
  const [category, setCategory] = useState<RemixCategory>("All");
  const shown = remixExamples.filter(
    (e) => category === "All" || e.category === category,
  );

  return (
    <div className="flex flex-col pb-6">
      <div className="flex flex-col items-center gap-2 px-2 pt-5 pb-4 text-center lg:h-[140px] lg:pb-0">
        <h2 className="font-display text-2xl leading-8 font-bold tracking-[-0.0429em] text-text-primary uppercase sm:text-3xl">
          {remixCopy.hero.title}
        </h2>
        <p className="max-w-[580px] text-sm leading-5 text-text-secondary">
          {remixCopy.hero.body}
        </p>
      </div>
      <div className="h-16 shrink-0 px-3">
        <div
          role="tablist"
          aria-label="Categories"
          className="scroll-none flex h-[52px] items-center gap-2 overflow-x-auto"
        >
          {remixCategories.map((c) => {
            const on = c === category;
            return (
              <button
                key={c}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setCategory(c)}
                className={cn(
                  "relative flex h-[52px] shrink-0 items-center px-1.5 text-sm leading-5 font-medium transition-colors duration-150",
                  on
                    ? "text-text-primary"
                    : "text-text-tertiary hover:text-text-tab",
                )}
              >
                {c}
                {on ? (
                  <span
                    aria-hidden
                    className="absolute inset-x-0 bottom-0 h-[2px] bg-text-primary"
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
      <ul
        aria-label="Sample directions"
        className="columns-1 gap-4 px-3 sm:columns-2 lg:columns-3"
      >
        {shown.map((ex) => (
          <li key={ex.id} className="mb-4 break-inside-avoid">
            <button
              type="button"
              onClick={() => onPick(ex.direction)}
              aria-label={`${remixCopy.useDirection}: ${ex.title}`}
              className={cn(
                card,
                ex.tall ? "aspect-[328/585]" : "aspect-[328/184]",
              )}
            >
              <Artwork
                name={`remix/${ex.id}`}
                className="absolute inset-0 size-full transition-transform duration-300 ease-out-soft group-hover:scale-[1.03]"
              />
              <span
                aria-hidden
                className="absolute inset-0 bg-[linear-gradient(180deg,#00000000_39.24%,#131416CC_87.22%)]"
              />
              <span
                aria-hidden
                className="absolute inset-0 rounded-2xl [box-shadow:#FFFFFF1A_0px_-8px_36px_inset]"
              />
              <span className="absolute inset-x-3 bottom-3 flex flex-col gap-2">
                <span className="line-clamp-3 text-xs leading-4 text-text-primary opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
                  {ex.direction}
                </span>
                <span className="flex h-7 items-center gap-[6px] text-sm leading-5 font-medium text-[#FFFFFFE5]">
                  <Wand2
                    className="size-4 shrink-0"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                  <span className="truncate">{ex.title}</span>
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
