"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/api";

/** The shapes of docs/api/community.md that these screens read. */
export interface Author {
  id: string;
  handle: string;
  name: string;
  avatarUrl: string | null;
}

export interface Post {
  id: string;
  kind: "image" | "video" | "audio";
  media: {
    assetId: string;
    url: string;
    posterUrl: string | null;
    mime: string;
    width: number | null;
    height: number | null;
    duration: number | null;
  };
  title: string;
  description: string;
  tags: string[];
  author: Author;
  model: { id: string; name: string } | null;
  allowRecreate: boolean;
  prompt: string | null;
  counts: { likes: number; saves: number; comments: number; views: number };
  viewer: { liked: boolean; saved: boolean; followingAuthor: boolean; isAuthor: boolean } | null;
  publishedAt: number;
}

export interface FeedPage {
  posts: Post[];
  nextCursor: string | null;
}

export interface Contest {
  id: string;
  slug: string;
  title: string;
  summary: string;
  kind: "image" | "video" | "audio" | null;
  prize: string;
  phase: "upcoming" | "open" | "voting" | "ended";
  opensAt: number;
  closesAt: number;
  endsAt: number;
  entries: number;
}

export interface ExploreModel {
  id: string;
  name: string;
  posts: number;
}

export function feedKey(query: Record<string, string>, limit: number, cursor?: string | null): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v) q.set(k, v);
  q.set("limit", String(limit));
  if (cursor) q.set("cursor", cursor);
  return `/api/explore?${q.toString()}`;
}

/** One page of the public feed, for a home section. */
export function useFeed(query: Record<string, string>, limit: number) {
  return useSWR<FeedPage>(feedKey(query, limit), fetcher, { revalidateOnFocus: false });
}

export function useExploreModels() {
  return useSWR<{ models: ExploreModel[] }>("/api/explore/models", fetcher, { revalidateOnFocus: false });
}

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

/** 1234 → "1.2K". Real counts only. */
export function shortCount(n: number): string {
  return compact.format(n);
}

/** The aspect of a post's file, for masonry; square when the file has no size. */
export function aspectOf(post: Post): number {
  const { width, height } = post.media;
  if (width && height) return width / height;
  return post.kind === "video" ? 16 / 9 : 1;
}

/** The picture to show while a tile is at rest, or null when there is none (a video with no poster, audio). */
export function stillOf(post: Post): string | null {
  if (post.kind === "image") return post.media.posterUrl ?? post.media.url;
  return post.media.posterUrl;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "?").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase();
}
