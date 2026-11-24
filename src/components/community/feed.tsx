"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import useSWRInfinite from "swr/infinite";
import useSWR from "swr";
import { communityWords as w, feedKinds, feedPeriods, feedTabs } from "@/content/community";
import { fetcher } from "@/lib/api";
import { Artwork, MenuItem, Popover, PopoverClose, PopoverContent, PopoverTrigger, Spinner, cn } from "@/ui";
import { EmptyState, ErrorLine } from "./bits";
import { GridSkeleton, PostGrid } from "./post-tile";
import type { Post, PostPage } from "./types";

/** The section heading as drawn under the carousel: a 52px mark and a fading uppercase line. */
export function SectionHeading({ slot, children, extra }: { slot: string; children: ReactNode; extra?: ReactNode }) {
  return (
    <div className="flex min-h-[52px] flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-4">
        <Artwork name={slot} className="size-[52px] shrink-0 rounded-md" />
        <h2
          className="min-w-0 bg-clip-text font-display text-2xl leading-[28px] font-bold tracking-[-0.05em] text-transparent uppercase"
          style={{ backgroundImage: "linear-gradient(in oklab 180deg, #FFFFFF 10%, #FFFFFF4C 90%)" }}
        >
          {children}
        </h2>
      </div>
      {extra}
    </div>
  );
}

/** A picker pill: h-8, lit with the hairline fill when chosen. */
export function Pill({ on, className, ...rest }: { on?: boolean } & React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      aria-pressed={on}
      className={cn(
        "flex h-8 shrink-0 items-center gap-1 rounded-full px-[14px] text-sm leading-4 font-medium whitespace-nowrap transition-colors duration-150",
        on ? "bg-border-default text-text-primary" : "text-text-tab hover:bg-border-subtle hover:text-text-primary",
        className,
      )}
      {...rest}
    />
  );
}

/** Endless paging over any list route that answers `{ posts, nextCursor }`. */
export function usePagedPosts(base: string | null) {
  const sep = base?.includes("?") ? "&" : "?";
  const r = useSWRInfinite<PostPage>(
    (index, prev: PostPage | null) => {
      if (!base) return null;
      if (index === 0) return base;
      if (!prev?.nextCursor) return null;
      return `${base}${sep}cursor=${encodeURIComponent(prev.nextCursor)}`;
    },
    fetcher,
    { revalidateFirstPage: false },
  );
  const pages = r.data ?? [];
  const posts: Post[] = pages.flatMap((p) => p.posts);
  const done = pages.length > 0 && !pages[pages.length - 1].nextCursor;
  const loadingMore = r.isValidating && r.size > pages.length;
  return { ...r, posts, done, loadingMore, first: r.isLoading };
}

/** The grid plus its states and the sentinel that pulls the next page. */
export function PagedGrid({ list, label, empty, hideAuthor }: { list: ReturnType<typeof usePagedPosts>; label: string; empty: ReactNode; hideAuthor?: boolean }) {
  const end = useRef<HTMLDivElement>(null);
  const { done, loadingMore, setSize, size, error, posts } = list;
  useEffect(() => {
    const el = end.current;
    if (!el || done || error) return;
    const io = new IntersectionObserver((seen) => {
      if (seen.some((s) => s.isIntersecting) && !loadingMore) setSize(size + 1);
    }, { rootMargin: "800px" });
    io.observe(el);
    return () => io.disconnect();
  }, [done, error, loadingMore, setSize, size, posts.length]);

  if (list.first) return <GridSkeleton />;
  if (error && !posts.length) return <ErrorLine error={error} onRetry={() => list.mutate()} className="py-12" />;
  if (!posts.length) return <>{empty}</>;
  return (
    <div className="flex flex-col gap-6">
      <PostGrid posts={posts} label={label} hideAuthor={hideAuthor} />
      <div ref={end} className="flex min-h-10 items-center justify-center text-xs leading-4 text-text-secondary">
        {error ? <ErrorLine error={error} onRetry={() => setSize(size)} /> : loadingMore ? <Spinner label={w.feed.more} /> : done ? w.feed.end : null}
      </div>
    </div>
  );
}

export interface FeedFilters {
  tab: string;
  period: string;
  kind: string | null;
  model: string | null;
  tag: string | null;
}

export function feedUrl(f: FeedFilters, tab = f.tab) {
  const q = new URLSearchParams({ tab, limit: "24" });
  if (tab === "top") q.set("period", f.period);
  if (f.kind) q.set("kind", f.kind);
  if (f.model) q.set("model", f.model);
  if (f.tag) q.set("tag", f.tag);
  return `/api/explore?${q}`;
}

function Picker({ label, value, options, onPick }: { label: string; value: string | null; options: { id: string | null; label: string; hint?: string }[]; onPick: (id: string | null) => void }) {
  const current = options.find((o) => o.id === value);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Pill on={!!value} aria-label={`${label}: ${current?.label ?? label}`}>
          <span className="max-w-[160px] truncate">{value ? current?.label ?? value : label}</span>
          <ChevronDown className="size-4" strokeWidth={1.5} aria-hidden />
        </Pill>
      </PopoverTrigger>
      <PopoverContent look="panel" align="start" sideOffset={6} className="max-h-[320px] w-[240px] overflow-y-auto p-2 scroll-quiet">
        {options.map((o) => (
          <PopoverClose key={o.id ?? "any"} asChild>
            <MenuItem selected={o.id === value} hint={o.hint} onClick={() => onPick(o.id)}>
              {o.label}
            </MenuItem>
          </PopoverClose>
        ))}
      </PopoverContent>
    </Popover>
  );
}

/** The row of picker pills over the feed: order, period, kind, model and tag. */
export function FeedFilterBar({ f, set }: { f: FeedFilters; set: (patch: Partial<FeedFilters>) => void }) {
  const models = useSWR<{ models: { id: string; name: string; posts: number }[] }>("/api/explore/models", fetcher);
  const tags = useSWR<{ tags: { tag: string; posts: number }[] }>("/api/explore/tags?limit=30", fetcher);
  return (
    <div className="scroll-none -mx-4 flex items-center gap-2 overflow-x-auto px-4 md:flex-wrap" role="group" aria-label="Filters">
      {feedTabs.map((t) => (
        <Pill key={t.id} on={f.tab === t.id} onClick={() => set({ tab: t.id })}>
          {t.label}
        </Pill>
      ))}
      {f.tab === "top" ? (
        <Picker label={w.feed.period} value={f.period} options={feedPeriods.map((p) => ({ id: p.id, label: p.label }))} onPick={(id) => set({ period: id ?? "week" })} />
      ) : null}
      <span className="mx-1 h-4 w-px shrink-0 bg-border-default" aria-hidden />
      <Picker label={w.feed.anyKind} value={f.kind} options={[{ id: null, label: w.feed.anyKind }, ...feedKinds.map((k) => ({ id: k.id, label: k.label }))]} onPick={(id) => set({ kind: id })} />
      <Picker
        label={w.feed.anyModel}
        value={f.model}
        options={[{ id: null, label: w.feed.anyModel }, ...(models.data?.models ?? []).map((m) => ({ id: m.id, label: m.name, hint: String(m.posts) }))]}
        onPick={(id) => set({ model: id })}
      />
      <Picker
        label={w.feed.anyTag}
        value={f.tag}
        options={[{ id: null, label: w.feed.anyTag }, ...(tags.data?.tags ?? []).map((t) => ({ id: t.tag, label: `#${t.tag}`, hint: String(t.posts) }))]}
        onPick={(id) => set({ tag: id })}
      />
    </div>
  );
}

export function FeedEmpty({ filtered, onClear, action }: { filtered: boolean; onClear: () => void; action: ReactNode }) {
  return filtered ? (
    <EmptyState
      text={w.feed.empty}
      action={
        <Pill on onClick={onClear}>
          {w.feed.clear}
        </Pill>
      }
    />
  ) : (
    <EmptyState text={w.feed.emptyAll} action={action} />
  );
}
