"use client";

import { mutate as globalMutate } from "swr";
import { api, type Asset } from "@/lib/api";

export type { Asset };

export interface Summary {
  counts: {
    all: number;
    image: number;
    video: number;
    audio: number;
    favorites: number;
    generated: number;
    uploads: number;
    unfiled: number;
    trash: number;
    folders: number;
    elements: number;
  };
  storage: { totalBytes: number; byKind: Record<string, number>; trashBytes: number };
  models: { id: string; name: string; count: number }[];
  trashRetentionDays: number;
}

export interface Folder {
  id: string;
  name: string;
  count: number;
  bytes: number;
  createdAt: number;
}

export interface LibraryPage {
  assets: Asset[];
  nextCursor: string | null;
  counts: { all: number; image: number; video: number; audio: number };
}

export type TrashedAsset = Asset & { trashedAt: number; expiresAt: number; trashUrl: string; trashPosterUrl: string | null };

export interface TrashPage {
  assets: TrashedAsset[];
  nextCursor: string | null;
  count: number;
  bytes: number;
  retentionDays: number;
}

export type ElementType = "character" | "object" | "style" | "place";

export interface LibElement {
  id: string;
  type: ElementType;
  name: string;
  description: string;
  tags: string[];
  cover: Asset | null;
  assets: Asset[];
  assetIds: string[];
  useCount: number;
  lastUsedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

const EVENT = "parallax:library-changed";

/** Lists paged with useSWRInfinite are not reached by a filtered `mutate`, so they listen here. */
export function onLibraryChange(fn: () => void) {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}

/** Re-reads every library list on screen after a change. */
export function refreshLibrary() {
  window.dispatchEvent(new Event(EVENT));
  return globalMutate((key) => {
    const k = Array.isArray(key) ? String(key[0]) : typeof key === "string" ? key : "";
    return k.startsWith("/api/library") || k.startsWith("/api/folders") || k.startsWith("/api/elements") || k.startsWith("$inf$/api/library");
  });
}

export async function bulk(action: "favorite" | "move" | "trash" | "restore" | "delete", ids: string[], extra: Record<string, unknown> = {}) {
  const r = await api<{ ok: true; count: number }>("/api/library/bulk", { method: "POST", body: { action, ids, ...extra } });
  await refreshLibrary();
  return r;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 10 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

export function formatDuration(s: number): string {
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
}

export function assetLabel(a: Asset): string {
  return a.title || a.prompt || "Untitled";
}

/** Downloads one file through a hidden link, one after another for many. */
export function download(assets: Asset[]) {
  assets.forEach((a, i) => {
    window.setTimeout(() => {
      const link = document.createElement("a");
      link.href = `${a.url}?download=1`;
      link.download = "";
      document.body.appendChild(link);
      link.click();
      link.remove();
    }, i * 250);
  });
}
