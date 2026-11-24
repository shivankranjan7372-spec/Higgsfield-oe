"use client";

import { AudioLines, Bookmark, Eye, Heart, Play } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { tileWords } from "@/content/home";
import { routes } from "@/content/site";
import { cn } from "@/ui";
import { aspectOf, initials, shortCount, stillOf, type Author, type Post } from "./feed";

export type TileLook = "shorts" | "mosaic" | "wide" | "masonry";

/** A member's face, or their initials when there is no picture or it does not load. */
export function Avatar({ author, size = 24, className }: { author: Author; size?: number; className?: string }) {
  const [broken, setBroken] = useState(false);
  const style = { width: size, height: size };
  if (author.avatarUrl && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={author.avatarUrl} alt="" style={style} onError={() => setBroken(true)} className={cn("shrink-0 rounded-full object-cover", className)} />
    );
  }
  return (
    <span
      aria-hidden
      style={{ ...style, fontSize: Math.max(9, Math.round(size * 0.4)) }}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-surface-elevated leading-none font-semibold text-text-primary", className)}
    >
      {initials(author.name)}
    </span>
  );
}

/** The picture, the silent video, or the audio card of a post, filling its box. */
function TileMedia({ post, videoRef }: { post: Post; videoRef: React.RefObject<HTMLVideoElement | null> }) {
  const still = stillOf(post);
  if (post.kind === "video") {
    return (
      <video
        ref={videoRef}
        src={`${post.media.url}${still ? "" : "#t=0.1"}`}
        poster={still ?? undefined}
        muted
        loop
        playsInline
        preload={still ? "none" : "metadata"}
        aria-hidden
        className="absolute inset-0 size-full object-cover"
      />
    );
  }
  if (post.kind === "audio") {
    return (
      <div aria-hidden className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(120%_90%_at_30%_20%,#D1FE1726,transparent_62%),linear-gradient(140deg,#23262A,#131416)]">
        <AudioLines className="size-10 text-brand" strokeWidth={1.5} />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={still ?? post.media.url} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
  );
}

export interface TileActions {
  onLike: (post: Post) => void;
  onSave: (post: Post) => void;
}

const SHAPE: Record<TileLook, string> = {
  shorts: "aspect-[269/478] rounded-2xl border border-border-subtle bg-surface-secondary",
  mosaic: "rounded-2xl border border-border-subtle bg-surface-secondary",
  wide: "aspect-[337/191] rounded-lg bg-surface-secondary",
  masonry: "rounded-xl bg-surface-secondary",
};

/**
 * One community post on a grid: the picture (a video plays while hovered or focused), who made
 * it and its real counts. The whole tile opens the post page; the author opens their profile.
 */
export function PostTile({ post, look, actions, className }: { post: Post; look: TileLook; actions?: TileActions; className?: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const title = post.title || tileWords.untitled;
  const free = look === "mosaic" || look === "masonry";

  function play() {
    const v = videoRef.current;
    if (v) v.play().catch(() => {});
  }
  function stop() {
    const v = videoRef.current;
    if (v) {
      v.pause();
      v.currentTime = 0;
    }
  }

  return (
    <article
      onMouseEnter={play}
      onMouseLeave={stop}
      onFocus={play}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) stop();
      }}
      style={free ? { aspectRatio: String(aspectOf(post)) } : undefined}
      className={cn("group relative isolate w-full overflow-hidden", SHAPE[look], className)}
    >
      <TileMedia post={post} videoRef={videoRef} />

      {look === "mosaic" && <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,#00000000_39.24%,#131416CC_87.22%)]" />}
      {look === "masonry" && (
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,#00000000_50%,#131416CC_100%)] opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100" />
      )}
      {look === "shorts" && <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,#00000000_60%,#13141699_100%)]" />}
      {look === "wide" && <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(130.58deg,#FFFFFF33_11.39%,#FFFFFF00_46.63%)]" />}

      <Link
        href={`${routes.post}/${post.id}`}
        aria-label={`${title}, ${tileWords.by(post.author.name)}`}
        className="absolute inset-0 z-[1] rounded-[inherit] focus-visible:outline-offset-[-2px]"
      />

      {post.kind === "video" && look !== "shorts" && (
        <span aria-hidden className="pointer-events-none absolute top-2 right-2 z-[2] flex size-6 items-center justify-center rounded-full bg-[#0000004C] backdrop-blur-[12px]">
          <Play className="size-3 fill-text-primary text-text-primary" strokeWidth={1.5} />
        </span>
      )}

      {actions && (
        <div className="absolute top-2 left-2 z-[2] flex gap-1 opacity-100 transition-opacity duration-150 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:opacity-100">
          <button
            type="button"
            aria-pressed={post.viewer?.liked ?? false}
            aria-label={post.viewer?.liked ? tileWords.unlike : tileWords.like}
            onClick={() => actions.onLike(post)}
            className="flex h-7 items-center gap-1 rounded-full bg-[#0000004C] px-2 text-xs leading-4 font-medium text-text-primary backdrop-blur-[12px] transition-colors duration-150 hover:bg-[#00000080]"
          >
            <Heart className={cn("size-3.5", post.viewer?.liked && "fill-promo text-promo")} strokeWidth={1.5} />
            {shortCount(post.counts.likes)}
          </button>
          <button
            type="button"
            aria-pressed={post.viewer?.saved ?? false}
            aria-label={post.viewer?.saved ? tileWords.unsave : tileWords.save}
            onClick={() => actions.onSave(post)}
            className="flex size-7 items-center justify-center rounded-full bg-[#0000004C] text-text-primary backdrop-blur-[12px] transition-colors duration-150 hover:bg-[#00000080]"
          >
            <Bookmark className={cn("size-3.5", post.viewer?.saved && "fill-brand text-brand")} strokeWidth={1.5} />
          </button>
        </div>
      )}

      {look === "shorts" && (
        <div className="pointer-events-none absolute right-3 bottom-3 left-3 z-[2] flex items-end justify-between gap-2">
          <div className="flex h-7 items-center gap-2 text-sm leading-5 font-medium text-[#FFFFFFE5]">
            <span className="flex items-center gap-[6px]" aria-label={tileWords.views(shortCount(post.counts.views))}>
              <Eye className="size-4" strokeWidth={1.5} aria-hidden />
              {shortCount(post.counts.views)}
            </span>
            <span className="flex items-center gap-[6px]" aria-label={tileWords.likes(shortCount(post.counts.likes))}>
              <Heart className="size-4" strokeWidth={1.5} aria-hidden />
              {shortCount(post.counts.likes)}
            </span>
          </div>
          <AuthorLink author={post.author} size={28} bare />
        </div>
      )}

      {look === "mosaic" && (
        <div className="pointer-events-none absolute right-3 bottom-2 left-3 z-[2] flex h-7 items-center justify-between gap-2">
          <span className="flex items-center gap-[6px] text-sm leading-5 font-medium text-[#FFFFFFE5]" aria-label={tileWords.likes(shortCount(post.counts.likes))}>
            <Heart className="size-4" strokeWidth={1.5} aria-hidden />
            {shortCount(post.counts.likes)}
          </span>
          <AuthorLink author={post.author} size={20} bare />
        </div>
      )}

      {look === "wide" && (
        <div className="pointer-events-none absolute right-2 bottom-2 left-2 z-[2] flex h-7 items-center justify-between gap-2">
          <AuthorLink author={post.author} size={24} />
          <span className="flex items-center gap-1 rounded-full bg-[#0000004C] px-2 py-1 text-xs leading-4 font-medium text-[#FFFFFFE5] backdrop-blur-[12px]" aria-label={tileWords.likes(shortCount(post.counts.likes))}>
            <Heart className="size-3.5" strokeWidth={1.5} aria-hidden />
            {shortCount(post.counts.likes)}
          </span>
        </div>
      )}

      {look === "masonry" && (
        <div className="pointer-events-none absolute right-3 bottom-3 left-3 z-[2] flex items-center justify-between gap-2 opacity-100 transition-opacity duration-150 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:opacity-100">
          <AuthorLink author={post.author} size={24} withName />
          {!actions && (
            <span className="flex shrink-0 items-center gap-1 text-sm leading-5 font-medium text-[#FFFFFFE5]" aria-label={tileWords.likes(shortCount(post.counts.likes))}>
              <Heart className="size-4" strokeWidth={1.5} aria-hidden />
              {shortCount(post.counts.likes)}
            </span>
          )}
        </div>
      )}
    </article>
  );
}

/** The author's face (and name), linking to their public page. */
function AuthorLink({ author, size, withName, bare }: { author: Author; size: number; withName?: boolean; bare?: boolean }) {
  return (
    <Link
      href={`${routes.profile}/${author.handle}`}
      aria-label={tileWords.by(author.name)}
      title={author.name}
      className={cn(
        "pointer-events-auto flex min-w-0 items-center gap-2 rounded-full",
        !bare && !withName && "size-7 justify-center bg-[#0000004C] backdrop-blur-[12px]",
        bare && "ring-1 ring-text-primary",
      )}
    >
      <Avatar author={author} size={size} />
      {withName && <span className="min-w-0 truncate text-sm leading-5 font-medium text-text-primary">{author.name}</span>}
    </Link>
  );
}
