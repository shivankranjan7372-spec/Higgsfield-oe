"use client";

import { Download, Heart, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { formatCredits } from "@/config/economy";
import { shortsCopy } from "@/content/shorts";
import type { Asset, Job } from "@/lib/api";
import { Dialog, DialogContent, cn } from "@/ui";

const copy = shortsCopy.viewer;

const ACTION =
  "inline-flex h-8 items-center gap-2 rounded-md bg-border-subtle px-3 text-sm leading-4 font-medium text-text-primary transition-colors duration-150 hover:bg-border-default disabled:opacity-60";

const MADE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** One short, large: it plays with sound controls, with its details and what can be done with it. */
export function Viewer({
  item,
  onClose,
  onFavorite,
  onRemove,
  onReuse,
  problem,
}: {
  item: { job: Job; asset: Asset } | null;
  onClose: () => void;
  onFavorite: (asset: Asset) => Promise<void>;
  onRemove: (job: Job) => Promise<void>;
  onReuse: (job: Job) => void;
  problem: string | null;
}) {
  const [confirm, setConfirm] = useState(false);
  const [working, setWorking] = useState(false);
  const job = item?.job;
  const asset = item?.asset;
  const seconds = asset?.duration ?? (job ? Number(job.params.duration) || null : null);

  return (
    <Dialog
      open={!!item}
      onOpenChange={(open) => {
        if (!open) {
          setConfirm(false);
          onClose();
        }
      }}
    >
      <DialogContent title={copy.title} hideTitle className="max-w-[760px]" aria-describedby={undefined}>
        {job && asset ? (
          <div className="flex flex-col gap-5 p-4 sm:flex-row sm:p-6">
            <div className="mx-auto aspect-[9/16] w-full max-w-[300px] shrink-0 overflow-clip rounded-2xl bg-surface-sunken sm:mx-0 sm:w-[300px]">
              {asset.kind === "video" ? (
                <video src={asset.url} poster={asset.posterUrl ?? undefined} controls autoPlay loop playsInline className="size-full object-cover" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={asset.posterUrl ?? asset.url} alt={job.prompt} className="size-full object-cover" />
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-4 sm:pt-8">
              <dl className="flex flex-col gap-3 text-sm leading-5">
                <div className="flex flex-col gap-1">
                  <dt className="text-xs leading-4 text-text-tab">{copy.prompt}</dt>
                  <dd className="text-text-primary">{job.prompt}</dd>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <dt className="text-xs leading-4 text-text-tab">{copy.model}</dt>
                    <dd className="truncate text-text-primary">{job.modelName}</dd>
                  </div>
                  {seconds ? (
                    <div className="flex flex-col gap-1">
                      <dt className="text-xs leading-4 text-text-tab">{copy.length}</dt>
                      <dd className="text-text-primary">{copy.seconds(Math.round(seconds))}</dd>
                    </div>
                  ) : null}
                  <div className="flex flex-col gap-1">
                    <dt className="text-xs leading-4 text-text-tab">{copy.made}</dt>
                    <dd className="text-text-primary">{MADE.format(job.finishedAt ?? job.createdAt)}</dd>
                  </div>
                  <div className="flex flex-col gap-1">
                    <dt className="text-xs leading-4 text-text-tab">{copy.cost}</dt>
                    <dd className="text-text-primary">{copy.credits(formatCredits(job.cost))}</dd>
                  </div>
                </div>
              </dl>

              <div className="flex flex-wrap gap-2">
                <a href={`${asset.url}?download=1`} download className={ACTION}>
                  <Download className="size-4" strokeWidth={1.5} aria-hidden />
                  {copy.download}
                </a>
                <button
                  type="button"
                  aria-pressed={asset.favorite}
                  disabled={working}
                  onClick={async () => {
                    setWorking(true);
                    await onFavorite(asset);
                    setWorking(false);
                  }}
                  className={ACTION}
                >
                  <Heart className={cn("size-4", asset.favorite && "fill-brand text-brand")} strokeWidth={1.5} aria-hidden />
                  {asset.favorite ? copy.unfavorite : copy.favorite}
                </button>
                <button type="button" onClick={() => onReuse(job)} className={ACTION}>
                  <RotateCcw className="size-4" strokeWidth={1.5} aria-hidden />
                  {copy.reuse}
                </button>
                <button type="button" onClick={() => setConfirm(true)} className={cn(ACTION, "text-danger")}>
                  <Trash2 className="size-4" strokeWidth={1.5} aria-hidden />
                  {copy.remove}
                </button>
              </div>

              {confirm ? (
                <div role="alertdialog" aria-label={copy.confirmText} className="flex flex-col gap-3 rounded-xl bg-surface-tertiary p-4">
                  <p className="text-sm leading-5 text-text-primary">{copy.confirmText}</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={working}
                      onClick={async () => {
                        setWorking(true);
                        await onRemove(job);
                        setWorking(false);
                        setConfirm(false);
                      }}
                      className="inline-flex h-8 items-center rounded-md bg-danger px-3 text-sm leading-4 font-semibold text-ink transition-[filter] duration-150 hover:brightness-110 disabled:opacity-60"
                    >
                      {copy.confirmRemove}
                    </button>
                    <button type="button" onClick={() => setConfirm(false)} className={ACTION}>
                      {copy.keep}
                    </button>
                  </div>
                </div>
              ) : null}

              {problem ? (
                <p role="alert" className="text-sm leading-5 text-danger">
                  {problem}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
