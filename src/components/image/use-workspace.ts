"use client";

import { useState } from "react";
import { mutate } from "swr";
import { api, errorMessage, type Asset, type Job } from "@/lib/api";
import { ensureSession, setBalance } from "@/lib/session";
import { jobsKey, useJobs } from "@/lib/studio";

const SURFACE = "image";
/** The page size `useJobs` asks for. Older pages use the same. */
const PAGE = 40;

/** One finished picture, with the job that made it. */
export interface Shot {
  job: Job;
  asset: Asset;
}

/** A job canceled on this page. The server forgets it at once; we keep a tile until dismissed. */
export interface Canceled {
  job: Job;
}

export interface Filters {
  favorites: boolean;
  /** A model id, or null for all models. */
  model: string | null;
}

export interface Notice {
  text: string;
  /** Asset ids that can be brought back from the trash. */
  undo?: string[];
  tone?: "error";
}

const byNewest = (a: Job, b: Job) => b.createdAt - a.createdAt || b.cursor - a.cursor;

/**
 * Everything the Image workspace shows and does. The newest page comes from `useJobs` (which
 * polls while work is running); older pages are read on demand and kept here. Favourites,
 * removals and cancels are applied locally at once, then the server's answer catches up.
 */
export function useWorkspace() {
  const { jobs: first, loading } = useJobs(SURFACE);

  /* Older jobs: pages read with `before`, plus jobs that slid off the first page. */
  const [archive, setArchive] = useState<Job[]>([]);
  const [hasMore, setHasMore] = useState<boolean | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [olderError, setOlderError] = useState<string | null>(null);

  // When the first page changes, keep the jobs that slid off its end (they are only older now).
  const [seenFirst, setSeenFirst] = useState(first);
  if (seenFirst !== first) {
    setSeenFirst(first);
    if (first.length >= PAGE) {
      const ids = new Set(first.map((j) => j.id));
      const oldest = first[first.length - 1].createdAt;
      const slid = seenFirst.filter((j) => !ids.has(j.id) && j.createdAt <= oldest);
      if (slid.length) setArchive((prev) => [...slid.filter((j) => !prev.some((p) => p.id === j.id)), ...prev]);
    }
  }

  /* Local changes, applied before the server confirms them. */
  const [favs, setFavs] = useState<Record<string, boolean>>({});
  const [goneAssets, setGoneAssets] = useState<Set<string>>(() => new Set());
  const [goneJobs, setGoneJobs] = useState<Set<string>>(() => new Set());
  const [canceled, setCanceled] = useState<Canceled[]>([]);
  const [notice, setNotice] = useState<Notice | null>(null);

  const firstIds = new Set(first.map((j) => j.id));
  const all = [...first, ...archive.filter((j) => !firstIds.has(j.id))]
    .filter((j) => !goneJobs.has(j.id) && j.status !== "canceled")
    .map((j) => {
      const assets = j.assets.filter((a) => !goneAssets.has(a.id)).map((a) => (a.id in favs ? { ...a, favorite: favs[a.id] } : a));
      return assets.length === j.assets.length && assets.every((a, i) => a === j.assets[i]) ? j : { ...j, assets };
    })
    // A finished job whose every picture was removed has nothing left to show.
    .filter((j) => !(j.status === "succeeded" && j.assets.length === 0))
    .sort(byNewest);

  const more = hasMore ?? first.length >= PAGE;

  async function loadOlder() {
    const last = all[all.length - 1];
    if (!last || loadingOlder) return;
    setLoadingOlder(true);
    setOlderError(null);
    try {
      const page = await api<{ jobs: Job[] }>(`${jobsKey(SURFACE)}&before=${last.cursor}`);
      setArchive((prev) => [...prev, ...page.jobs.filter((j) => !prev.some((p) => p.id === j.id))]);
      setHasMore(page.jobs.length >= PAGE);
    } catch (e) {
      setOlderError(errorMessage(e));
    } finally {
      setLoadingOlder(false);
    }
  }

  const refresh = () => mutate(jobsKey(SURFACE));

  async function setFavorite(ids: string[], favorite: boolean) {
    const before = { ...favs };
    setFavs((prev) => ({ ...prev, ...Object.fromEntries(ids.map((id) => [id, favorite])) }));
    try {
      if (ids.length === 1) await api(`/api/assets/${ids[0]}`, { method: "PATCH", body: { favorite } });
      else await api("/api/library/bulk", { method: "POST", body: { action: "favorite", ids, favorite } });
      void refresh();
    } catch (e) {
      setFavs(before);
      setNotice({ text: errorMessage(e), tone: "error" });
    }
  }

  /** Moves pictures to the library trash. The member can bring them back with Undo. */
  async function trash(ids: string[], trashedText: string) {
    setGoneAssets((prev) => new Set([...prev, ...ids]));
    try {
      await api("/api/library/bulk", { method: "POST", body: { action: "trash", ids } });
      setNotice({ text: trashedText, undo: ids });
      void refresh();
      return true;
    } catch (e) {
      setGoneAssets((prev) => new Set([...prev].filter((id) => !ids.includes(id))));
      setNotice({ text: errorMessage(e), tone: "error" });
      return false;
    }
  }

  async function restore(ids: string[], restoredText: string) {
    try {
      await api("/api/library/bulk", { method: "POST", body: { action: "restore", ids } });
      setGoneAssets((prev) => new Set([...prev].filter((id) => !ids.includes(id))));
      setNotice({ text: restoredText });
      void refresh();
    } catch (e) {
      setNotice({ text: errorMessage(e), tone: "error" });
    }
  }

  /** Cancels a queued job (credits come back in full) and leaves a Canceled tile in its place. */
  async function cancel(job: Job, canceledText: string) {
    try {
      const r = await api<{ balance: number }>(`/api/jobs/${job.id}`, { method: "DELETE" });
      void setBalance(r.balance);
      setGoneJobs((prev) => new Set(prev).add(job.id));
      setCanceled((prev) => [{ job: { ...job, status: "canceled" } }, ...prev]);
      setNotice({ text: canceledText });
      void refresh();
    } catch (e) {
      setNotice({ text: errorMessage(e), tone: "error" });
    }
  }

  /** Removes a failed job from the history. Its credits were already returned. */
  async function remove(job: Job) {
    setGoneJobs((prev) => new Set(prev).add(job.id));
    try {
      await api(`/api/jobs/${job.id}`, { method: "DELETE" });
      void refresh();
    } catch (e) {
      setGoneJobs((prev) => new Set([...prev].filter((id) => id !== job.id)));
      setNotice({ text: errorMessage(e), tone: "error" });
    }
  }

  /** Sends a failed or canceled job again with exactly the same model, prompt, settings and files. */
  async function retry(job: Job, retriedText: string) {
    try {
      await ensureSession();
      const r = await api<{ jobs: Job[]; balance: number }>("/api/jobs", {
        method: "POST",
        body: { modelId: job.modelId, prompt: job.prompt, values: job.params, inputs: job.inputs, count: job.count, surface: SURFACE, meta: job.meta },
      });
      void setBalance(r.balance);
      if (job.status === "canceled") setCanceled((prev) => prev.filter((c) => c.job.id !== job.id));
      else if (job.status === "failed") void remove(job);
      setNotice({ text: retriedText });
      await refresh();
    } catch (e) {
      setNotice({ text: errorMessage(e), tone: "error" });
    }
  }

  const dismissCanceled = (id: string) => setCanceled((prev) => prev.filter((c) => c.job.id !== id));

  return {
    loading,
    jobs: all,
    canceled,
    more,
    loadingOlder,
    olderError,
    loadOlder,
    setFavorite,
    trash,
    restore,
    cancel,
    remove,
    retry,
    dismissCanceled,
    notice,
    setNotice,
  };
}

export type Workspace = ReturnType<typeof useWorkspace>;

/** The jobs and pictures that pass the filters, in the order the grid draws them. */
export function applyFilters(jobs: Job[], filters: Filters): Job[] {
  return jobs
    .filter((j) => !filters.model || j.modelId === filters.model)
    .map((j) => (filters.favorites ? { ...j, assets: j.assets.filter((a) => a.favorite) } : j))
    .filter((j) => !filters.favorites || (j.status === "succeeded" && j.assets.length > 0));
}

/** Every finished picture in grid order: what the viewer steps through. */
export function shotsOf(jobs: Job[]): Shot[] {
  return jobs.filter((j) => j.status === "succeeded").flatMap((job) => job.assets.map((asset) => ({ job, asset })));
}
