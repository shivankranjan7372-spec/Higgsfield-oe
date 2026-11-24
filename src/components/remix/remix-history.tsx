"use client";

import {
  CircleAlert,
  Download,
  Heart,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { mutate } from "swr";
import { LoginDialog } from "@/components/entry/login-dialog";
import { REMIX_SURFACE, remixCopy, remixModes } from "@/content/remix";
import { routes } from "@/content/site";
import { api, errorMessage, type Asset, type Job } from "@/lib/api";
import { useNow } from "@/lib/browser";
import { useSession } from "@/lib/session";
import { jobsKey } from "@/lib/studio";
import { Button, Dialog, DialogContent, Spinner, cn } from "@/ui";

const copy = remixCopy.history;
const tile =
  "group relative aspect-video overflow-clip rounded-2xl border border-border-subtle bg-surface-secondary";
function modeLabel(job: Job) {
  return (
    remixModes.find((m) => m.id === job.meta?.mode)?.label ?? job.modelName
  );
}

/** A finished remix. It plays, muted, while the pointer is over it. */
function Done({
  job,
  asset,
  onOpen,
}: {
  job: Job;
  asset: Asset;
  onOpen: () => void;
}) {
  const isVideo = asset.kind === "video";
  return (
    <li className={tile}>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${copy.open}: ${job.prompt || job.modelName}`}
        className="absolute inset-0 block size-full"
      >
        {isVideo ? (
          <video
            src={asset.url}
            poster={asset.posterUrl ?? undefined}
            muted
            loop
            playsInline
            preload="metadata"
            className="size-full object-cover"
            onMouseEnter={(e) => void e.currentTarget.play().catch(() => {})}
            onMouseLeave={(e) => {
              e.currentTarget.pause();
              e.currentTarget.currentTime = 0;
            }}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset.posterUrl ?? asset.url}
            alt=""
            loading="lazy"
            className="size-full object-cover"
          />
        )}
      </button>
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-end bg-[linear-gradient(180deg,#00000000_45%,#131416CC_100%)] p-3 opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
        <div className="flex items-end gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
            {job.prompt ? (
              <p className="line-clamp-2 text-xs leading-4 text-text-primary">
                {job.prompt}
              </p>
            ) : null}
            <p className="text-2xs leading-[14px] text-text-tab">
              {modeLabel(job)} · {job.modelName}
            </p>
          </div>
          {isVideo ? (
            <Play
              className="size-4 shrink-0 fill-current text-text-primary"
              strokeWidth={1.5}
              aria-hidden
            />
          ) : null}
        </div>
      </div>
      {asset.favorite ? (
        <span className="pointer-events-none absolute top-2 right-2 flex size-7 items-center justify-center rounded-md bg-[#00000080]">
          <Heart
            className="size-4 fill-current text-brand"
            strokeWidth={1.5}
            aria-label="Favourite"
          />
        </span>
      ) : null}
    </li>
  );
}

function Pending({ job, onCancel }: { job: Job; onCancel: () => void }) {
  const now = useNow();
  const running = job.status === "running" && job.startedAt !== null;
  const share =
    running && now !== null && job.eta > 0
      ? Math.min(0.95, Math.max(0.02, (now - job.startedAt! / 1000) / job.eta))
      : 0;
  return (
    <li className={cn(tile, "shimmer")}>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center">
        <Spinner
          className="text-text-tab"
          label={running ? copy.making : copy.waiting}
        />
        <p className="text-sm leading-5 text-text-primary">
          {running ? copy.making : copy.waiting}
        </p>
        <p className="line-clamp-1 text-xs leading-4 text-text-secondary">
          {job.prompt || job.modelName}
        </p>
        {job.status === "queued" ? (
          <button
            type="button"
            onClick={onCancel}
            className="text-xs leading-4 font-medium text-text-tab hover:text-text-primary"
          >
            Cancel
          </button>
        ) : null}
      </div>
      <div className="absolute inset-x-0 bottom-0 h-[2px] bg-border-subtle">
        <div
          role="progressbar"
          aria-label="Progress"
          aria-valuenow={Math.round(share * 100)}
          className="h-full bg-brand transition-[width] duration-1000 ease-linear"
          style={{ width: `${share * 100}%` }}
        />
      </div>
    </li>
  );
}

function Failed({
  job,
  onRetry,
  onRemove,
  busy,
}: {
  job: Job;
  onRetry: () => void;
  onRemove: () => void;
  busy: boolean;
}) {
  return (
    <li className={tile}>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
        <CircleAlert
          className="size-5 text-danger"
          strokeWidth={1.5}
          aria-hidden
        />
        <p className="line-clamp-2 text-sm leading-5 text-text-primary">
          {job.error?.message ?? "This one did not work."}
        </p>
        <p className="text-xs leading-4 text-text-secondary">
          {copy.failedNote}
        </p>
        <div className="mt-1 flex gap-2">
          <button
            type="button"
            onClick={onRetry}
            disabled={busy}
            className="inline-flex h-7 items-center gap-1 rounded-md bg-border-subtle px-2 text-xs leading-4 font-medium text-text-primary transition-colors duration-150 hover:bg-border-default"
          >
            <RotateCcw className="size-3" strokeWidth={1.5} aria-hidden />
            {copy.retry}
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove this failed remix"
            className="inline-flex size-7 items-center justify-center rounded-md bg-border-subtle text-text-secondary transition-colors duration-150 hover:bg-border-default hover:text-text-primary"
          >
            <Trash2 className="size-3.5" strokeWidth={1.5} aria-hidden />
          </button>
        </div>
      </div>
    </li>
  );
}

/** The large view of one result: play, download, favourite, delete, use the settings again. */
function Viewer({
  job,
  asset,
  onClose,
  onReuse,
}: {
  job: Job;
  asset: Asset;
  onClose: () => void;
  onReuse: (job: Job) => void;
}) {
  const v = remixCopy.viewer;
  const [favorite, setFavorite] = useState(asset.favorite);
  const [confirm, setConfirm] = useState(false);
  const [working, setWorking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function toggleFavorite() {
    const next = !favorite;
    setFavorite(next);
    setProblem(null);
    try {
      await api(`/api/assets/${asset.id}`, {
        method: "PATCH",
        body: { favorite: next },
      });
      void mutate(jobsKey(REMIX_SURFACE));
    } catch (e) {
      setFavorite(!next);
      setProblem(errorMessage(e));
    }
  }

  async function remove() {
    setWorking(true);
    setProblem(null);
    try {
      await api(`/api/jobs/${job.id}`, { method: "DELETE" });
      await mutate<{ jobs: Job[] }>(
        jobsKey(REMIX_SURFACE),
        (prev) => ({ jobs: (prev?.jobs ?? []).filter((j) => j.id !== job.id) }),
        { revalidate: true },
      );
      onClose();
    } catch (e) {
      setProblem(errorMessage(e));
    } finally {
      setWorking(false);
    }
  }

  const action =
    "inline-flex h-8 items-center gap-1.5 rounded-md bg-border-subtle px-3 text-xs leading-4 font-medium text-text-primary transition-colors duration-150 hover:bg-border-default";

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent
        title={v.title}
        hideTitle
        className="max-w-[960px] p-4 pt-14 sm:p-6 sm:pt-14"
      >
        <div className="flex flex-col gap-4">
          <div className="overflow-clip rounded-2xl bg-surface-sunken">
            {asset.kind === "video" ? (
              <video
                src={asset.url}
                poster={asset.posterUrl ?? undefined}
                controls
                autoPlay
                loop
                playsInline
                className="max-h-[60vh] w-full object-contain"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={asset.url}
                alt={job.prompt}
                className="max-h-[60vh] w-full object-contain"
              />
            )}
          </div>
          <div className="flex flex-col gap-1">
            {job.prompt ? (
              <p className="text-sm leading-5 text-text-primary">
                {job.prompt}
              </p>
            ) : null}
            <p className="text-xs leading-4 text-text-secondary">
              {modeLabel(job)} · {job.modelName}
              {job.params.resolution
                ? ` · ${String(job.params.resolution)}`
                : ""}
              {job.params.duration ? ` · ${String(job.params.duration)}s` : ""}
            </p>
          </div>
          {problem ? (
            <p role="alert" className="text-xs leading-4 text-danger">
              {problem}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <a href={`${asset.url}?download=1`} download className={action}>
              <Download className="size-4" strokeWidth={1.5} aria-hidden />
              {v.download}
            </a>
            <button
              type="button"
              onClick={() => void toggleFavorite()}
              aria-pressed={favorite}
              className={action}
            >
              <Heart
                className={cn("size-4", favorite && "fill-current text-brand")}
                strokeWidth={1.5}
                aria-hidden
              />
              {favorite ? v.unfavorite : v.favorite}
            </button>
            <button
              type="button"
              onClick={() => onReuse(job)}
              className={action}
            >
              <SlidersHorizontal
                className="size-4"
                strokeWidth={1.5}
                aria-hidden
              />
              {v.reuse}
            </button>
            <span className="flex-1" />
            {confirm ? (
              <span className="flex items-center gap-2 text-xs leading-4 text-text-secondary">
                {v.confirmRemove}
                <Button
                  variant="soft"
                  size="sm"
                  onClick={() => setConfirm(false)}
                >
                  {v.confirmNo}
                </Button>
                <button
                  type="button"
                  disabled={working}
                  onClick={() => void remove()}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#FF6B6B26] px-3 text-xs leading-4 font-medium text-danger transition-colors duration-150 hover:bg-[#FF6B6B40]"
                >
                  {working ? (
                    <Spinner label="Deleting" />
                  ) : (
                    <Trash2 className="size-4" strokeWidth={1.5} aria-hidden />
                  )}
                  {v.confirmYes}
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirm(true)}
                className={action}
              >
                <Trash2 className="size-4" strokeWidth={1.5} aria-hidden />
                {v.remove}
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The History tab: this page's own jobs (surface "remix"), newest first, with progress,
 * failures and a large view.
 */
export function RemixHistory({
  jobs,
  loading,
  busy,
  onRetry,
  onReuse,
}: {
  jobs: Job[];
  loading: boolean;
  busy: boolean;
  onRetry: (job: Job) => void;
  onReuse: (job: Job) => void;
}) {
  const { user, member } = useSession();
  const [open, setOpen] = useState<{ job: Job; asset: Asset } | null>(null);
  const [join, setJoin] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function drop(job: Job) {
    setProblem(null);
    try {
      await api(`/api/jobs/${job.id}`, { method: "DELETE" });
    } catch (e) {
      setProblem(errorMessage(e));
    }
    void mutate(jobsKey(REMIX_SURFACE));
  }

  if (loading) {
    return (
      <ul
        aria-busy
        className="grid grid-cols-1 gap-4 px-3 pt-2 pb-6 sm:grid-cols-2 lg:grid-cols-3"
      >
        {[0, 1, 2].map((i) => (
          <li key={i} className={cn(tile, "shimmer")} />
        ))}
      </ul>
    );
  }

  const shown = jobs.filter((j) => j.status !== "canceled");

  if (!user || shown.length === 0) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <p className="text-base leading-6 font-semibold text-text-primary">
          {user ? copy.emptyTitle : copy.signedOutTitle}
        </p>
        <p className="max-w-[360px] text-sm leading-5 text-text-secondary">
          {user ? copy.emptyBody : copy.signedOutBody}
        </p>
        {!user ? (
          <>
            <Button variant="outline" size="sm" onClick={() => setJoin(true)}>
              {copy.signIn}
            </Button>
            <LoginDialog
              open={join}
              onOpenChange={setJoin}
              mode="login"
              next={routes.remix}
            />
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 px-3 pt-2 pb-6">
      {!member ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-border-subtle px-3 py-2 text-xs leading-4 text-text-secondary">
          <span className="min-w-0 flex-1">{copy.guestNote}</span>
          <Button variant="tint" size="xs" onClick={() => setJoin(true)}>
            {copy.createAccount}
          </Button>
          <LoginDialog
            open={join}
            onOpenChange={setJoin}
            mode="join"
            next={routes.remix}
          />
        </div>
      ) : null}
      {problem ? (
        <p role="alert" className="text-xs leading-4 text-danger">
          {problem}
        </p>
      ) : null}
      <ul
        aria-label={copy.label}
        className="grid animate-fade-in grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {shown.map((job) => {
          if (job.status === "queued" || job.status === "running")
            return (
              <Pending key={job.id} job={job} onCancel={() => void drop(job)} />
            );
          if (job.status === "failed")
            return (
              <Failed
                key={job.id}
                job={job}
                busy={busy}
                onRetry={() => onRetry(job)}
                onRemove={() => void drop(job)}
              />
            );
          if (job.status === "succeeded") {
            return job.assets.map((asset) => (
              <Done
                key={asset.id}
                job={job}
                asset={asset}
                onOpen={() => setOpen({ job, asset })}
              />
            ));
          }
          return null;
        })}
      </ul>
      {open ? (
        <Viewer
          job={open.job}
          asset={open.asset}
          onClose={() => setOpen(null)}
          onReuse={(job) => {
            setOpen(null);
            onReuse(job);
          }}
        />
      ) : null}
    </div>
  );
}
