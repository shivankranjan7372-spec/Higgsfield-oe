"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";
import { horizonCopy } from "@/content/horizon";
import { Artwork, cn } from "@/ui";
import { Display, headlineFill, onTabKeys, rowGlow } from "./parts";

const copy = horizonCopy.closer;
type Row = (typeof copy.rows)[number];

/** "Closer look": a heading, then four rows of words beside a 933 × 528 picture, alternating sides. */
export function HorizonCloser() {
  const [first, ...rest] = copy.rows;
  return (
    <section aria-labelledby="closer-title" className="flex flex-col items-center">
      <div className="flex w-full flex-col items-center gap-10 px-4 py-16 desktop:gap-[60px] desktop:px-0 desktop:py-20">
        <header className="flex flex-col items-center gap-[6px] text-center">
          <p className="text-xs leading-5 font-medium tracking-[0.0833em] text-text-idle uppercase">{copy.eyebrow}</p>
          <span id="closer-title">
            <Display lines={copy.title} className="items-center text-3xl leading-9 desktop:text-[40px] desktop:leading-[48px]" />
          </span>
        </header>
        <RowBody row={first} flip={false} />
      </div>
      {rest.map((row, i) => (
        <div key={row.id} className="flex w-full items-center px-4 py-12 desktop:h-[688px] desktop:px-0 desktop:py-20" style={i % 2 === 0 ? rowGlow : undefined}>
          <RowBody row={row} flip={i % 2 === 0} />
        </div>
      ))}
    </section>
  );
}

function RowBody({ row, flip }: { row: Row; flip: boolean }) {
  return (
    <div className={cn("mx-auto flex w-full max-w-[1312px] flex-col gap-6 desktop:items-center desktop:gap-0", flip ? "desktop:flex-row-reverse" : "desktop:flex-row")}>
      <div className={cn("flex shrink-0 flex-col items-start gap-2 desktop:w-[379px]", flip && "desktop:pl-[58px]")}>
        <h3 className="flex flex-col font-display text-2xl leading-8 font-bold tracking-[-0.04em] uppercase desktop:w-[321px] desktop:text-3xl">
          {row.title.map((line) => (
            <span key={line} className="bg-clip-text text-transparent" style={headlineFill}>
              {line}
            </span>
          ))}
        </h3>
        <p className="max-w-[306px] text-sm leading-5 font-medium text-text-idle">{row.text}</p>
      </div>
      <div className="relative aspect-[933/528] w-full min-w-0 overflow-hidden rounded-2xl desktop:w-[933px] desktop:shrink-0">
        <RowPicture row={row} />
      </div>
    </div>
  );
}

function RowPicture({ row }: { row: Row }): ReactNode {
  if ("stages" in row) return <Stages id={row.id} stages={row.stages} />;
  if ("compare" in row) return <Compare id={row.id} words={row.compare} />;
  return <Artwork name={`horizon/${row.id}`} className="size-full" />;
}

/** The picture with the four-way pill at the bottom: each stage shows its own picture. */
function Stages({ id, stages }: { id: string; stages: readonly string[] }) {
  const [index, setIndex] = useState(0);
  return (
    <>
      <Artwork key={index} name={`horizon/${id}-${index + 1}`} className="absolute inset-0 size-full animate-fade-in" />
      <div
        role="tablist"
        aria-label={stages.join(", ")}
        className="absolute bottom-3 left-1/2 flex h-[46px] -translate-x-1/2 items-center justify-center gap-[6px] rounded-full border border-border-default bg-border-subtle px-[6px] backdrop-blur-sm desktop:bottom-8"
      >
        {stages.map((s, i) => {
          const on = i === index;
          return (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={on}
              tabIndex={on ? 0 : -1}
              onClick={() => setIndex(i)}
              onKeyDown={(e) => onTabKeys(e, i, stages.length, setIndex)}
              className={cn(
                "flex h-8 shrink-0 items-center rounded-full px-2 text-xs leading-4 font-medium transition-colors duration-150",
                on ? "bg-text-primary text-text-inverse" : "text-text-tab hover:text-text-primary",
              )}
            >
              {s}
            </button>
          );
        })}
      </div>
    </>
  );
}

/** Two pictures with a handle between them. Drag it, or focus it and use the arrow keys. */
function Compare({ id, words }: { id: string; words: { label: string; first: string; last: string } }) {
  const [split, setSplit] = useState(50);
  return (
    <>
      <Artwork name={`horizon/${id}-last`} alt={words.last} className="absolute inset-0 size-full" />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}>
        <Artwork name={`horizon/${id}-first`} alt={words.first} className="size-full" />
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={split}
        onChange={(e) => setSplit(Number(e.target.value))}
        aria-label={words.label}
        aria-valuetext={`${split}% ${words.first}`}
        className="peer absolute inset-0 size-full cursor-ew-resize opacity-0"
      />
      <div aria-hidden className="pointer-events-none absolute inset-y-0 w-px bg-text-primary/70" style={{ left: `${split}%` }} />
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 flex h-5 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-text-primary text-text-inverse peer-focus-visible:ring-2 peer-focus-visible:ring-brand"
        style={{ left: `${split}%` }}
      >
        <ChevronLeft size={20} strokeWidth={1.5} className="-mr-1" />
        <ChevronRight size={20} strokeWidth={1.5} className="-ml-1" />
      </div>
    </>
  );
}
