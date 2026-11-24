"use client";

import { RotateCcw, TriangleAlert, X } from "lucide-react";
import { useRef } from "react";
import { shortsCopy } from "@/content/shorts";
import type { Asset, Job } from "@/lib/api";
import { useNow } from "@/lib/browser";
import { cn } from "@/ui";
import { TILE, TILE_GLOW, TILE_SHADE } from "./styles";

const copy = shortsCopy.tile;

/** A finished short: the poster at rest, playing (muted) while hovered or focused. */
export function DoneTile({ job, asset, onOpen }: { job: Job; asset: Asset; onOpen: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const play = () => {
    const v = video.current;
    if (v) void v.play().catch(() => {});
  };
  const stop = () => {
    const v = video.current;
    if (!v) return;
    v.pause();
    v.currentTime = 0;
  };
  return (
    <button
      type="button"
      onClick={onOpen}
      onMouseEnter={play}
      onMouseLeave={stop}
      onFocus={play}
      onBlur={stop}
      aria-label={copy.open(job.prompt || job.modelName)}
      className={TILE}
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
        <img src={asset.posterUrl ?? asset.url} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
      )}
      <span className={TILE_SHADE} />
      <span className="absolute inset-x-3 bottom-[15px] flex flex-col gap-1">
        <span className="line-clamp-2 text-sm leading-5 font-semibold text-text-primary">{job.prompt}</span>
        <span className="truncate text-xs leading-4 text-text-tab">{job.modelName}</span>
      </span>
      {asset.favorite ? <span aria-hidden className="absolute top-3 right-3 size-2 rounded-full bg-brand" /> : null}
      <span className={TILE_GLOW} />
    </button>
  );
}

/** A short still in line or being made: a quiet shimmer with a progress bar from the model's usual time. */
export function PendingTile({ job, onCancel }: { job: Job; onCancel: () => void }) {
  const now = useNow();
  const running = job.status === "running";
  const started = job.startedAt ?? job.createdAt;
  const elapsed = now === null ? 0 : Math.max(0, now - started / 1000);
  const share = running ? Math.min(0.95, elapsed / Math.max(1, job.eta)) : 0.04;
  return (
    <div className={cn(TILE, "shimmer")} role="status" aria-label={running ? copy.running : copy.queued}>
      <span className={TILE_SHADE} />
      <div className="absolute inset-x-3 bottom-[15px] flex flex-col gap-2">
        <span className="line-clamp-2 text-sm leading-5 font-semibold text-text-primary">{job.prompt}</span>
        <div className="flex items-center justify-between text-xs leading-4 text-text-tab">
          <span>{running ? copy.running : copy.queued}</span>
          {running ? <span className="font-mono tabular-nums">{`${Math.round(share * 100)}%`}</span> : null}
        </div>
        <div className="h-1 w-full overflow-clip rounded-full bg-border-default">
          <div className="h-full rounded-full bg-brand transition-[width] duration-1000 ease-linear" style={{ width: `${share * 100}%` }} />
        </div>
      </div>
      {job.status === "queued" ? (
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-3 right-3 inline-flex h-6 items-center gap-1 rounded-full bg-surface-glass px-2 text-xs leading-4 font-medium text-text-primary transition-colors duration-150 hover:bg-surface-tertiary"
        >
          <X className="size-3" strokeWidth={1.5} aria-hidden />
          {copy.cancel}
        </button>
      ) : null}
      <span className={TILE_GLOW} />
    </div>
  );
}

/** A short that did not work: the server's reason, Try again, and Remove. */
export function FailedTile({ job, onRetry, onRemove, busy }: { job: Job; onRetry: () => void; onRemove: () => void; busy: boolean }) {
  return (
    <div className={cn(TILE, "flex flex-col items-center justify-center gap-3 px-4 text-center")}>
      <TriangleAlert className="size-6 text-danger" strokeWidth={1.5} aria-hidden />
      <p className="text-sm leading-5 text-text-primary">{job.error?.message ?? copy.failedFallback}</p>
      <p className="text-xs leading-4 text-text-secondary">{copy.refunded}</p>
      <p className="line-clamp-2 text-xs leading-4 text-text-tertiary">{job.prompt}</p>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={onRetry}
          disabled={busy}
          className="inline-flex h-8 items-center gap-1 rounded-md bg-text-primary px-3 text-xs leading-4 font-semibold text-text-inverse transition-colors duration-150 hover:bg-text-soft disabled:opacity-60"
        >
          <RotateCcw className="size-3.5" strokeWidth={1.5} aria-hidden />
          {copy.retry}
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex h-8 items-center rounded-md bg-border-subtle px-3 text-xs leading-4 font-medium text-text-primary transition-colors duration-150 hover:bg-border-default"
        >
          {copy.remove}
        </button>
      </div>
      <span className={TILE_GLOW} />
    </div>
  );
}
