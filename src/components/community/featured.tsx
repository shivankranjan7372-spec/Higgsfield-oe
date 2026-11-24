"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { communityWords as w } from "@/content/community";
import { fetcher } from "@/lib/api";
import { Artwork, cn } from "@/ui";
import { Avatar, ErrorLine, postHref, profileHref } from "./bits";
import { PostMedia } from "./post-tile";
import type { Post, PostPage } from "./types";

const card = "overflow-clip border border-[#FFFFFF26] bg-black [box-shadow:#0000008C_0px_24px_64px]";

/** A side card behind the main one: a post's still, or a picture slot when there is none. */
function Side({ post, slot, className, fade }: { post?: Post; slot: string; className: string; fade: string }) {
  return (
    <div aria-hidden className={cn("absolute hidden desktop:block", card, className)}>
      {post ? <PostMedia post={post} className="size-full" /> : <Artwork name={slot} className="size-full" />}
      <div className="absolute inset-0" style={{ backgroundImage: fade }} />
    </div>
  );
}

/**
 * The featured carousel: the week's most liked posts, one large card with the neighbours
 * tucked behind it, and a row of pills to pick between them.
 */
export function Featured({ onPublish }: { onPublish: () => void }) {
  const { data, error, isLoading, mutate } = useSWR<PostPage>("/api/explore?tab=trending&limit=3", fetcher);
  const [pick, setPick] = useState(0);
  const posts = data?.posts ?? [];
  const n = posts.length;
  const i = n ? pick % n : 0;
  const main = posts[i];
  const prev = n > 1 ? posts[(i + n - 1) % n] : undefined;
  const next = n > 2 ? posts[(i + 1) % n] : n === 2 ? posts[(i + 1) % n] : undefined;

  return (
    <section aria-label={w.featured.label} className="relative overflow-clip px-4 pt-6 pb-8 desktop:h-[720px] desktop:px-8 desktop:pt-[40px] desktop:pb-0">
      <div className="relative mx-auto w-full max-w-[1022px] desktop:h-[576px]">
        <Side post={prev} slot="community/featured-left" className="top-[75px] left-[-140px] h-[426px] w-[755px] rounded-[28.673px] opacity-[0.89]" fade="linear-gradient(in oklab 90deg, #00000066 0%, #000000 33.65%)" />
        <Side post={next} slot="community/featured-right" className="top-[82px] left-[453px] h-[412px] w-[732px] rounded-[29.685px] opacity-[0.885553]" fade="linear-gradient(in oklab 90deg, #000000 67.74%, #000000C2 100%)" />
        <div className={cn("relative aspect-[1006/567] w-full rounded-[13.012px] desktop:absolute desktop:top-[5px] desktop:left-6 desktop:h-[567px] desktop:w-[1006px]", card)}>
          {isLoading ? <div className="shimmer size-full bg-surface-secondary" role="status" aria-label={w.feed.loading} /> : main ? <PostMedia key={main.id} post={main} playing className="size-full" /> : <Artwork name="community/featured" className="size-full" />}
          {!isLoading ? (
            <div className="absolute inset-x-0 bottom-0 flex flex-col items-center justify-center gap-3 px-4 pt-10 pb-4 md:gap-[23px] desktop:h-[260px] desktop:p-0" style={{ backgroundImage: "linear-gradient(in oklab 180deg, #00000000 0%, #000000C4 84.59%)" }}>
              <div className="flex w-full max-w-[591px] flex-col items-center gap-3 text-center">
                <h2 className="line-clamp-1 max-w-full text-xl leading-6 font-bold tracking-[-0.0375em] text-text-primary md:text-[32px] md:leading-[36px]">
                  {main ? main.title || w.featured.label : w.featured.emptyTitle}
                </h2>
                <p className="line-clamp-2 hidden w-full max-w-[472px] text-sm leading-5 font-medium text-[#FFFFFF80] md:block">
                  {main ? main.description || main.prompt || "" : w.featured.emptyBody}
                </p>
              </div>
              <div className="flex items-center gap-[23px]">
                {main ? (
                  <Link
                    href={postHref(main.id)}
                    className="flex h-[39px] items-center justify-center gap-1 rounded-lg bg-text-primary px-4 text-sm leading-4 font-semibold text-text-inverse [box-shadow:#00000052_0px_-3px_0px_inset,#00000040_0px_6px_4px,#00000026_0px_32px_24px] transition-colors duration-150 hover:bg-text-soft desktop:w-[172px]"
                  >
                    <ArrowUpRight className="size-5" strokeWidth={1.5} aria-hidden />
                    {w.featured.open}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={onPublish}
                    className="flex h-[39px] items-center justify-center rounded-lg bg-text-primary px-4 text-sm leading-4 font-semibold text-text-inverse [box-shadow:#00000052_0px_-3px_0px_inset,#00000040_0px_6px_4px,#00000026_0px_32px_24px] transition-colors duration-150 hover:bg-text-soft"
                  >
                    {w.publish.button}
                  </button>
                )}
                {main ? (
                  <Link href={profileHref(main.author.handle)} className="group/by flex min-w-0 items-center gap-[13px]">
                    <Avatar author={main.author} size={31} />
                    <span className="flex min-w-0 flex-col gap-px">
                      <span className="text-xs leading-4 font-medium text-text-idle">{w.featured.by}</span>
                      <span className="max-w-[160px] truncate text-base leading-5 font-medium text-text-primary group-hover/by:underline">{main.author.name || main.author.handle}</span>
                    </span>
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
      {error ? <ErrorLine error={error} onRetry={() => mutate()} className="mt-4 justify-center" /> : null}
      {n > 1 ? (
        <div role="tablist" aria-label={w.featured.picker} className="scroll-none mx-auto mt-6 flex max-w-full items-center gap-6 overflow-x-auto desktop:absolute desktop:top-[648px] desktop:left-1/2 desktop:mt-0 desktop:-translate-x-1/2 desktop:justify-center">
          {posts.map((p, k) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={k === i}
              onClick={() => setPick(k)}
              className={cn(
                "flex h-8 shrink-0 items-center justify-center gap-1 rounded-full px-[14px] transition-[background-color,opacity] duration-150",
                k === i ? "bg-border-default" : "opacity-30 hover:opacity-60",
              )}
            >
              <Avatar author={p.author} size={20} />
              <span className="max-w-[180px] truncate text-sm leading-4 font-medium text-text-primary uppercase">{p.title || p.author.name}</span>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
