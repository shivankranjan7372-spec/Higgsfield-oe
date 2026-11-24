"use client";

import { Check, Heart, Music } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import useSWRInfinite from "swr/infinite";
import { Logo } from "@/components/brand/logo";
import { communityWords as w, feedKinds } from "@/content/community";
import { routes } from "@/content/site";
import { api, errorMessage, fetcher } from "@/lib/api";
import { useNow, useQueryParam } from "@/lib/browser";
import { useSession } from "@/lib/session";
import { Artwork, Button, ButtonLink, Dialog, DialogContent, Spinner, cn } from "@/ui";
import { Avatar, EmptyState, ErrorLine, count, day, postHref, profileHref, useGate } from "./bits";
import { ContestBar, PhaseTag, chromeButton, timeLine } from "./contest-bits";
import { Pill } from "./feed";
import { Laurel } from "./laurel";
import { PostMedia } from "./post-tile";
import type { Contest, Entry, PostPage } from "./types";

type Tab = "overview" | "rules" | "entries";
const TABS: Tab[] = ["overview", "rules", "entries"];

/** The design's silver title: 90° grey-white-grey over the shared chrome utility. */
const titleGradient = { backgroundImage: "linear-gradient(in oklab 90deg, #616161 1.93%, #FFFFFF 49.62%, #616161 101.17%)" };

function EnterDialog({ contest, open, onOpenChange, onEntered }: { contest: Contest; open: boolean; onOpenChange: (o: boolean) => void; onEntered: (c: Contest) => void }) {
  const { member } = useSession();
  const kind = contest.kind ? `&kind=${contest.kind}` : "";
  const { data, error, isLoading } = useSWR<PostPage>(open && member ? `/api/profiles/${member.handle}/posts?limit=60${kind}` : null, fetcher);
  const [pick, setPick] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  async function enter() {
    if (!pick) return;
    setBusy(true);
    setProblem(null);
    try {
      const r = await api<{ contest: Contest }>(`/api/community/contests/${contest.slug}/entries`, { method: "POST", body: { postId: pick } });
      onEntered(r.contest);
      onOpenChange(false);
    } catch (e) {
      setProblem(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const posts = data?.posts ?? [];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={w.contests.enterTitle} className="max-w-[520px]">
        <div className="flex flex-col gap-4 p-6 pt-4">
          {contest.kind ? (
            <p className="text-xs leading-4 text-text-secondary">
              {w.contests.enterKind} {feedKinds.find((k) => k.id === contest.kind)?.label}
            </p>
          ) : null}
          {isLoading ? (
            <div className="grid grid-cols-3 gap-1" role="status" aria-label={w.feed.loading}>
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="shimmer aspect-square rounded-md bg-surface-tertiary" />
              ))}
            </div>
          ) : error ? (
            <p role="alert" className="text-sm leading-5 text-danger">{errorMessage(error)}</p>
          ) : !posts.length ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm leading-5 text-text-secondary">{w.contests.enterNone}</p>
              <ButtonLink href={`${routes.community}?publish=1`} variant="lime" size="md">
                {w.publish.button}
              </ButtonLink>
            </div>
          ) : (
            <div role="radiogroup" aria-label={w.contests.enterTitle} className="grid max-h-[300px] grid-cols-3 gap-1 overflow-y-auto scroll-quiet">
              {posts.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={pick === p.id}
                  aria-label={p.title || p.id}
                  onClick={() => setPick(p.id)}
                  className={cn("relative aspect-square overflow-clip rounded-md bg-surface-tertiary", pick === p.id ? "ring-2 ring-brand" : "opacity-70 hover:opacity-100")}
                >
                  <PostMedia post={p} className="size-full" />
                </button>
              ))}
            </div>
          )}
          {problem ? <p role="alert" className="text-sm leading-5 text-danger">{problem}</p> : null}
          {posts.length ? (
            <Button variant="lime" size="md" onClick={enter} disabled={!pick || busy}>
              {busy ? <Spinner label={w.contests.enter} /> : null}
              {w.contests.enter}
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EntryCard({ entry: initial, contest, onProblem }: { entry: Entry; contest: Contest; onProblem: (s: string | null) => void }) {
  const gate = useGate();
  const [entry, setEntry] = useState(initial);
  const p = entry.post;
  const mine = contest.viewer?.entryPostId === p.id || !!p.viewer?.isAuthor;
  async function vote() {
    onProblem(null);
    const on = !!entry.viewer?.voted;
    try {
      const r = await gate.run("member", () => api<{ voted: boolean; votes: number }>(`/api/community/contests/${contest.slug}/entries/${p.id}/vote`, { method: on ? "DELETE" : "POST" }));
      if (r) setEntry((e) => ({ ...e, votes: r.votes, viewer: { voted: r.voted } }));
    } catch (e) {
      onProblem(errorMessage(e));
    }
  }
  return (
    <li className="flex flex-col overflow-clip rounded-2xl border border-border-subtle bg-surface-primary" data-entry={p.id}>
      <Link href={postHref(p.id)} className="relative block aspect-[4/3] overflow-clip bg-surface-secondary" aria-label={p.title || `Entry by ${p.author.name}`}>
        {p.kind === "audio" ? (
          <span className="flex size-full items-center justify-center text-text-tab">
            <Music className="size-8" strokeWidth={1.5} aria-hidden />
          </span>
        ) : (
          <PostMedia post={p} className="size-full" />
        )}
        <span className="absolute top-2 left-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-[#000000B3] px-2 font-mono text-xs leading-4 font-semibold text-text-primary backdrop-blur-sm">#{entry.rank}</span>
      </Link>
      <div className="flex items-center gap-2 p-3">
        <Link href={profileHref(p.author.handle)} className="flex min-w-0 flex-1 items-center gap-2 text-sm leading-5 font-medium text-text-primary hover:underline">
          <Avatar author={p.author} size={24} />
          <span className="truncate">{p.author.name || p.author.handle}</span>
        </Link>
        {contest.canVote && !mine ? (
          <button
            type="button"
            onClick={vote}
            aria-pressed={!!entry.viewer?.voted}
            className={cn(
              "flex h-8 shrink-0 items-center gap-1 rounded-md px-3 text-sm leading-4 font-medium transition-colors duration-150",
              entry.viewer?.voted ? "bg-brand-tint text-brand hover:bg-brand-chip" : "bg-border-subtle text-text-primary hover:bg-border-default",
            )}
          >
            {entry.viewer?.voted ? <Check className="size-4" strokeWidth={1.5} aria-hidden /> : <Heart className="size-4" strokeWidth={1.5} aria-hidden />}
            {entry.viewer?.voted ? w.contests.voted : w.contests.vote}
            <span className="text-text-tab">{count(entry.votes)}</span>
          </button>
        ) : (
          <span className="shrink-0 text-xs leading-4 text-text-secondary">
            {count(entry.votes)} {w.contests.votes}
          </span>
        )}
      </div>
      {gate.dialog}
    </li>
  );
}

function Entries({ contest }: { contest: Contest }) {
  const [sort, setSort] = useState<"top" | "new">("top");
  const [problem, setProblem] = useState<string | null>(null);
  const base = `/api/community/contests/${contest.slug}/entries?sort=${sort}&limit=24`;
  const r = useSWRInfinite<{ entries: Entry[]; nextCursor: string | null }>(
    (i, prev: { nextCursor: string | null } | null) => (i === 0 ? base : prev?.nextCursor ? `${base}&cursor=${encodeURIComponent(prev.nextCursor)}` : null),
    fetcher,
  );
  const entries = (r.data ?? []).flatMap((p) => p.entries);
  const more = !!r.data?.[r.data.length - 1]?.nextCursor;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1">
        <Pill on={sort === "top"} onClick={() => setSort("top")}>
          {w.contests.sortTop}
        </Pill>
        <Pill on={sort === "new"} onClick={() => setSort("new")}>
          {w.contests.sortNew}
        </Pill>
      </div>
      {problem ? <p role="alert" className="text-sm leading-5 text-danger">{problem}</p> : null}
      {r.isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" role="status" aria-label={w.feed.loading}>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="shimmer aspect-[4/3.6] rounded-2xl bg-surface-secondary" />
          ))}
        </div>
      ) : r.error ? (
        <ErrorLine error={r.error} onRetry={() => r.mutate()} />
      ) : !entries.length ? (
        <EmptyState text={w.contests.noEntries} />
      ) : (
        <ul aria-label={w.contests.tabs.entries} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {entries.map((e) => (
            <EntryCard key={`${sort}:${e.post.id}`} entry={e} contest={contest} onProblem={setProblem} />
          ))}
        </ul>
      )}
      {more ? (
        <Button variant="outline" size="sm" className="self-center" onClick={() => r.setSize(r.size + 1)}>
          {w.feed.more}
        </Button>
      ) : null}
    </div>
  );
}

function Loaded({ initial }: { initial: Contest }) {
  const now = useNow();
  const q = useQueryParam("tab");
  const gate = useGate();
  const [contest, setContest] = useState(initial);
  const [tab, setTab] = useState<Tab | null>(null);
  const [entering, setEntering] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const current: Tab = tab ?? (TABS.includes(q as Tab) ? (q as Tab) : "overview");
  const c = contest;

  function pick(t: Tab) {
    setTab(t);
    window.history.replaceState(null, "", t === "overview" ? window.location.pathname : `?tab=${t}`);
  }
  async function reload() {
    const r = await api<{ contest: Contest }>(`/api/community/contests/${c.slug}`).catch(() => null);
    if (r) setContest(r.contest);
    setRound((n) => n + 1);
  }
  async function withdraw() {
    if (!c.viewer?.entryPostId) return;
    setProblem(null);
    try {
      await api(`/api/community/contests/${c.slug}/entries/${c.viewer.entryPostId}`, { method: "DELETE" });
      await reload();
    } catch (e) {
      setProblem(errorMessage(e));
    }
  }
  async function enter() {
    setProblem(null);
    await gate.run("member", async () => setEntering(true));
  }

  const entered = !!c.viewer?.entryPostId;
  const dates = [
    { label: w.contests.opens, at: c.opensAt },
    { label: w.contests.closes, at: c.closesAt },
    { label: w.contests.ends, at: c.endsAt },
  ];

  return (
    <>
      <ContestBar
        crumb={c.title}
        tabs={
          <div role="tablist" aria-label={c.title} className="scroll-none flex h-[44px] items-center gap-4 overflow-x-auto md:h-[52px]">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={current === t}
                onClick={() => pick(t)}
                className={cn(
                  "flex h-full shrink-0 items-center border-b-2 pt-[2px] text-sm leading-5 font-medium transition-colors duration-150",
                  current === t ? "border-text-primary text-text-primary" : "border-transparent text-text-tab hover:text-text-primary",
                )}
              >
                {w.contests.tabs[t]}
                {t === "entries" ? <span className="ml-1 text-text-tertiary">{count(c.entries)}</span> : null}
              </button>
            ))}
          </div>
        }
      />
      <section aria-label={c.title} className="relative flex flex-col items-center overflow-clip px-4 pb-10 desktop:h-[852px] desktop:px-0 desktop:pb-0">
        <div className="relative mt-4 aspect-[1159/534] w-full max-w-[1159px] desktop:absolute desktop:top-[46px] desktop:left-1/2 desktop:mt-0 desktop:h-[534px] desktop:w-[1159px] desktop:-translate-x-1/2">
          <Artwork name={`contests/${c.slug}`} className="size-full" />
          <div className="absolute inset-x-0 bottom-0 h-[73%]" style={{ backgroundImage: "linear-gradient(in oklab 180deg, #00000000 0%, #00000008 20%, #00000014 30%, #00000030 40%, #00000075 50%, #000000AD 60%, #000000CF 70%, #000000E3 80%, #000000F5 90%, #000000 100%)" }} />
          <PhaseTag phase={c.phase} className="absolute top-3 left-3" />
        </div>
        <div className="relative -mt-10 flex w-full max-w-[634px] flex-col items-center desktop:absolute desktop:top-[588px] desktop:left-1/2 desktop:mt-0 desktop:h-[120px] desktop:-translate-x-1/2">
          <div className="flex h-[30px] items-center">
            <Logo size={22} />
          </div>
          <div className="flex w-full items-center justify-center md:h-[90px]">
            <Laurel className="hidden h-[90px] w-[62px] shrink-0 md:block" />
            <div className="flex min-w-0 flex-1 items-center justify-center md:h-[66px] md:w-[510px] md:flex-none">
              <h1
                className="text-chrome text-center font-display text-[40px] leading-[40px] font-bold tracking-[-0.0212em] uppercase md:truncate md:text-[65.9px] md:leading-[52.7px] md:whitespace-nowrap"
                style={titleGradient}
              >
                {c.title}
              </h1>
            </div>
            <Laurel side="right" className="hidden h-[90px] w-[62px] shrink-0 md:block" />
          </div>
        </div>
        <div className="relative mt-6 flex w-full max-w-[640px] flex-col items-center gap-[25px] md:flex-row md:justify-center desktop:absolute desktop:top-[724px] desktop:left-1/2 desktop:mt-0 desktop:-translate-x-1/2">
          <div className="flex w-full min-w-0 flex-col text-center text-base leading-6 font-medium md:w-auto md:max-w-[360px] md:text-right">
            <p className="truncate" title={c.prize}>
              <span className="text-[#B8B8B8]">{w.contests.prize} </span>
              <span className="text-text-primary">{c.prize}</span>
            </p>
            <p className="truncate text-text-primary">{timeLine(c, now)}</p>
          </div>
          {c.canEnter && !entered ? (
            <button type="button" className={cn(chromeButton, "w-[218px] shrink-0")} onClick={enter}>
              {w.contests.enter}
            </button>
          ) : entered ? (
            <div className="flex shrink-0 items-center gap-2">
              <Link href={postHref(c.viewer!.entryPostId!)} className={cn(chromeButton, "w-[218px]")}>
                <Check className="mr-1 size-5" strokeWidth={1.5} aria-hidden />
                {w.contests.entered}
              </Link>
              {c.phase === "open" ? (
                <Button variant="outline" size="md" onClick={withdraw}>
                  {w.contests.withdraw}
                </Button>
              ) : null}
            </div>
          ) : c.canVote || c.phase === "ended" ? (
            <button type="button" className={cn(chromeButton, "w-[218px] shrink-0")} onClick={() => pick("entries")}>
              {c.phase === "ended" ? w.contests.sortTop : w.contests.vote}
            </button>
          ) : null}
        </div>
        {problem ? <p role="alert" className="relative mt-4 text-sm leading-5 text-danger desktop:absolute desktop:top-[790px]">{problem}</p> : null}
      </section>
      <div className="mx-auto w-full max-w-[1408px] px-4 pb-16 desktop:px-0">
        {current === "overview" ? (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
            <div className="flex flex-col gap-4">
              <p className="text-xl leading-7 font-semibold text-text-primary">{c.summary}</p>
              <h2 className="font-display text-2xl leading-[28px] font-bold tracking-[-0.05em] text-text-tab uppercase">{w.contests.brief}</h2>
              <p className="text-base leading-6 whitespace-pre-wrap text-text-nav">{c.brief}</p>
            </div>
            <dl className="flex flex-col gap-3 self-start rounded-2xl border border-border-subtle bg-surface-primary p-5 text-sm leading-5">
              <div className="flex flex-col gap-1">
                <dt className="text-text-secondary">{w.contests.prize}</dt>
                <dd className="text-text-primary">{c.prize}</dd>
              </div>
              {dates.map((d) => (
                <div key={d.label} className="flex justify-between gap-4">
                  <dt className="text-text-secondary">{d.label}</dt>
                  <dd className="text-text-primary">{day(d.at)}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-4">
                <dt className="text-text-secondary">{w.contests.tabs.entries}</dt>
                <dd className="text-text-primary">{count(c.entries)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-text-secondary">{w.post.model}</dt>
                <dd className="text-text-primary">{c.kind ? feedKinds.find((k) => k.id === c.kind)?.label : w.contests.anyKind}</dd>
              </div>
            </dl>
          </div>
        ) : current === "rules" ? (
          <ol className="flex max-w-[800px] list-decimal flex-col gap-3 pl-6 text-base leading-6 text-text-nav marker:text-text-tertiary">
            {c.rules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ol>
        ) : (
          <Entries key={round} contest={c} />
        )}
      </div>
      <EnterDialog
        contest={c}
        open={entering}
        onOpenChange={setEntering}
        onEntered={(next) => {
          setContest(next);
          setRound((n) => n + 1);
        }}
      />
      {gate.dialog}
    </>
  );
}

/** /contests/[slug]: one contest. */
export function ContestView({ slug }: { slug: string }) {
  const { data, error, isLoading, mutate } = useSWR<{ contest: Contest }>(`/api/community/contests/${encodeURIComponent(slug)}`, fetcher, { revalidateOnFocus: false });
  return (
    <div className="flex flex-1 flex-col bg-black">
      {isLoading ? (
        <>
          <ContestBar crumb="…" />
          <div className="flex flex-col items-center gap-6 px-4 pt-[46px]" role="status" aria-label={w.feed.loading}>
            <div className="shimmer aspect-[1159/534] w-full max-w-[1159px] bg-surface-secondary" />
            <div className="shimmer h-[52px] w-full max-w-[510px] rounded-md bg-surface-secondary" />
          </div>
        </>
      ) : data ? (
        <Loaded key={data.contest.id} initial={data.contest} />
      ) : (
        <>
          <ContestBar crumb={slug} />
          <div className="mx-auto w-full max-w-[1408px] px-4 py-10 desktop:px-0">
            {error && (error as { status?: number }).status === 404 ? (
              <EmptyState
                text={w.contests.notFound}
                action={
                  <ButtonLink href={routes.contests} variant="white" size="pill">
                    {w.contests.title}
                  </ButtonLink>
                }
              />
            ) : (
              <ErrorLine error={error} onRetry={() => mutate()} />
            )}
          </div>
        </>
      )}
    </div>
  );
}
