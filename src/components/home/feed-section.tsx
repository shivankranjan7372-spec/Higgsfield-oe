"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { tileWords, type GridLook } from "@/content/home";
import { errorMessage } from "@/lib/api";
import { cn } from "@/ui";
import { useFeed, type Post } from "./feed";
import { PostTile } from "./post-tile";

/** How many posts each look asks for, and how tall its window is at 1440. */
const LOOKS: Record<GridLook, { limit: number; clip: string; fade: string; grid: string }> = {
  shorts: {
    limit: 10,
    clip: "max-h-[640px] md:max-h-[1024px]",
    fade: "h-[208px] pt-[124px] bg-[linear-gradient(0deg,#0F1113_0%,#00000000_100%)]",
    grid: "grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-5",
  },
  mosaic: {
    limit: 18,
    clip: "max-h-[640px] md:max-h-[1024px]",
    fade: "h-[208px] pt-[124px] bg-[linear-gradient(0deg,#0F1113_0%,#00000000_100%)]",
    grid: "columns-2 gap-2 md:columns-4 lg:columns-6",
  },
  wide: {
    limit: 12,
    clip: "max-h-[613px]",
    fade: "h-[240px] pt-[160px] bg-[linear-gradient(180deg,#0F111300_0%,#0F1113_73.33%)]",
    grid: "grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4",
  },
  masonry: {
    limit: 16,
    clip: "max-h-[640px] md:max-h-[896px]",
    fade: "h-[208px] pt-[124px] bg-[linear-gradient(0deg,#0F1113_0%,#00000000_100%)]",
    grid: "columns-2 gap-2 md:columns-3 lg:columns-4",
  },
};

/** The lime display heading and grey line over every grid. */
export function SectionHeading({ id, title, sub, look, children }: { id?: string; title: string; sub: string; look: GridLook; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className={cn("flex min-w-0 flex-col", look === "masonry" ? "gap-[3px]" : "gap-1")}>
        <h2
          id={id}
          className={cn(
            "font-display text-2xl font-bold text-brand uppercase md:text-3xl",
            look === "masonry" ? "leading-[30px] tracking-[-0.02em] md:leading-[36px]" : "leading-7 tracking-[-0.0429em] md:leading-8",
          )}
        >
          {title}
        </h2>
        <p className={cn("text-sm leading-5", look === "shorts" ? "text-text-secondary" : "text-text-muted")}>{sub}</p>
      </div>
      {children}
    </div>
  );
}

/** The 48-pixel lime-wash button at the foot of a grid. */
export function MoreLink({ href, label, strong }: { href: string; label: string; strong?: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "pointer-events-auto inline-flex h-12 items-center justify-center gap-2 rounded-xl px-5 font-semibold text-brand transition-colors duration-150",
        strong
          ? "border-2 border-[#00000017] bg-[#D1FE173D] text-base leading-6 tracking-[-0.01em] backdrop-blur-[8px] hover:bg-[#D1FE1752]"
          : "bg-[#D1FE171A] text-lg leading-6 tracking-[-0.0222em] hover:bg-brand-tint",
      )}
    >
      {label}
      <ArrowUpRight className="size-[18px]" strokeWidth={1.5} aria-hidden />
    </Link>
  );
}

/** Ghost tiles in the shape of a look, for loading and behind the empty state. */
function Ghosts({ look, count, shimmer }: { look: GridLook; count: number; shimmer?: boolean }) {
  const heights = [405, 304, 152, 405, 128, 405, 304, 152];
  return (
    <div className={LOOKS[look].grid} aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          style={look === "mosaic" || look === "masonry" ? { aspectRatio: `228/${heights[i % heights.length]}` } : undefined}
          className={cn(
            "w-full break-inside-avoid bg-surface-secondary",
            look === "shorts" && "aspect-[269/478] rounded-2xl border border-border-subtle",
            look === "mosaic" && "mb-2 rounded-2xl border border-border-subtle",
            look === "masonry" && "mb-2 rounded-xl",
            look === "wide" && "aspect-[337/191] rounded-lg",
            shimmer && "shimmer",
          )}
        />
      ))}
    </div>
  );
}

/**
 * One home section with a grid of real community work from GET /api/explore. The grid is
 * cut at the drawn height with a fade and a button, as in the design. Loading draws ghost
 * tiles; no posts draws the ghost tiles dimmed under one line and one button.
 */
export function FeedSection({
  id,
  title,
  sub,
  look,
  query,
  more,
  empty,
  headerExtra,
  className,
}: {
  id: string;
  title: string;
  sub: string;
  look: GridLook;
  query: Record<string, string>;
  more: { label: string; href: string };
  empty: { line: string; cta: string; href: string };
  headerExtra?: ReactNode;
  className?: string;
}) {
  const conf = LOOKS[look];
  const { data, error, isLoading, mutate } = useFeed(query, conf.limit);
  const posts: Post[] = data?.posts ?? [];
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const check = () => setOverflows(box.scrollHeight > box.clientHeight + 4);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(box);
    for (const child of Array.from(box.children)) ro.observe(child);
    return () => ro.disconnect();
  }, [posts.length]);

  const headingId = `home-${id}`;
  const strong = look === "masonry";

  return (
    <section aria-labelledby={headingId} data-section={id} className={cn("flex flex-col gap-5", className)}>
      <SectionHeading id={headingId} title={title} sub={sub} look={look}>
        {headerExtra}
      </SectionHeading>

      {error ? (
        <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border border-border-subtle bg-surface-primary px-6 py-12 text-center">
          <p className="text-sm leading-5 text-text-primary">{tileWords.loadError}</p>
          <p className="text-sm leading-5 text-text-muted">{errorMessage(error)}</p>
          <button
            type="button"
            onClick={() => mutate()}
            className="h-10 rounded-lg bg-border-subtle px-4 text-sm leading-5 font-semibold text-text-primary transition-colors duration-150 hover:bg-border-default"
          >
            {tileWords.retry}
          </button>
        </div>
      ) : isLoading && !data ? (
        <div className={cn("overflow-hidden", look === "wide" ? "max-h-[402px]" : "max-h-[480px]")} aria-busy="true">
          <Ghosts look={look} count={look === "mosaic" ? 12 : 8} shimmer />
        </div>
      ) : posts.length === 0 ? (
        <div className="relative overflow-hidden" data-empty>
          <div className={cn("overflow-hidden opacity-60", look === "wide" ? "max-h-[191px] lg:max-h-[402px]" : "max-h-[360px]")}>
            <Ghosts look={look} count={look === "mosaic" ? 12 : look === "shorts" ? 5 : 8} />
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[radial-gradient(60%_70%_at_50%_50%,#0F1113E6_0%,#0F111399_60%,#0F111300_100%)] px-6 text-center">
            <p className="max-w-[420px] text-base leading-6 font-medium text-text-primary">{empty.line}</p>
            <Link
              href={empty.href}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-brand bg-[linear-gradient(180deg,#FFFF1400_0%,#FFFF14_100%)] px-4 text-sm leading-4 font-semibold text-text-inverse shadow-[inset_0_-3px_0_#829B19] transition-colors duration-150 hover:bg-brand-glow"
            >
              {empty.cta}
            </Link>
          </div>
        </div>
      ) : (
        <div className="relative">
          <div ref={boxRef} className={cn("overflow-hidden", conf.clip)}>
            <div className={conf.grid}>
              {posts.map((post) => (
                <PostTile key={post.id} post={post} look={look} className={look === "mosaic" || look === "masonry" ? "mb-2 break-inside-avoid" : undefined} />
              ))}
            </div>
          </div>
          {overflows ? (
            <div className={cn("pointer-events-none absolute inset-x-0 bottom-0 z-[3] flex justify-center", conf.fade)}>
              <MoreLink href={more.href} label={more.label} strong={strong} />
            </div>
          ) : (
            <div className="mt-6 flex justify-center">
              <MoreLink href={more.href} label={more.label} strong={strong} />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
