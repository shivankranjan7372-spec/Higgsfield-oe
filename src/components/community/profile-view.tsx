"use client";

import { EyeOff } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import useSWRInfinite from "swr/infinite";
import { communityWords as w } from "@/content/community";
import { routes } from "@/content/site";
import { api, errorMessage, fetcher } from "@/lib/api";
import { Artwork, Button, ButtonLink, cn } from "@/ui";
import { Avatar, EmptyState, ErrorLine, count, day, profileHref, useGate } from "./bits";
import { PagedGrid, Pill, usePagedPosts } from "./feed";
import { CommunitySubNav } from "./sub-nav";
import type { Author, Profile } from "./types";

type Tab = "posts" | "followers" | "following";

function Members({ handle, which }: { handle: string; which: "followers" | "following" }) {
  const base = `/api/profiles/${encodeURIComponent(handle)}/${which}?limit=60`;
  const r = useSWRInfinite<{ members: Author[]; nextCursor: string | null }>(
    (i, prev: { nextCursor: string | null } | null) => (i === 0 ? base : prev?.nextCursor ? `${base}&cursor=${encodeURIComponent(prev.nextCursor)}` : null),
    fetcher,
  );
  const members = (r.data ?? []).flatMap((p) => p.members);
  const more = !!r.data?.[r.data.length - 1]?.nextCursor;
  if (r.isLoading)
    return (
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3" role="status" aria-label={w.feed.loading}>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="shimmer h-16 rounded-2xl bg-surface-secondary" />
        ))}
      </div>
    );
  if (r.error) return <ErrorLine error={r.error} onRetry={() => r.mutate()} />;
  if (!members.length) return <EmptyState text={w.profile.emptyMembers} />;
  return (
    <div className="flex flex-col gap-4">
      <ul aria-label={which === "followers" ? w.profile.followers : w.profile.following} className="grid grid-cols-1 gap-2 md:grid-cols-3 desktop:grid-cols-4">
        {members.map((m) => (
          <li key={m.id}>
            <Link href={profileHref(m.handle)} className="flex items-center gap-3 rounded-2xl bg-surface-secondary p-3 transition-colors duration-150 hover:bg-surface-secondary-strong">
              <Avatar author={m} size={40} />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm leading-5 font-semibold text-text-primary">{m.name || m.handle}</span>
                <span className="truncate text-xs leading-4 text-text-secondary">@{m.handle}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {more ? (
        <Button variant="outline" size="sm" className="self-center" onClick={() => r.setSize(r.size + 1)}>
          {w.feed.more}
        </Button>
      ) : null}
    </div>
  );
}

function Loaded({ initial }: { initial: Profile }) {
  const gate = useGate();
  const [p, setP] = useState(initial);
  const [tab, setTab] = useState<Tab>("posts");
  const [sort, setSort] = useState<"new" | "top">("new");
  const [problem, setProblem] = useState<string | null>(null);
  const list = usePagedPosts(tab === "posts" ? `/api/profiles/${encodeURIComponent(p.handle)}/posts?sort=${sort}&limit=24` : null);
  const self = !!p.viewer?.isSelf;

  async function follow() {
    setProblem(null);
    const on = !!p.viewer?.following;
    try {
      const r = await gate.run("member", () => api<{ following: boolean; followers: number }>(`/api/profiles/${p.handle}/follow`, { method: on ? "DELETE" : "POST" }));
      if (r) setP((x) => ({ ...x, counts: { ...x.counts, followers: r.followers }, viewer: x.viewer ? { ...x.viewer, following: r.following } : x.viewer }));
    } catch (e) {
      setProblem(errorMessage(e));
    }
  }
  async function hide() {
    setProblem(null);
    const on = !!p.viewer?.hidden;
    try {
      const r = await gate.run("session", () => api<{ hidden: boolean }>(`/api/profiles/${p.handle}/hide`, { method: on ? "DELETE" : "POST" }));
      if (r)
        setP((x) => ({
          ...x,
          viewer: { isSelf: false, following: x.viewer?.following ?? false, followsYou: x.viewer?.followsYou ?? false, hidden: r.hidden },
        }));
    } catch (e) {
      setProblem(errorMessage(e));
    }
  }

  const stats: { id: Tab | "likes"; label: string; n: number }[] = [
    { id: "posts", label: w.profile.posts, n: p.counts.posts },
    { id: "followers", label: w.profile.followers, n: p.counts.followers },
    { id: "following", label: w.profile.following, n: p.counts.following },
    { id: "likes", label: w.profile.likes, n: p.counts.likes },
  ];

  return (
    <>
      <section className="relative overflow-clip">
        <Artwork name="community/profile-cover" className="absolute inset-0 size-full opacity-60" />
        <div className="absolute inset-0" style={{ backgroundImage: "linear-gradient(in oklab 180deg, #00000000 0%, #000000 100%)" }} />
        <div className="relative mx-auto flex w-full max-w-[1376px] flex-col gap-4 px-4 pt-16 pb-8 md:flex-row md:items-end md:justify-between desktop:px-0">
          <div className="flex min-w-0 items-end gap-4">
            <Avatar author={p} size={88} className="border border-[#FFFFFF26]" />
            <div className="flex min-w-0 flex-col gap-1">
              <h1 className="truncate text-[32px] leading-[36px] font-bold tracking-[-0.0375em] text-text-primary">{p.name || p.handle}</h1>
              <p className="flex flex-wrap items-center gap-2 text-sm leading-5 text-text-secondary">
                <span>@{p.handle}</span>
                {p.viewer?.followsYou ? <span className="rounded-full bg-border-default px-2 text-xs leading-5 text-text-primary">{w.profile.followsYou}</span> : null}
                <span>
                  · {w.profile.joined} {day(p.joinedAt)}
                </span>
              </p>
              {p.bio ? <p className="max-w-[560px] text-sm leading-5 text-text-nav">{p.bio}</p> : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {self ? (
              <span className="text-sm leading-5 text-text-tab">{w.profile.you}</span>
            ) : (
              <>
                <Button variant={p.viewer?.following ? "outline" : "white"} size="md" onClick={follow}>
                  {p.viewer?.following ? w.profile.unfollow : w.profile.follow}
                </Button>
                <Button variant="soft" size="md" onClick={hide} aria-pressed={!!p.viewer?.hidden}>
                  <EyeOff className="size-4" strokeWidth={1.5} aria-hidden />
                  {p.viewer?.hidden ? w.profile.unhide : w.profile.hide}
                </Button>
              </>
            )}
          </div>
        </div>
      </section>
      <div className="mx-auto flex w-full max-w-[1376px] flex-col gap-6 px-4 pb-16 desktop:px-0">
        {problem ? <p role="alert" className="text-sm leading-5 text-danger">{problem}</p> : null}
        {p.viewer?.hidden ? <p className="text-sm leading-5 text-text-tab">{w.profile.hiddenNote}</p> : null}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle">
          <div role="tablist" aria-label={p.name} className="scroll-none -mb-px flex gap-6 overflow-x-auto">
            {stats.map((s) =>
              s.id === "likes" ? (
                <span key={s.id} className="flex h-[52px] shrink-0 items-center gap-1 text-sm leading-5 font-medium text-text-idle">
                  <span className="text-text-primary">{count(s.n)}</span> {s.label}
                </span>
              ) : (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === s.id}
                  onClick={() => setTab(s.id as Tab)}
                  className={cn(
                    "flex h-[52px] shrink-0 items-center gap-1 border-b-2 text-sm leading-5 font-medium transition-colors duration-150",
                    tab === s.id ? "border-text-primary text-text-primary" : "border-transparent text-text-idle hover:text-text-tab",
                  )}
                >
                  <span className={tab === s.id ? "" : "text-text-tab"}>{count(s.n)}</span> {s.label}
                </button>
              ),
            )}
          </div>
          {tab === "posts" ? (
            <div className="flex gap-1 pb-2">
              <Pill on={sort === "new"} onClick={() => setSort("new")}>
                {w.profile.sortNew}
              </Pill>
              <Pill on={sort === "top"} onClick={() => setSort("top")}>
                {w.profile.sortTop}
              </Pill>
            </div>
          ) : null}
        </div>
        {tab === "posts" ? (
          <PagedGrid
            list={list}
            label={`${w.profile.posts}: ${p.name}`}
            hideAuthor
            empty={
              <EmptyState
                text={w.profile.empty}
                action={
                  self ? (
                    <ButtonLink href={`${routes.community}?publish=1`} variant="white" size="pill">
                      {w.publish.button}
                    </ButtonLink>
                  ) : undefined
                }
              />
            }
          />
        ) : (
          <Members key={tab} handle={p.handle} which={tab} />
        )}
      </div>
      {gate.dialog}
    </>
  );
}

/** /u/[handle]: a member's public page. */
export function ProfileView({ handle }: { handle: string }) {
  const { data, error, isLoading, mutate } = useSWR<{ profile: Profile }>(`/api/profiles/${encodeURIComponent(handle)}`, fetcher, { revalidateOnFocus: false });
  return (
    <div className="flex flex-1 flex-col bg-black">
      <CommunitySubNav active="creators" />
      {isLoading ? (
        <div className="mx-auto flex w-full max-w-[1376px] items-end gap-4 px-4 pt-16 pb-8 desktop:px-0" role="status" aria-label={w.feed.loading}>
          <div className="shimmer size-[88px] rounded-full bg-surface-secondary" />
          <div className="flex flex-col gap-2">
            <div className="shimmer h-8 w-48 rounded-md bg-surface-secondary" />
            <div className="shimmer h-4 w-32 rounded-md bg-surface-secondary" />
          </div>
        </div>
      ) : data ? (
        <Loaded key={data.profile.id} initial={data.profile} />
      ) : (
        <div className="mx-auto w-full max-w-[1376px] px-4 py-10 desktop:px-0">
          {error && (error as { status?: number }).status === 404 ? (
            <EmptyState
              text={w.profile.notFound}
              action={
                <ButtonLink href={routes.community} variant="white" size="pill">
                  {w.post.toCommunity}
                </ButtonLink>
              }
            />
          ) : (
            <ErrorLine error={error} onRetry={() => mutate()} />
          )}
        </div>
      )}
    </div>
  );
}
