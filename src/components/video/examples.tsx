"use client";

import { ArrowUpRight } from "lucide-react";
import { useState } from "react";
import {
  videoCopy as t,
  videoExamples,
  type ExampleShape,
  type VideoExample,
} from "@/content/video";
import { Artwork, cn } from "@/ui";
import { Masonry } from "./masonry";

/* The three tile shapes drawn: 328×184, 328×218 and 328×585. */
const SHAPE: Record<ExampleShape, string> = {
  wide: "aspect-[328/184]",
  photo: "aspect-[328/218]",
  tall: "aspect-[328/585]",
};

function Tile({
  example,
  onUse,
}: {
  example: VideoExample;
  onUse: (e: VideoExample) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onUse(example)}
      aria-label={`${t.useExample}: ${example.prompt}`}
      className={cn(
        "group relative block w-full overflow-clip rounded-2xl border border-border-subtle bg-surface-secondary text-left",
        SHAPE[example.shape],
      )}
    >
      <Artwork
        name={`video/example-${example.id}`}
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
        <span className="line-clamp-2 text-sm leading-5 font-medium text-[#FFFFFFE5]">
          {example.prompt}
        </span>
        <span className="flex h-7 items-center gap-1 self-start rounded-md bg-[#00000080] px-2 text-xs leading-4 font-medium text-text-primary opacity-0 backdrop-blur-sm transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 [@media(hover:none)]:opacity-100">
          {t.useExample}
          <ArrowUpRight className="size-[14px]" strokeWidth={1.5} aria-hidden />
        </span>
      </span>
    </button>
  );
}

/** The example gallery: the heading, category tabs, and three columns of sample prompts. */
export function Examples({
  onUse,
}: {
  onUse: (example: VideoExample) => void;
}) {
  const [category, setCategory] = useState("all");
  const shown =
    category === "all"
      ? videoExamples
      : videoExamples.filter((e) => e.category === category);
  return (
    <div className="flex flex-col">
      <div className="flex flex-col items-center gap-2 px-4 pt-5 pb-4 text-center lg:h-[140px] lg:pb-0">
        <h1 className="font-display text-2xl leading-8 font-bold tracking-[-0.0429em] text-text-primary uppercase sm:text-3xl">
          {t.hero.title}
        </h1>
        <p className="max-w-[580px] text-sm leading-5 text-text-secondary">
          {t.hero.body}
        </p>
      </div>
      <div className="flex h-16 items-start">
        <div
          role="tablist"
          aria-label="Categories"
          className="scroll-none relative ml-3 flex h-[52px] min-w-0 items-center gap-2 overflow-x-auto"
        >
          {t.categories.map((c) => {
            const on = c.id === category;
            return (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setCategory(c.id)}
                className={cn(
                  "relative flex h-[52px] shrink-0 items-center px-[6px] text-sm leading-5 font-medium whitespace-nowrap transition-colors duration-150",
                  on
                    ? "text-text-primary"
                    : "text-text-tertiary hover:text-text-tab",
                )}
              >
                {c.label}
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
      <Masonry
        label="Examples"
        className="px-0 pt-3"
        items={shown.map((example) => ({
          key: example.id,
          node: <Tile example={example} onUse={onUse} />,
        }))}
      />
    </div>
  );
}
