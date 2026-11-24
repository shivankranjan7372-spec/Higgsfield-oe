"use client";

import { Bookmark, Heart, Music, Play } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { communityWords as w } from "@/content/community";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/ui";
import { Avatar, count, postHref, profileHref, useGate } from "./bits";
import type { Post } from "./types";

/** Like and save for one post, kept in local state so the tile answers at once. */
export function usePostActions(initial: Post) {
  const gate = useGate();
  const [post, setPost] = useState(initial);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function toggle(what: "like" | "save") {
    if (busy) return;
    const on = what === "like" ? !!post.viewer?.liked : !!post.viewer?.saved;
    setBusy(true);
    setProblem(null);
    try {
      const r = await gate.run("session", () =>
        api<{ liked?: boolean; likes?: number; saved?: boolean; saves?: number }>(`/api/community/posts/${post.id}/${what}`, { method: on ? "DELETE" : "POST" }),
      );
      if (r) {
        setPost((p) => {
          const viewer = p.viewer ?? { liked: false, saved: false, followingAuthor: false, isAuthor: false };
          return what === "like"
            ? { ...p, viewer: { ...viewer, liked: !!r.liked }, counts: { ...p.counts, likes: r.likes ?? p.counts.likes } }
            : { ...p, viewer: { ...viewer, saved: !!r.saved }, counts: { ...p.counts, saves: r.saves ?? p.counts.saves } };
        });
      }
    } catch (e) {
      setProblem(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return { post, setPost, toggle, problem, dialog: gate.dialog, gate };
}

/** The still for a post: picture, video poster (or the video itself), or an audio card. */
export function PostMedia({ post, playing, className }: { post: Post; playing?: boolean; className?: string }) {
  const video = useRef<HTMLVideoElement>(null);
  if (post.kind === "audio") {
    return (
      <div className={cn("flex items-center justify-center bg-surface-secondary text-text-tab", className)}>
        <Music className="size-8" strokeWidth={1.5} aria-hidden />
      </div>
    );
  }
  if (post.kind === "video") {
    return (
      <video
        ref={(el) => {
          video.current = el;
          if (!el) return;
          if (playing) el.play().catch(() => {});
          else el.pause();
        }}
        src={post.media.url}
        poster={post.media.posterUrl ?? undefined}
        muted
        loop
        playsInline
        preload="metadata"
        aria-label={post.title || "Video"}
        className={cn("object-cover", className)}
      />
    );
  }
  return (
    // Served by our own API, so the image optimizer is not used.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={post.media.posterUrl ?? post.media.url} alt={post.title || post.prompt || "Shared picture"} loading="lazy" className={cn("object-cover", className)} />
  );
}

const iconBtn =
  "flex h-7 items-center gap-1 rounded-md bg-[#00000080] px-2 text-xs leading-4 font-medium text-text-primary backdrop-blur-sm transition-colors duration-150 hover:bg-[#000000B3]";

/** One feed tile: the work, author, like and save. Video plays while hovered. */
export function PostTile({ post: initial, hideAuthor }: { post: Post; hideAuthor?: boolean }) {
  const { post, toggle, problem, dialog } = usePostActions(initial);
  const [hover, setHover] = useState(false);
  const ratio = post.media.width && post.media.height ? post.media.width / post.media.height : post.kind === "audio" ? 1 : 16 / 9;
  return (
    <li
      className="group relative mb-[2px] break-inside-avoid overflow-clip bg-surface-secondary"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      data-post={post.id}
    >
      <Link href={postHref(post.id)} className="block" aria-label={post.title || `Post by ${post.author.name}`} onFocus={() => setHover(true)} onBlur={() => setHover(false)}>
        <div style={{ aspectRatio: String(Math.min(2.4, Math.max(0.5, ratio))) }} className="w-full">
          <PostMedia post={post} playing={hover} className="size-full" />
        </div>
        {post.kind === "video" ? (
          <span className="absolute top-2 left-2 flex size-6 items-center justify-center rounded-md bg-[#00000080] backdrop-blur-sm transition-opacity duration-150 group-hover:opacity-0">
            <Play className="size-3 fill-current text-text-primary" strokeWidth={1.5} aria-hidden />
          </span>
        ) : null}
      </Link>
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-end bg-[linear-gradient(in_oklab_180deg,#00000000_39.24%,#131416CC_87.22%)] p-2 opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
        <div className="flex items-end justify-between gap-2">
          {hideAuthor ? (
            <p className="min-w-0 truncate text-xs leading-4 font-medium text-text-primary">{post.title}</p>
          ) : (
            <Link href={profileHref(post.author.handle)} className="pointer-events-auto flex min-w-0 items-center gap-[6px] text-xs leading-4 font-medium text-text-primary">
              <Avatar author={post.author} size={20} />
              <span className="truncate">{post.author.name || post.author.handle}</span>
            </Link>
          )}
          <div className="pointer-events-auto flex shrink-0 gap-1">
            <button type="button" aria-pressed={!!post.viewer?.liked} aria-label={post.viewer?.liked ? w.post.unlike : w.post.like} onClick={() => toggle("like")} className={iconBtn}>
              <Heart className={cn("size-[14px]", post.viewer?.liked && "fill-current text-promo")} strokeWidth={1.5} aria-hidden />
              {count(post.counts.likes)}
            </button>
            <button type="button" aria-pressed={!!post.viewer?.saved} aria-label={post.viewer?.saved ? w.post.unsave : w.post.save} onClick={() => toggle("save")} className={iconBtn}>
              <Bookmark className={cn("size-[14px]", post.viewer?.saved && "fill-current text-brand")} strokeWidth={1.5} aria-hidden />
            </button>
          </div>
        </div>
        {problem ? <p role="alert" className="pointer-events-auto mt-1 text-2xs leading-[14px] text-danger">{problem}</p> : null}
      </div>
      {dialog}
    </li>
  );
}

/** Masonry columns of tiles. */
export function PostGrid({ posts, label, hideAuthor }: { posts: Post[]; label: string; hideAuthor?: boolean }) {
  return (
    <ul aria-label={label} className="columns-2 gap-[2px] md:columns-3 lg:columns-4 desktop:columns-5">
      {posts.map((p) => (
        <PostTile key={p.id} post={p} hideAuthor={hideAuthor} />
      ))}
    </ul>
  );
}

/** Grey blocks in the shape of the grid while it loads. */
export function GridSkeleton({ n = 10 }: { n?: number }) {
  const shapes = ["aspect-square", "aspect-[3/4]", "aspect-video", "aspect-[4/5]", "aspect-[16/10]"];
  return (
    <div aria-label={w.feed.loading} role="status" className="columns-2 gap-[2px] md:columns-3 lg:columns-4 desktop:columns-5">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className={cn("shimmer mb-[2px] w-full break-inside-avoid bg-surface-secondary", shapes[i % shapes.length])} />
      ))}
    </div>
  );
}
