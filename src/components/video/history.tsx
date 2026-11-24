"use client";

import { CircleAlert, Play, RotateCcw, X } from "lucide-react";
import { useRef, useState } from "react";
import { mutate } from "swr";
import { videoCopy as t } from "@/content/video";
import { api, errorMessage, type Asset, type Job } from "@/lib/api";
import { useNow } from "@/lib/browser";
import { setBalance } from "@/lib/session";
import { jobsKey } from "@/lib/studio";
import { Button, Spinner, cn } from "@/ui";
import { Masonry } from "./masonry";

const tile =
  "group relative w-full overflow-clip rounded-2xl border border-border-subtle bg-surface-secondary";

/** The shape of a result, from the file itself or else the aspect it was asked for. */
export function ratioOf(job: Job, asset?: Asset): string {
  if (asset?.width && asset.height) return `${asset.width} / ${asset.height}`;
  const aspect = /^(\d+):(\d+)$/.exec(String(job.params.aspect ?? ""));
  return aspect ? `${aspect[1]} / ${aspect[2]}` : "16 / 9";
}

const refresh = () => mutate(jobsKey("video"));

/** A finished video: its poster at rest, playing silently while the pointer is over it. */
function Done({
  job,
  asset,
  onOpen,
}: {
  job: Job;
  asset: Asset;
  onOpen: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const start = () => {
    setPlaying(true);
    void video.current?.play().catch(() => setPlaying(false));
  };
  const stop = () => {
    setPlaying(false);
    video.current?.pause();
  };
  return (
    <button
      type="button"
      onClick={onOpen}
      onMouseEnter={start}
      onMouseLeave={stop}
      onFocus={start}
      onBlur={stop}
      aria-label={`Open: ${job.prompt || job.modelName}`}
      className={cn(tile, "block text-left")}
      style={{ aspectRatio: ratioOf(job, asset) }}
    >
      {asset.kind === "video" ? (
        <video
          ref={video}
          src={asset.url}
          poster={asset.posterUrl ?? undefined}
          muted
          loop
          playsInline
          preload="metadata"
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={asset.posterUrl ?? asset.url}
          alt=""
          loading="lazy"
          className="absolute inset-0 size-full object-cover"
        />
      )}
      <span
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(180deg,#00000000_39.24%,#131416CC_87.22%)] opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
      />
      <span className="absolute inset-x-3 bottom-3 flex flex-col gap-[2px] opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 [@media(hover:none)]:opacity-100">
        {job.prompt ? (
          <span className="line-clamp-2 text-sm leading-5 font-medium text-[#FFFFFFE5]">
            {job.prompt}
          </span>
        ) : null}
        <span className="text-2xs leading-[14px] text-text-tab">
          {job.modelName}
        </span>
      </span>
      {playing ? null : (
        <span
          aria-hidden
          className="absolute top-3 left-3 flex size-7 items-center justify-center rounded-full bg-[#00000080] text-text-primary backdrop-blur-sm"
        >
          <Play className="size-3 fill-current" strokeWidth={1.5} />
        </span>
      )}
    </button>
  );
}

function Pending({ job }: { job: Job }) {
  const now = useNow();
  const [problem, setProblem] = useState<string | null>(null);
  const running = job.status === "running" && job.startedAt !== null;
  const share =
    running && now !== null && job.eta > 0
      ? Math.min(0.95, Math.max(0.02, (now - job.startedAt! / 1000) / job.eta))
      : 0;
  async function cancel() {
    try {
      const res = await api<{ balance: number }>(`/api/jobs/${job.id}`, {
        method: "DELETE",
      });
      await setBalance(res.balance);
      await refresh();
    } catch (e) {
      setProblem(errorMessage(e));
    }
  }
  return (
    <div
      className={cn(tile, "shimmer")}
      style={{ aspectRatio: ratioOf(job) }}
      data-status={job.status}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center">
        <Spinner
          className="text-text-tab"
          label={running ? t.history.running : t.history.queued}
        />
        <p className="text-sm leading-5 text-text-primary">
          {running ? t.history.running : t.history.queued}
          {running ? (
            <span className="ml-1 text-text-secondary tabular-nums">
              {Math.round(share * 100)}%
            </span>
          ) : null}
        </p>
        <p className="line-clamp-1 text-xs leading-4 text-text-secondary">
          {job.modelName}
        </p>
        {problem ? (
          <p className="text-xs leading-4 text-danger">{problem}</p>
        ) : null}
        {job.status === "queued" ? (
          <Button variant="soft" size="xs" onClick={() => void cancel()}>
            {t.history.cancel}
          </Button>
        ) : null}
      </div>
      <div className="absolute inset-x-0 bottom-0 h-[2px] bg-border-subtle">
        <div
          className="h-full bg-brand transition-[width] duration-1000 ease-linear"
          style={{ width: `${share * 100}%` }}
        />
      </div>
    </div>
  );
}

function Failed({ job }: { job: Job }) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  async function retry() {
    setBusy(true);
    setProblem(null);
    try {
      const res = await api<{ jobs: Job[]; balance: number }>("/api/jobs", {
        method: "POST",
        body: {
          modelId: job.modelId,
          prompt: job.prompt,
          values: job.params,
          inputs: job.inputs,
          count: 1,
          surface: "video",
        },
      });
      await setBalance(res.balance);
      await api(`/api/jobs/${job.id}`, { method: "DELETE" }).catch(() => null);
      await refresh();
    } catch (e) {
      setProblem(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    try {
      await api(`/api/jobs/${job.id}`, { method: "DELETE" });
      await refresh();
    } catch (e) {
      setProblem(errorMessage(e));
    }
  }
  return (
    <div
      className={tile}
      style={{ aspectRatio: ratioOf(job) }}
      data-status="failed"
    >
      <button
        type="button"
        aria-label={t.remove}
        onClick={() => void remove()}
        className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-md text-text-tab transition-colors duration-150 hover:bg-border-subtle hover:text-text-primary"
      >
        <X className="size-4" strokeWidth={1.5} aria-hidden />
      </button>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
        <CircleAlert
          className="size-5 shrink-0 text-danger"
          strokeWidth={1.5}
          aria-hidden
        />
        <p className="line-clamp-2 text-sm leading-5 text-text-primary">
          {job.error?.message ?? t.history.failed}
        </p>
        <p className="line-clamp-1 text-xs leading-4 text-text-secondary">
          {problem ?? t.history.refunded}
        </p>
        <Button
          variant="soft"
          size="xs"
          disabled={busy}
          onClick={() => void retry()}
        >
          <RotateCcw className="size-3" strokeWidth={1.5} aria-hidden />
          {t.history.retry}
        </Button>
      </div>
    </div>
  );
}

/** The member's own videos, newest first, in the same three columns as the examples. */
export function History({
  jobs,
  onOpen,
}: {
  jobs: Job[];
  onOpen: (job: Job, asset: Asset) => void;
}) {
  return (
    <Masonry
      label="Your videos"
      className="animate-fade-in pt-2"
      items={jobs.flatMap((job) => {
        if (job.status === "queued" || job.status === "running")
          return [{ key: job.id, node: <Pending job={job} /> }];
        if (job.status === "failed")
          return [{ key: job.id, node: <Failed job={job} /> }];
        if (job.status === "succeeded")
          return job.assets.map((asset) => ({
            key: asset.id,
            node: (
              <Done job={job} asset={asset} onOpen={() => onOpen(job, asset)} />
            ),
          }));
        return [];
      })}
    />
  );
}

/** The quiet shapes shown while the list is on its way. */
export function HistorySkeleton() {
  return (
    <ul
      aria-hidden
      className="mx-auto w-full max-w-[1022px] columns-1 gap-4 px-3 pt-2 sm:columns-2 lg:columns-3 lg:px-0"
    >
      {["16 / 9", "3 / 2", "9 / 16", "9 / 16", "16 / 9", "3 / 2"].map(
        (r, i) => (
          <li key={i} className="mb-4 break-inside-avoid">
            <div
              className="shimmer w-full rounded-2xl bg-surface-secondary"
              style={{ aspectRatio: r }}
            />
          </li>
        ),
      )}
    </ul>
  );
}
