"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { communityWords as w, communityViews, type CommunityView } from "@/content/community";
import { routes } from "@/content/site";
import { useQueryParam } from "@/lib/browser";
import { useSession } from "@/lib/session";
import { Button, ButtonLink } from "@/ui";
import { Avatar, EmptyState, profileHref } from "./bits";
import { Featured } from "./featured";
import { FeedEmpty, FeedFilterBar, PagedGrid, SectionHeading, feedUrl, usePagedPosts, type FeedFilters } from "./feed";
import { PublishDialog } from "./publish-dialog";
import { CommunitySubNav, viewHref } from "./sub-nav";
import type { Author } from "./types";

const START: FeedFilters = { tab: "trending", period: "week", kind: null, model: null, tag: null };

function isView(v: string | null): v is CommunityView {
  return communityViews.some((c) => c.view === v);
}

function ShareButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="white" size="pill" onClick={onClick} className="gap-1">
      <Plus className="size-4" strokeWidth={1.5} aria-hidden />
      {w.publish.button}
    </Button>
  );
}

function SignInInvite({ text, view }: { text: string; view: CommunityView }) {
  return (
    <EmptyState
      text={text}
      action={
        <ButtonLink href={`${routes.join}?next=${encodeURIComponent(viewHref(view))}`} variant="lime" size="md">
          {w.createAccount}
        </ButtonLink>
      }
    />
  );
}

function Discover({ onPublish }: { onPublish: () => void }) {
  const [f, setF] = useState<FeedFilters>(START);
  const list = usePagedPosts(feedUrl(f));
  const filtered = !!(f.kind || f.model || f.tag);
  return (
    <>
      <Featured onPublish={onPublish} />
      <section aria-label={w.feed.heading} className="mx-auto flex w-full max-w-[1376px] flex-col gap-6 px-4 pt-[40px] pb-16 desktop:px-0">
        <SectionHeading slot="community/feed-mark" extra={<ShareButton onClick={onPublish} />}>
          {w.feed.heading}
        </SectionHeading>
        <FeedFilterBar f={f} set={(patch) => setF((old) => ({ ...old, ...patch }))} />
        <PagedGrid list={list} label={w.feed.heading} empty={<FeedEmpty filtered={filtered} onClear={() => setF((o) => ({ ...START, tab: o.tab }))} action={<ShareButton onClick={onPublish} />} />} />
      </section>
    </>
  );
}

function Following({ onPublish }: { onPublish: () => void }) {
  const { user, loading } = useSession();
  const list = usePagedPosts(user ? feedUrl(START, "following") : null);
  return (
    <section aria-label={w.feed.followingHeading} className="mx-auto flex w-full max-w-[1376px] flex-col gap-6 px-4 pt-[40px] pb-16 desktop:px-0">
      <SectionHeading slot="community/following-mark" extra={<ShareButton onClick={onPublish} />}>
        {w.feed.followingHeading}
      </SectionHeading>
      {!user && !loading ? (
        <SignInInvite text={w.feed.signInFollowing} view="following" />
      ) : (
        <PagedGrid
          list={list}
          label={w.feed.followingHeading}
          empty={<EmptyState text={w.feed.emptyFollowing} action={<Link href={viewHref("creators")} className="text-sm leading-5 font-semibold text-brand hover:underline">{communityViews[3].label}</Link>} />}
        />
      )}
    </section>
  );
}

function Saved() {
  const { user, loading } = useSession();
  const list = usePagedPosts(user ? "/api/community/saved?limit=24" : null);
  return (
    <section aria-label={w.feed.savedHeading} className="mx-auto flex w-full max-w-[1376px] flex-col gap-6 px-4 pt-[40px] pb-16 desktop:px-0">
      <SectionHeading slot="community/saved-mark">{w.feed.savedHeading}</SectionHeading>
      {!user && !loading ? <SignInInvite text={w.feed.signInSaved} view="saved" /> : <PagedGrid list={list} label={w.feed.savedHeading} empty={<EmptyState text={w.feed.emptySaved} />} />}
    </section>
  );
}

/** Creators: the people behind the most talked-about posts right now. */
function Creators() {
  const list = usePagedPosts("/api/explore?tab=trending&limit=60");
  const people = useMemo(() => {
    const seen = new Map<string, { author: Author; posts: number }>();
    for (const p of list.posts) {
      const e = seen.get(p.author.id);
      if (e) e.posts++;
      else seen.set(p.author.id, { author: p.author, posts: 1 });
    }
    return [...seen.values()];
  }, [list.posts]);
  return (
    <section aria-label={w.feed.creatorsHeading} className="mx-auto flex w-full max-w-[1376px] flex-col gap-6 px-4 pt-[40px] pb-16 desktop:px-0">
      <SectionHeading slot="community/creators-mark">{w.feed.creatorsHeading}</SectionHeading>
      {list.first ? (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 desktop:grid-cols-6" role="status" aria-label={w.feed.loading}>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="shimmer h-[148px] rounded-2xl bg-surface-secondary" />
          ))}
        </div>
      ) : people.length ? (
        <ul aria-label={w.feed.creatorsHeading} className="grid grid-cols-2 gap-2 md:grid-cols-4 desktop:grid-cols-6">
          {people.map(({ author }) => (
            <li key={author.id}>
              <Link href={profileHref(author.handle)} className="flex flex-col items-center gap-3 rounded-2xl bg-surface-secondary px-4 py-6 text-center transition-colors duration-150 hover:bg-surface-secondary-strong">
                <Avatar author={author} size={56} />
                <span className="flex w-full min-w-0 flex-col">
                  <span className="truncate text-sm leading-5 font-semibold text-text-primary">{author.name || author.handle}</span>
                  <span className="truncate text-xs leading-4 text-text-secondary">@{author.handle}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState text={w.feed.emptyCreators} />
      )}
    </section>
  );
}

/** /community: the sub-nav, then the view picked in it. */
export function CommunityPage() {
  const q = useQueryParam("view");
  const [view, setView] = useState<CommunityView | null>(null);
  const [publishChoice, setPublishing] = useState<boolean | null>(null);
  const current: CommunityView = view ?? (isView(q) ? q : "discover");
  const wantsPublish = useQueryParam("publish") === "1";
  const publishing = publishChoice ?? wantsPublish;
  useEffect(() => {
    const onPop = () => setView(null);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  function pick(v: CommunityView) {
    setView(v);
    window.history.pushState(null, "", viewHref(v));
    window.scrollTo({ top: 0 });
  }
  const open = () => setPublishing(true);

  return (
    <div className="flex flex-1 flex-col bg-black">
      <CommunitySubNav active={current} onPick={pick} />
      {current === "following" ? <Following onPublish={open} /> : current === "saved" ? <Saved /> : current === "creators" ? <Creators /> : <Discover onPublish={open} />}
      <PublishDialog open={publishing} onOpenChange={setPublishing} />
    </div>
  );
}
