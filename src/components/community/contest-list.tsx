"use client";

import Link from "next/link";
import useSWR from "swr";
import { communityWords as w, feedKinds } from "@/content/community";
import { routes } from "@/content/site";
import { fetcher } from "@/lib/api";
import { useNow } from "@/lib/browser";
import { Artwork } from "@/ui";
import { EmptyState, ErrorLine, count } from "./bits";
import { ContestBar, PhaseTag, timeLine } from "./contest-bits";
import type { Contest } from "./types";

/** /contests: every contest, open ones first. */
export function ContestList() {
  const now = useNow();
  const { data, error, isLoading, mutate } = useSWR<{ contests: Contest[] }>("/api/community/contests", fetcher);
  return (
    <div className="flex flex-1 flex-col bg-black">
      <ContestBar />
      <div className="mx-auto flex w-full max-w-[1408px] flex-col gap-8 px-4 pt-10 pb-16 desktop:px-0">
        <div className="flex flex-col gap-2">
          <h1 className="text-chrome font-display text-[40px] leading-[40px] font-bold tracking-[-0.0212em] uppercase md:text-[65.9px] md:leading-[52.7px]">{w.contests.title}</h1>
          <p className="text-base leading-6 font-medium text-text-nav">{w.contests.intro}</p>
        </div>
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3" role="status" aria-label={w.feed.loading}>
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="shimmer h-[360px] rounded-2xl bg-surface-secondary" />
            ))}
          </div>
        ) : error ? (
          <ErrorLine error={error} onRetry={() => mutate()} />
        ) : !data?.contests.length ? (
          <EmptyState text={w.contests.empty} />
        ) : (
          <ul aria-label={w.contests.title} className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.contests.map((c) => (
              <li key={c.id}>
                <Link
                  href={`${routes.contests}/${c.slug}`}
                  className="group flex h-full flex-col overflow-clip rounded-2xl border border-border-subtle bg-surface-primary transition-colors duration-150 hover:bg-surface-secondary"
                >
                  <div className="relative aspect-[16/9] overflow-clip">
                    <Artwork name={`contests/${c.slug}`} className="size-full transition-transform duration-300 group-hover:scale-[1.02]" />
                    <div className="absolute inset-0" style={{ backgroundImage: "linear-gradient(in oklab 180deg, #00000000 39.24%, #131416CC 87.22%)" }} />
                    <PhaseTag phase={c.phase} className="absolute top-3 left-3" />
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <h2 className="text-chrome font-display text-2xl leading-[28px] font-bold tracking-[-0.05em] uppercase">{c.title}</h2>
                    <p className="line-clamp-2 text-sm leading-5 text-text-nav">{c.summary}</p>
                    <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-xs leading-4 text-text-secondary">
                      <span className="text-text-primary">{timeLine(c, now)}</span>
                      <span>
                        {count(c.entries)} {w.contests.entries}
                      </span>
                      <span>{c.kind ? feedKinds.find((k) => k.id === c.kind)?.label : w.contests.anyKind}</span>
                    </div>
                    <p className="text-xs leading-4 text-[#B8B8B8]">
                      {w.contests.prize}: <span className="text-text-primary">{c.prize}</span>
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
