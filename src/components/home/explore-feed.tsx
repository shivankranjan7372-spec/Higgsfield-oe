"use client";

import { Check, ChevronDown, Hash, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import useSWRInfinite from "swr/infinite";
import { LoginDialog } from "@/components/entry/login-dialog";
import { exploreWords, tileWords } from "@/content/home";
import { routes } from "@/content/site";
import { api, errorMessage, fetcher } from "@/lib/api";
import { useQueryParam } from "@/lib/browser";
import { useSession } from "@/lib/session";
import { cn, MenuItem, Popover, PopoverClose, PopoverContent, PopoverTrigger, Spinner } from "@/ui";
import { feedKey, useExploreModels, type FeedPage, type Post } from "./feed";
import { PostTile } from "./post-tile";

const PAGE = 24;
const TABS = ["trending", "new", "top", "following"];
const PERIODS = ["day", "week", "month", "all"];
const KINDS = ["", "image", "video", "audio"];

function pick(value: string | null, allowed: string[], fallback: string): string {
  return value !== null && allowed.includes(value) ? value : fallback;
}

/** A pill tab in the row of filters. */
function Pill({ active, onClick, children, label }: { active: boolean; onClick: () => void; children: React.ReactNode; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-3 text-sm leading-4 font-medium whitespace-nowrap transition-colors duration-150",
        active ? "bg-border-default text-text-primary" : "bg-border-subtle text-text-tab hover:bg-border-default hover:text-text-primary",
      )}
    >
      {children}
    </button>
  );
}

/**
 * The full public feed: tabs, filters and an endless grid. Likes and saves work for members
 * and guests; a visitor with no session is asked to make an account first.
 */
export function ExploreFeed() {
  const qTab = useQueryParam("tab");
  const qPeriod = useQueryParam("period");
  const qKind = useQueryParam("kind");
  const qModel = useQueryParam("model");
  const qTag = useQueryParam("tag");
  const [picked, setPicked] = useState<{ tab?: string; period?: string; kind?: string; model?: string; tag?: string }>({});
  const tab = pick(picked.tab ?? qTab, TABS, "trending");
  const period = pick(picked.period ?? qPeriod, PERIODS, "week");
  const kind = pick(picked.kind ?? qKind, KINDS, "");
  const model = picked.model ?? qModel ?? "";
  const tag = picked.tag ?? qTag ?? "";

  const { user, loading: sessionLoading } = useSession();
  const [loginOpen, setLoginOpen] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  function set(next: typeof picked) {
    const merged = { tab, period, kind, model, tag, ...next };
    setPicked(merged);
    const q = new URLSearchParams();
    if (merged.tab !== "trending") q.set("tab", merged.tab);
    if (merged.tab === "top" && merged.period !== "week") q.set("period", merged.period);
    if (merged.kind) q.set("kind", merged.kind);
    if (merged.model) q.set("model", merged.model);
    if (merged.tag) q.set("tag", merged.tag);
    const s = q.toString();
    window.history.replaceState(null, "", s ? `?${s}` : window.location.pathname);
  }

  const query: Record<string, string> = { tab, kind, model, tag };
  if (tab === "top") query.period = period;
  const blocked = tab === "following" && !user;
  const waiting = tab === "following" && sessionLoading;

  const { data, error, size, setSize, isLoading, isValidating, mutate } = useSWRInfinite<FeedPage>(
    (i, prev: FeedPage | null) => {
      if (blocked || waiting) return null;
      if (i > 0 && !prev?.nextCursor) return null;
      return feedKey(query, PAGE, i === 0 ? null : prev?.nextCursor);
    },
    fetcher,
    { revalidateFirstPage: false, revalidateOnFocus: false },
  );

  const posts: Post[] = (data ?? []).flatMap((p) => p.posts);
  const done = !!data && !data[data.length - 1]?.nextCursor;
  const loadingMore = isValidating && !!data && size > data.length;

  const sentinel = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || done || error) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !isValidating) void setSize((s) => s + 1);
      },
      { rootMargin: "800px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [done, error, isValidating, setSize]);

  const { data: models } = useExploreModels();
  const { data: tags } = useSWR<{ tags: { tag: string; posts: number }[] }>("/api/explore/tags?limit=12", fetcher, { revalidateOnFocus: false });
  const modelName = models?.models.find((m) => m.id === model)?.name ?? model;

  function patch(id: string, change: (p: Post) => Post) {
    void mutate((pages) => pages?.map((pg) => ({ ...pg, posts: pg.posts.map((p) => (p.id === id ? change(p) : p)) })), { revalidate: false });
  }

  async function toggle(post: Post, what: "like" | "save") {
    if (!user) {
      setLoginOpen(true);
      return;
    }
    const on = what === "like" ? !post.viewer?.liked : !post.viewer?.saved;
    const viewer = post.viewer ?? { liked: false, saved: false, followingAuthor: false, isAuthor: false };
    const before = post;
    patch(post.id, (p) =>
      what === "like"
        ? { ...p, viewer: { ...viewer, liked: on }, counts: { ...p.counts, likes: Math.max(0, p.counts.likes + (on ? 1 : -1)) } }
        : { ...p, viewer: { ...viewer, saved: on }, counts: { ...p.counts, saves: Math.max(0, p.counts.saves + (on ? 1 : -1)) } },
    );
    try {
      const res = await api<{ likes?: number; saves?: number }>(`/api/community/posts/${post.id}/${what}`, { method: on ? "POST" : "DELETE" });
      patch(post.id, (p) => ({ ...p, counts: { ...p.counts, likes: res.likes ?? p.counts.likes, saves: res.saves ?? p.counts.saves } }));
      setProblem(null);
    } catch (e) {
      patch(post.id, () => before);
      setProblem(errorMessage(e));
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5 px-4 pt-6 pb-16">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-3xl leading-8 font-bold tracking-[-0.0429em] text-brand uppercase">{exploreWords.title}</h1>
        <p className="text-sm leading-5 text-text-muted">{exploreWords.sub}</p>
      </header>

      <div className="flex flex-col gap-3">
        <div role="toolbar" aria-label="Feed" className="scroll-none -mx-4 flex items-center gap-2 overflow-x-auto px-4">
          {exploreWords.tabs.map((t) => (
            <Pill key={t.id} active={tab === t.id} onClick={() => set({ tab: t.id })}>
              {t.label}
            </Pill>
          ))}
          <span aria-hidden className="mx-1 h-3 w-px shrink-0 bg-border-default" />
          {exploreWords.kinds.map((k) => (
            <Pill key={k.id || "all"} active={kind === k.id} onClick={() => set({ kind: k.id })}>
              {k.label}
            </Pill>
          ))}
          <span aria-hidden className="mx-1 h-3 w-px shrink-0 bg-border-default" />
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={`${exploreWords.modelLabel}: ${model ? modelName : exploreWords.anyModel}`}
                className={cn(
                  "inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-3 text-sm leading-4 font-medium whitespace-nowrap transition-colors duration-150 data-[state=open]:bg-border-default",
                  model ? "bg-border-default text-text-primary" : "bg-border-subtle text-text-tab hover:bg-border-default hover:text-text-primary",
                )}
              >
                {model ? modelName : exploreWords.anyModel}
                <ChevronDown className="size-4" strokeWidth={1.5} aria-hidden />
              </button>
            </PopoverTrigger>
            <PopoverContent look="panel" align="start" className="w-[260px] p-1">
              <div role="menu" aria-label={exploreWords.modelLabel} className="flex max-h-[320px] flex-col overflow-y-auto">
                <PopoverClose asChild>
                  <MenuItem selected={!model} onClick={() => set({ model: "" })}>
                    {exploreWords.anyModel}
                  </MenuItem>
                </PopoverClose>
                {(models?.models ?? []).map((m) => (
                  <PopoverClose key={m.id} asChild>
                    <MenuItem selected={model === m.id} hint={String(m.posts)} onClick={() => set({ model: m.id })}>
                      {m.name}
                    </MenuItem>
                  </PopoverClose>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {tab === "top" && (
          <div role="toolbar" aria-label="Period" className="scroll-none -mx-4 flex items-center gap-2 overflow-x-auto px-4">
            {exploreWords.periods.map((p) => (
              <Pill key={p.id} active={period === p.id} onClick={() => set({ period: p.id })}>
                {period === p.id && <Check className="size-3.5" strokeWidth={1.5} aria-hidden />}
                {p.label}
              </Pill>
            ))}
          </div>
        )}

        {(tag || (tags?.tags.length ?? 0) > 0) && (
          <div role="toolbar" aria-label={exploreWords.tagsLabel} className="scroll-none -mx-4 flex items-center gap-2 overflow-x-auto px-4">
            {tag && (
              <Pill active onClick={() => set({ tag: "" })} label={`${exploreWords.clearTag} ${tag}`}>
                <Hash className="size-3.5" strokeWidth={1.5} aria-hidden />
                {tag}
                <X className="size-3.5" strokeWidth={1.5} aria-hidden />
              </Pill>
            )}
            {(tags?.tags ?? [])
              .filter((t) => t.tag !== tag)
              .map((t) => (
                <Pill key={t.tag} active={false} onClick={() => set({ tag: t.tag })}>
                  <Hash className="size-3.5" strokeWidth={1.5} aria-hidden />
                  {t.tag}
                </Pill>
              ))}
          </div>
        )}
      </div>

      {problem && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-surface-secondary px-4 py-2 text-sm leading-5 text-text-primary">
          <span className="min-w-0">{problem}</span>
          <button type="button" onClick={() => setProblem(null)} aria-label="Dismiss" className="flex size-6 shrink-0 items-center justify-center rounded-md text-text-secondary hover:bg-border-subtle hover:text-text-primary">
            <X className="size-4" strokeWidth={1.5} />
          </button>
        </div>
      )}

      {blocked && !sessionLoading ? (
        <State line={exploreWords.followingSignedOut.line}>
          <button type="button" onClick={() => setLoginOpen(true)} className={LIME}>
            {exploreWords.followingSignedOut.cta}
          </button>
        </State>
      ) : error && posts.length === 0 ? (
        <State line={tileWords.loadError} detail={errorMessage(error)} alert>
          <button type="button" onClick={() => mutate()} className={SOFT}>
            {tileWords.retry}
          </button>
        </State>
      ) : (isLoading || waiting) && posts.length === 0 ? (
        <div aria-busy="true" className="columns-2 gap-2 md:columns-3 lg:columns-4">
          {[405, 304, 228, 405, 152, 304, 405, 228].map((h, i) => (
            <div key={i} style={{ aspectRatio: `344/${h}` }} className="shimmer mb-2 w-full break-inside-avoid rounded-xl bg-surface-secondary" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        tab === "following" ? (
          <State line={exploreWords.followingEmpty.line}>
            <button type="button" onClick={() => set({ tab: "trending" })} className={LIME}>
              {exploreWords.followingEmpty.cta}
            </button>
          </State>
        ) : (
          <State line={exploreWords.empty.line}>
            <Link href={exploreWords.empty.href} className={LIME}>
              {exploreWords.empty.cta}
            </Link>
          </State>
        )
      ) : (
        <>
          <ul aria-label="Community work" className="columns-2 gap-2 md:columns-3 lg:columns-4">
            {posts.map((p) => (
              <li key={p.id} className="mb-2 break-inside-avoid">
                <PostTile post={p} look="masonry" actions={{ onLike: (x) => void toggle(x, "like"), onSave: (x) => void toggle(x, "save") }} />
              </li>
            ))}
          </ul>
          <div ref={sentinel} className="flex h-12 items-center justify-center text-sm leading-5 text-text-secondary">
            {error ? (
              <button type="button" onClick={() => setSize(size)} className={SOFT}>
                {tileWords.retry}
              </button>
            ) : done ? (
              exploreWords.end
            ) : loadingMore ? (
              <span className="flex items-center gap-2">
                <Spinner />
                {exploreWords.loadingMore}
              </span>
            ) : null}
          </div>
        </>
      )}

      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} mode="join" next={routes.explore} />
    </div>
  );
}

const LIME =
  "inline-flex h-10 items-center justify-center rounded-lg bg-brand bg-[linear-gradient(180deg,#FFFF1400_0%,#FFFF14_100%)] px-4 text-sm leading-4 font-semibold text-text-inverse shadow-[inset_0_-3px_0_#829B19] transition-[filter] duration-150 hover:brightness-105";
const SOFT = "inline-flex h-10 items-center justify-center rounded-lg bg-border-subtle px-4 text-sm leading-5 font-semibold text-text-primary transition-colors duration-150 hover:bg-border-default";

function State({ line, detail, alert, children }: { line: string; detail?: string; alert?: boolean; children: React.ReactNode }) {
  return (
    <div role={alert ? "alert" : undefined} className="flex flex-col items-center gap-4 rounded-2xl border border-border-subtle bg-surface-primary px-6 py-16 text-center">
      <p className="max-w-[420px] text-base leading-6 font-medium text-text-primary">{line}</p>
      {detail && <p className="text-sm leading-5 text-text-muted">{detail}</p>}
      {children}
    </div>
  );
}
