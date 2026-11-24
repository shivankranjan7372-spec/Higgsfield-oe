"use client";

import { Check, CircleAlert, CircleSlash, Download, Heart, RotateCcw, Trash2, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { imageCopy } from "@/content/image";
import type { Asset, Job } from "@/lib/api";
import { useNow } from "@/lib/browser";
import type { Studio } from "@/lib/studio";
import { Spinner, cn } from "@/ui";
import type { Canceled, Workspace } from "./use-workspace";

/** How many tiles sit side by side on a wide screen. Three is what the designs draw. */
export type GridSize = 2 | 3 | 4;

const COLUMNS: Record<GridSize, string> = {
  2: "md:grid-cols-2",
  3: "md:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
};

const t = imageCopy.tile;

/* Every tile is 474 by 266 as drawn: no radius, 2px apart. */
const tile = "group relative aspect-[474/266] overflow-clip bg-surface-secondary";
const overlayButton =
  "pointer-events-auto flex size-7 items-center justify-center rounded-md bg-[#00000080] text-text-primary backdrop-blur-sm transition-colors duration-150 hover:bg-[#000000B3]";
const smallButton =
  "inline-flex h-7 items-center gap-1 rounded-md bg-border-subtle px-2 text-xs leading-4 font-medium text-text-primary transition-colors duration-150 hover:bg-border-default";

interface DoneProps {
  job: Job;
  asset: Asset;
  studio: Studio;
  selected: boolean;
  selecting: boolean;
  onOpen: () => void;
  onSelect: () => void;
  onFavorite: () => void;
}

function Done({ job, asset, studio, selected, selecting, onOpen, onSelect, onFavorite }: DoneProps) {
  const name = job.prompt || t.madeWith(job.modelName);
  return (
    <li className={tile} data-asset={asset.id}>
      <button
        type="button"
        aria-label={selecting ? `${selected ? imageCopy.selection.deselect : imageCopy.selection.select}: ${name}` : `${t.open}: ${name}`}
        aria-pressed={selecting ? selected : undefined}
        onClick={selecting ? onSelect : onOpen}
        className="absolute inset-0 block size-full cursor-pointer outline-offset-[-2px]"
      >
        {/* Served by our own API behind the session cookie, so the image optimizer can't fetch it. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset.posterUrl ?? asset.url} alt={name} loading="lazy" className="size-full object-cover" />
      </button>
      <div
        className={cn(
          "pointer-events-none absolute inset-0 flex flex-col justify-between bg-linear-to-t from-[#000000B3] via-transparent to-transparent p-2 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100",
          selecting || asset.favorite ? "opacity-100" : "opacity-0",
        )}
      >
        <div className="flex items-start justify-between gap-1">
          <button
            type="button"
            role="checkbox"
            aria-checked={selected}
            aria-label={`${imageCopy.selection.select}: ${name}`}
            onClick={onSelect}
            className={cn(
              "pointer-events-auto flex size-7 items-center justify-center rounded-md border transition-colors duration-150",
              selected ? "border-brand bg-brand text-text-inverse" : "border-border-strong bg-[#00000080] text-transparent backdrop-blur-sm hover:border-text-primary",
            )}
          >
            <Check className="size-4" strokeWidth={2} aria-hidden />
          </button>
          <div className="flex gap-1">
            <button
              type="button"
              aria-label={asset.favorite ? t.unfavorite : t.favorite}
              aria-pressed={asset.favorite}
              title={asset.favorite ? t.unfavorite : t.favorite}
              onClick={onFavorite}
              className={overlayButton}
            >
              <Heart className={cn("size-4", asset.favorite && "fill-brand text-brand")} strokeWidth={1.5} aria-hidden />
            </button>
            <button type="button" aria-label={t.useAgain} title={t.useAgainShort} onClick={() => studio.load(job)} className={overlayButton}>
              <RotateCcw className="size-4" strokeWidth={1.5} aria-hidden />
            </button>
            <a href={`${asset.url}?download=1`} download aria-label={t.download} title={t.download} className={overlayButton}>
              <Download className="size-4" strokeWidth={1.5} aria-hidden />
            </a>
          </div>
        </div>
        <div className="flex flex-col gap-[2px]">
          {job.prompt ? <p className="line-clamp-2 text-xs leading-4 text-text-primary">{job.prompt}</p> : null}
          <p className="text-2xs leading-[14px] text-text-tab">{job.modelName}</p>
        </div>
      </div>
      {selected ? <div aria-hidden className="pointer-events-none absolute inset-0 ring-2 ring-brand ring-inset" /> : null}
    </li>
  );
}

/** One job that is waiting or being made. It draws a tile per result it will give back. */
function Pending({ job, onCancel }: { job: Job; onCancel: () => void }) {
  const now = useNow();
  const running = job.status === "running" && job.startedAt !== null;
  // The bar creeps toward the model's usual time and waits at 95% for the real finish.
  const share = running && now !== null && job.eta > 0 ? Math.min(0.95, Math.max(0.02, (now - job.startedAt! / 1000) / job.eta)) : 0;
  return (
    <>
      {Array.from({ length: Math.max(1, job.count) }, (_, i) => (
        <li key={`${job.id}:${i}`} className={cn(tile, "shimmer")} aria-busy>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center">
            <Spinner className="text-text-tab" label={running ? t.running : t.queued} />
            <p className="text-sm leading-5 text-text-primary">{running ? t.running : t.queued}</p>
            <p className="text-xs leading-4 text-text-secondary">{job.modelName}</p>
            {/* Only a queued job can be canceled; a running one is already with the model. */}
            {job.status === "queued" && i === 0 ? (
              <button type="button" onClick={onCancel} className={cn(smallButton, "mt-1")}>
                <X className="size-3" strokeWidth={1.5} aria-hidden />
                {t.cancel}
              </button>
            ) : null}
          </div>
          <div className="absolute inset-x-0 bottom-0 h-[2px] bg-border-subtle">
            <div className="h-full bg-brand transition-[width] duration-1000 ease-linear" style={{ width: `${share * 100}%` }} />
          </div>
        </li>
      ))}
    </>
  );
}

function Failed({ job, onRetry, onRemove }: { job: Job; onRetry: () => void; onRemove: () => void }) {
  return (
    <li className={tile}>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
        <CircleAlert className="size-5 text-danger" strokeWidth={1.5} aria-hidden />
        <p className="line-clamp-3 text-sm leading-5 text-text-primary">{job.error?.message ?? t.failedFallback}</p>
        <p className="text-xs leading-4 text-text-secondary">{t.refunded}</p>
        <div className="mt-1 flex gap-1">
          <button type="button" onClick={onRetry} className={smallButton}>
            <RotateCcw className="size-3" strokeWidth={1.5} aria-hidden />
            {t.retry}
          </button>
          <button type="button" onClick={onRemove} className={smallButton}>
            <Trash2 className="size-3" strokeWidth={1.5} aria-hidden />
            {t.remove}
          </button>
        </div>
      </div>
    </li>
  );
}

function CanceledTile({ item, onRetry, onDismiss }: { item: Canceled; onRetry: () => void; onDismiss: () => void }) {
  return (
    <li className={tile}>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
        <CircleSlash className="size-5 text-text-secondary" strokeWidth={1.5} aria-hidden />
        <p className="text-sm leading-5 text-text-primary">{t.canceled}</p>
        <p className="line-clamp-2 text-xs leading-4 text-text-secondary">{item.job.prompt || item.job.modelName}</p>
        <p className="text-xs leading-4 text-text-secondary">{t.canceledNote}</p>
        <div className="mt-1 flex gap-1">
          <button type="button" onClick={onRetry} className={smallButton}>
            <RotateCcw className="size-3" strokeWidth={1.5} aria-hidden />
            {t.retry}
          </button>
          <button type="button" onClick={onDismiss} className={smallButton}>
            <X className="size-3" strokeWidth={1.5} aria-hidden />
            {t.dismiss}
          </button>
        </div>
      </div>
    </li>
  );
}

/** Reads the next older page when the end of the list comes into view. */
function More({ ws }: { ws: Workspace }) {
  const ref = useRef<HTMLDivElement>(null);
  const { more, loadingOlder, olderError, loadOlder } = ws;
  useEffect(() => {
    const el = ref.current;
    if (!el || !more || olderError) return;
    const seen = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) void loadOlder();
    });
    seen.observe(el);
    return () => seen.disconnect();
  }, [more, olderError, loadOlder]);

  const f = imageCopy.feed;
  return (
    <div ref={ref} className="flex min-h-12 items-center justify-center gap-2 py-4 text-center text-xs leading-4 text-text-secondary">
      {olderError ? (
        <>
          <span role="alert">{`${f.olderFailed} ${olderError}`}</span>
          <button type="button" onClick={() => void loadOlder()} className={smallButton}>
            {f.retry}
          </button>
        </>
      ) : loadingOlder ? (
        <Spinner className="text-text-tab" label={f.loadingOlder} />
      ) : more ? (
        <button type="button" onClick={() => void loadOlder()} className={smallButton}>
          {f.older}
        </button>
      ) : (
        <span>{f.end}</span>
      )}
    </div>
  );
}

export interface ResultsProps {
  jobs: Job[];
  canceled: Canceled[];
  studio: Studio;
  ws: Workspace;
  size: GridSize;
  selected: Set<string>;
  onSelect: (assetId: string) => void;
  onOpen: (assetId: string) => void;
  /** Shown instead of the grid when filters hide everything. */
  emptyNote?: string | null;
}

/**
 * The workspace: everything made on this page, newest first, edge to edge under the
 * toolbar. It leaves room at the bottom so the last row can scroll clear of the composer.
 */
export function Results({ jobs, canceled, studio, ws, size, selected, onSelect, onOpen, emptyNote }: ResultsProps) {
  const selecting = selected.size > 0;
  // Canceled tiles sit where their job was, by time.
  const rows: ({ kind: "job"; job: Job } | { kind: "canceled"; item: Canceled })[] = [
    ...jobs.map((job) => ({ kind: "job" as const, job, at: job.createdAt })),
    ...canceled.map((item) => ({ kind: "canceled" as const, item, at: item.job.createdAt })),
  ].sort((a, b) => b.at - a.at);

  return (
    <div className="scroll-none min-h-0 flex-1 overflow-y-auto pt-[2px] pb-[176px] sm:pr-4">
      {emptyNote ? (
        <p className="px-4 py-16 text-center text-sm leading-5 text-text-secondary">{emptyNote}</p>
      ) : (
        <ul aria-label={imageCopy.feed.label} className={cn("grid animate-fade-in grid-cols-1 gap-[2px]", COLUMNS[size])}>
          {rows.map((row) => {
            if (row.kind === "canceled") {
              const { item } = row;
              return (
                <CanceledTile
                  key={`c:${item.job.id}`}
                  item={item}
                  onRetry={() => void ws.retry(item.job, imageCopy.notice.retried)}
                  onDismiss={() => ws.dismissCanceled(item.job.id)}
                />
              );
            }
            const { job } = row;
            if (job.status === "queued" || job.status === "running") {
              return <Pending key={job.id} job={job} onCancel={() => void ws.cancel(job, imageCopy.notice.canceled)} />;
            }
            if (job.status === "failed") {
              return (
                <Failed key={job.id} job={job} onRetry={() => void ws.retry(job, imageCopy.notice.retried)} onRemove={() => void ws.remove(job)} />
              );
            }
            if (job.status === "succeeded") {
              return job.assets.map((asset) => (
                <Done
                  key={asset.id}
                  job={job}
                  asset={asset}
                  studio={studio}
                  selected={selected.has(asset.id)}
                  selecting={selecting}
                  onOpen={() => onOpen(asset.id)}
                  onSelect={() => onSelect(asset.id)}
                  onFavorite={() => void ws.setFavorite([asset.id], !asset.favorite)}
                />
              ));
            }
            return null;
          })}
        </ul>
      )}
      <More ws={ws} />
    </div>
  );
}
