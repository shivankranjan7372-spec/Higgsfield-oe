"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { carouselWords, heroSlides } from "@/content/home";
import { Artwork, cn } from "@/ui";

const STEP_MS = 6000;
/** Card width plus the gap between cards, at 1440. Smaller screens measure the real card. */
const CARD = 512;
const GAP = 20;

function subscribeMotion(cb: () => void) {
  const m = window.matchMedia("(prefers-reduced-motion: reduce)");
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}

function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => true,
  );
}

/**
 * The row of featured studios under the nav. Moves one card every few seconds, pauses while
 * the pointer or keyboard focus is inside it, and never moves on its own for people who ask
 * for reduced motion. The 2-pixel bar above it shows the time to the next move.
 */
export function HeroCarousel() {
  const n = heroSlides.length;
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [cycle, setCycle] = useState(0);
  const reduced = useReducedMotion();
  const paused = hovered || focused || reduced;
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [step, setStep] = useState(CARD + GAP);

  const go = useCallback(
    (to: number) => {
      setIndex(((to % n) + n) % n);
      setCycle((c) => c + 1);
    },
    [n],
  );

  useEffect(() => {
    if (paused) return;
    const id = window.setTimeout(() => go(index + 1), STEP_MS);
    return () => window.clearTimeout(id);
  }, [paused, index, cycle, go]);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const measure = () => setStep(card.getBoundingClientRect().width + GAP);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(card);
    return () => ro.disconnect();
  }, []);

  // Two copies, so the row is always full whichever card leads.
  const row = [...heroSlides, ...heroSlides];

  return (
    <section
      aria-roledescription="carousel"
      aria-label={carouselWords.label}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
      className="group/hero relative"
    >
      <div className="h-[2px] w-full" aria-hidden>
        <div
          key={`${index}-${cycle}-${paused}`}
          className={cn("h-full bg-brand/60", paused ? "w-0" : "w-full origin-left")}
          style={paused ? undefined : { animation: `home-progress ${STEP_MS}ms linear both` }}
        />
        <style>{`@keyframes home-progress { from { transform: scaleX(0) } to { transform: scaleX(1) } }`}</style>
      </div>

      <div className="relative overflow-hidden pt-[10px]">
        <div className="mx-auto w-full max-w-[1440px] px-4">
          <ul
            className="flex gap-5 transition-transform duration-500 ease-out-soft motion-reduce:transition-none"
            style={{ transform: `translateX(-${index * step}px)` }}
          >
            {row.map((s, i) => {
              const shown = i >= index && i < index + 3;
              return (
                <li
                  key={`${s.id}-${i}`}
                  role="group"
                  aria-roledescription="slide"
                  aria-label={carouselWords.goTo((i % n) + 1, n)}
                  aria-hidden={!shown}
                  className="w-[calc(100vw-48px)] max-w-[512px] shrink-0"
                >
                  <div ref={i === 0 ? cardRef : undefined}>
                    <Link href={s.href} tabIndex={shown ? undefined : -1} className="group/card flex flex-col gap-3 rounded-md">
                      <span className="relative block aspect-[512/288] w-full overflow-hidden rounded-md">
                        <Artwork name={s.art} className="size-full transition-transform duration-500 ease-out-soft group-hover/card:scale-[1.02]" />
                        <span aria-hidden className="absolute inset-0 rounded-md shadow-[inset_-0.5px_-0.5px_1px_#FFFFFF1F,inset_0.8px_0.5px_0.5px_#1B1B1B2B]" />
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate font-display text-base leading-6 font-bold tracking-[-0.04em] text-text-soft uppercase">{s.title}</span>
                        <span className="truncate text-sm leading-5 text-text-muted transition-colors duration-150 group-hover/card:text-text-nav">{s.sub}</span>
                      </span>
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <button
          type="button"
          aria-label={carouselWords.previous}
          onClick={() => go(index - 1)}
          className="absolute top-[154px] left-6 z-10 hidden size-[38px] -translate-y-1/2 items-center justify-center rounded-full bg-surface-glass text-text-primary opacity-0 backdrop-blur-[12px] transition duration-150 group-focus-within/hero:opacity-100 group-hover/hero:opacity-100 hover:bg-surface-tertiary focus-visible:opacity-100 sm:flex"
        >
          <ChevronLeft className="size-5" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          aria-label={carouselWords.next}
          onClick={() => go(index + 1)}
          className="absolute top-[154px] right-6 z-10 hidden size-[38px] -translate-y-1/2 items-center justify-center rounded-full bg-surface-glass text-text-primary opacity-0 backdrop-blur-[12px] transition duration-150 group-focus-within/hero:opacity-100 group-hover/hero:opacity-100 hover:bg-surface-tertiary focus-visible:opacity-100 sm:flex"
        >
          <ChevronRight className="size-5" strokeWidth={1.5} />
        </button>

        <div className="pointer-events-none absolute top-[calc(10px+min(100vw-48px,512px)*288/512-22px)] left-4 z-10 flex w-[calc(100vw-48px)] max-w-[512px] justify-center">
          <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-[#0000004C] px-2 py-1 backdrop-blur-[12px]">
            {heroSlides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-label={carouselWords.goTo(i + 1, n)}
                aria-current={i === index ? "true" : undefined}
                onClick={() => go(i)}
                className="flex size-3 items-center justify-center rounded-full"
              >
                <span className={cn("block h-[6px] rounded-full transition-all duration-150", i === index ? "w-[6px] bg-text-primary" : "w-[6px] bg-text-idle hover:bg-text-tab")} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
