"use client";

import {
  ChevronRight,
  Code2,
  Film,
  Image as ImageIcon,
  Layers,
  Mic,
  Music,
} from "lucide-react";
import Link from "next/link";
import useSWR from "swr";
import { LogoMark } from "@/components/brand/logo";
import {
  banners,
  contestBanner,
  mcpShowcase,
  moreFeatures,
} from "@/content/home";
import { routes } from "@/content/site";
import { fetcher } from "@/lib/api";
import { useNow } from "@/lib/browser";
import { Artwork, cn } from "@/ui";
import type { Contest } from "./feed";

const CHIP_ICONS: Record<string, typeof Film> = {
  Image: ImageIcon,
  Video: Film,
  Speech: Mic,
  Music: Music,
  Code: Code2,
  Batch: Layers,
};

const LIME_BUTTON =
  "inline-flex h-10 items-center justify-center rounded-lg bg-brand bg-[linear-gradient(180deg,#FFFF1400_0%,#FFFF14_100%)] px-4 text-sm leading-4 font-semibold whitespace-nowrap text-text-inverse shadow-[inset_0_-3px_0_#829B19,0_6px_4px_#00000040,0_32px_24px_#00000026] transition-[filter] duration-150 hover:brightness-105";

const CHROME = {
  backgroundImage: "linear-gradient(180deg, #FFFFFF 0%, #9A9A9A 100%)",
};

/** The black MCP panel: a chrome headline, two buttons and a wall of things to try. */
export function McpShowcase() {
  return (
    <section
      aria-labelledby="home-mcp"
      className="relative flex flex-col overflow-hidden rounded-2xl border border-border-subtle bg-black lg:h-[656px]"
    >
      <Artwork
        name="home/mcp-backdrop"
        className="absolute inset-0 size-full opacity-40"
      />
      <div className="relative flex flex-col items-center gap-[25px] px-6 pt-10 pb-8 lg:h-[233px] lg:justify-center lg:pt-6 lg:pb-0">
        <div className="flex flex-col items-center gap-[5px]">
          <h2
            id="home-mcp"
            className="flex items-center gap-2 font-display text-4xl leading-none font-bold tracking-[-0.04em] uppercase sm:text-[63.6px] sm:leading-[76.4px]"
          >
            <span className="bg-clip-text text-transparent" style={CHROME}>
              {mcpShowcase.lineOne}
            </span>
            <LogoMark size={44} className="hidden sm:block" />
            <span className="bg-clip-text text-transparent" style={CHROME}>
              {mcpShowcase.lineTwo}
            </span>
          </h2>
          <p
            className="bg-clip-text text-center font-display text-lg leading-6 font-medium tracking-[-0.06em] text-transparent uppercase sm:text-xl"
            style={CHROME}
          >
            {mcpShowcase.sub}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-[10px]">
          <Link href={mcpShowcase.primary.href} className={LIME_BUTTON}>
            {mcpShowcase.primary.label}
          </Link>
          <Link
            href={mcpShowcase.secondary.href}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-border-default bg-border-subtle px-4 text-sm leading-4 font-semibold text-text-primary shadow-[inset_0_2px_3px_#FFFFFF0D] backdrop-blur-[12px] transition-colors duration-150 hover:bg-border-default"
          >
            {mcpShowcase.secondary.label}
          </Link>
        </div>
      </div>

      <ul className="relative grid grid-cols-1 gap-4 px-4 sm:grid-cols-2 lg:mt-[32px] lg:grid-cols-4 lg:gap-x-5 lg:gap-y-5 lg:px-6">
        {mcpShowcase.cards.map((c, i) => (
          <li
            key={c.id}
            className={cn(
              i >= 4 && "hidden lg:block",
              i >= 2 && i < 4 && "hidden sm:block",
            )}
          >
            <Link
              href={routes.mcp}
              className="group relative block aspect-[325/258] overflow-hidden rounded-xl bg-surface-secondary shadow-[inset_0_0_0_1px_#FFFFFF1A]"
            >
              <Artwork
                name={c.art}
                className="absolute inset-0 size-full transition-transform duration-500 ease-out-soft group-hover:scale-[1.03]"
              />
              {i < 4 && (
                <span className="absolute inset-x-0 bottom-0 flex h-[88px] flex-col justify-center gap-2 px-4">
                  <span
                    aria-hidden
                    className="absolute inset-x-0 -top-8 bottom-0 backdrop-blur-[16px]"
                    style={{
                      backgroundImage: `linear-gradient(180deg, #00000000 0%, ${c.wash} 100%)`,
                    }}
                  />
                  <span className="relative line-clamp-2 text-base leading-6 font-medium text-text-primary">
                    {c.title}
                  </span>
                  <span className="relative flex gap-2">
                    {c.chips.map((chip) => {
                      const Icon = CHIP_ICONS[chip] ?? Layers;
                      return (
                        <span
                          key={chip}
                          className="flex h-6 items-center gap-[6px] rounded-full bg-border-subtle pr-[10px] pl-2 text-xs leading-4 font-medium text-text-tab"
                        >
                          <Icon
                            className="size-4"
                            strokeWidth={1.5}
                            aria-hidden
                          />
                          {chip}
                        </span>
                      );
                    })}
                  </span>
                </span>
              )}
              {i >= 4 && <span className="sr-only">{c.title}</span>}
              <span
                aria-hidden
                className="absolute inset-0 rounded-xl shadow-[inset_0_0_0_1px_#FFFFFF1A]"
              />
            </Link>
          </li>
        ))}
      </ul>

      <div className="relative mt-4 flex h-[98px] items-end justify-center bg-[linear-gradient(180deg,#00000000_0%,#000000_70%)] pb-3 lg:absolute lg:inset-x-0 lg:bottom-0 lg:mt-0">
        <Link
          href={mcpShowcase.seeAll.href}
          className="flex h-10 items-center gap-1 rounded-lg px-3 text-sm leading-4 font-medium text-text-primary transition-colors duration-150 hover:bg-border-subtle"
        >
          {mcpShowcase.seeAll.label}
          <ChevronRight className="size-5" strokeWidth={1.5} aria-hidden />
        </Link>
      </div>
    </section>
  );
}

function left(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return d > 0 ? `${d}d ${h}h` : `${h}h ${m}m`;
}

/** The open contest, from GET /api/community/contests. No open contest, no banner. */
export function ContestBanner() {
  const { data } = useSWR<{ contests: Contest[] }>(
    "/api/community/contests",
    fetcher,
    { revalidateOnFocus: false },
  );
  const now = useNow();
  const contest = data?.contests.find((c) => c.phase === "open");
  if (!contest) return null;
  const closes =
    now === null
      ? null
      : Math.max(0, Math.floor(contest.closesAt / 1000) - now);

  return (
    <section
      aria-labelledby="home-contest"
      data-section="contest"
      className="relative flex min-h-[450px] justify-center overflow-hidden rounded-2xl border border-border-default bg-black px-6 pt-[105px] pb-12"
    >
      <div className="absolute inset-y-0 left-1/2 w-full max-w-[1230px] -translate-x-1/2">
        <Artwork
          name="home/contest-backdrop"
          className="size-full opacity-70"
        />
      </div>
      <div className="relative flex w-full max-w-[447px] flex-col items-center gap-6 text-center">
        <div className="flex flex-col items-center gap-3">
          <p className="font-display text-sm leading-5 font-bold tracking-[0.16em] text-text-nav uppercase">
            {contestBanner.eyebrow}
          </p>
          <h2
            id="home-contest"
            className="bg-clip-text font-display text-[44px] leading-[44px] font-bold tracking-[-0.04em] text-transparent uppercase sm:text-[65.9px] sm:leading-[60px]"
            style={{
              backgroundImage:
                "linear-gradient(90deg, #616161 0%, #FFFFFF 50%, #616161 100%)",
            }}
          >
            {contest.title}
          </h2>
          <p className="max-w-[344px] text-xs leading-[18px] font-medium text-text-primary">
            {contest.summary}
          </p>
          <dl className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs leading-[18px] text-text-muted">
            <div className="flex gap-1">
              <dt>{contestBanner.prize}:</dt>
              <dd className="text-text-primary">{contest.prize}</dd>
            </div>
            {closes !== null && (
              <div className="flex gap-1">
                <dt>{contestBanner.closesIn}</dt>
                <dd className="font-mono text-text-primary tabular-nums">
                  {left(closes)}
                </dd>
              </div>
            )}
          </dl>
        </div>
        <Link
          href={`${routes.contests}/${contest.slug}`}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-text-primary px-[18px] text-sm leading-4 font-semibold text-text-inverse shadow-[0_2px_4px_#0000001A] transition-colors duration-150 hover:bg-text-soft"
        >
          {contestBanner.cta}
        </Link>
      </div>
    </section>
  );
}

/** The Boards banner, 300 tall. */
export function CanvasBanner() {
  const b = banners.canvas;
  return (
    <section
      aria-labelledby="home-canvas"
      className="relative flex min-h-[300px] items-center overflow-hidden rounded-4xl px-6 py-8 sm:pl-8"
    >
      <Artwork
        name={b.art}
        className="absolute inset-0 size-full rounded-4xl"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(90deg,#0F1113CC_0%,#0F111300_60%)]"
      />
      <div className="relative flex max-w-[413px] flex-col items-start gap-6">
        <div className="flex flex-col gap-[7px]">
          <p className="font-display text-base leading-4 font-bold tracking-[0.16em] text-text-primary uppercase">
            {b.eyebrow}
          </p>
          <div className="flex flex-col gap-[6px]">
            <h2
              id="home-canvas"
              className="flex flex-col font-display text-4xl leading-10 font-bold tracking-[-0.02em] text-text-primary uppercase sm:text-5xl sm:leading-[50px]"
            >
              {b.lines.map((l) => (
                <span key={l}>{l}</span>
              ))}
            </h2>
            <p className="flex flex-col text-sm leading-5 font-medium text-text-tab">
              {b.sub.map((l) => (
                <span key={l}>{l}</span>
              ))}
            </p>
          </div>
        </div>
        <Link
          href={b.cta.href}
          className="inline-flex h-10 items-center justify-center gap-[6px] rounded-xl bg-text-primary px-4 text-sm leading-5 font-semibold text-ink shadow-[0_2px_8px_#0000002E] transition-colors duration-150 hover:bg-text-soft"
        >
          <Layers className="size-[18px]" strokeWidth={1.5} aria-hidden />
          {b.cta.label}
        </Link>
      </div>
    </section>
  );
}

/** The grey "same cast" banner, 280 tall. */
export function CinemaBanner() {
  const b = banners.cinema;
  return (
    <section
      aria-labelledby="home-cinema-banner"
      className="relative flex min-h-[280px] overflow-hidden rounded-[32px] shadow-[0_4px_4px_#00000040]"
      style={{
        backgroundImage: "linear-gradient(180deg, #A0AAB7 0%, #2E343A 100%)",
      }}
    >
      <Artwork
        name={b.art}
        className="absolute inset-y-0 right-0 hidden w-[60%] md:block"
      />
      <div className="relative flex flex-col items-start gap-5 px-6 pt-5 pb-6">
        <div className="flex flex-col gap-[14px]">
          <span className="flex h-7 w-fit items-center rounded-sm bg-brand px-3 font-display text-sm leading-5 font-bold text-ink uppercase">
            {b.tag}
          </span>
          <div className="flex flex-col gap-[5px]">
            <h2
              id="home-cinema-banner"
              className="flex flex-col font-display text-[36px] leading-[38px] font-bold tracking-[-0.04em] text-[#FFFFFFE6] uppercase sm:text-[44px] sm:leading-[44px]"
            >
              {b.lines.map((l) => (
                <span key={l}>{l}</span>
              ))}
            </h2>
            <p className="text-lg leading-[28px] tracking-[-0.01em] text-[#FFFFFF99]">
              {b.sub}
            </p>
          </div>
        </div>
        <Link
          href={b.cta.href}
          className="inline-flex h-12 items-center justify-center rounded-xl bg-text-primary px-5 text-base leading-6 font-semibold tracking-[-0.01em] text-ink transition-colors duration-150 hover:bg-text-soft"
        >
          {b.cta.label}
        </Link>
      </div>
    </section>
  );
}

/** Every place in Parallax, as grey chips. */
export function MoreFeatures() {
  return (
    <section
      aria-labelledby="home-more"
      className="flex flex-col items-center gap-[33px] py-12 lg:min-h-[400px] lg:justify-center lg:py-0"
    >
      <h2
        id="home-more"
        className="text-center font-display text-3xl leading-9 font-bold tracking-[-0.02em] text-text-soft uppercase sm:text-5xl sm:leading-[56px]"
      >
        {moreFeatures.title}
      </h2>
      <ul className="flex max-w-[1408px] flex-wrap justify-center gap-2">
        {moreFeatures.links.map((l) => (
          <li key={l.label}>
            <Link
              href={l.href}
              className="flex h-8 items-center rounded-md bg-surface-menu px-3 text-base leading-6 font-medium text-text-muted transition-colors duration-150 hover:bg-surface-secondary-strong hover:text-text-primary"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
