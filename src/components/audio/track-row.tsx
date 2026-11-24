"use client";

import { CircleAlert, Download, Heart, Music2, Pause, Play, RotateCcw, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";
import { mutate } from "swr";
import { audioCopy } from "@/content/audio";
import { ApiError, api, errorMessage, type Asset, type Job } from "@/lib/api";
import { useNow } from "@/lib/browser";
import { setBalance } from "@/lib/session";
import { jobsKey } from "@/lib/studio";
import { Button, Dialog, DialogClose, DialogContent, Spinner, cn, iconButtonClass } from "@/ui";

const row = "flex flex-col gap-3 rounded-2xl border border-[#D9D9D90A] bg-surface-sunken p-3 sm:flex-row sm:items-center";
const action = iconButtonClass(32, "soft");

/** "1:05" from seconds. */
export function clock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function When({ at }: { at: number }) {
  const now = useNow();
  if (now === null) return null;
  const mins = Math.round((now * 1000 - at) / 60000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const text = mins < 1 ? "just now" : mins < 60 ? rtf.format(-mins, "minute") : mins < 60 * 24 ? rtf.format(-Math.round(mins / 60), "hour") : new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(at);
  return <span>{text}</span>;
}

function Meta({ job }: { job: Job }) {
  return (
    <span className="flex min-w-0 items-center gap-[6px] text-2xs leading-[14px] text-text-secondary">
      <span className="truncate">{job.modelName}</span>
      <span aria-hidden>·</span>
      <When at={job.createdAt} />
    </span>
  );
}

/** Refreshes the history the job came from. */
function reload(job: Job) {
  return mutate(jobsKey(job.surface));
}

/** Asks before removing a finished job: its files are deleted for good. */
function RemoveButton({ job, confirm, onProblem }: { job: Job; confirm: boolean; onProblem: (m: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const queued = job.status === "queued";
  async function remove() {
    setBusy(true);
    onProblem(null);
    try {
      const res = await api<{ ok: true; balance: number }>(`/api/jobs/${job.id}`, { method: "DELETE" });
      await setBalance(res.balance);
      setOpen(false);
    } catch (e) {
      // A 404 means it is already gone: the list refresh below drops it quietly.
      if (!(e instanceof ApiError && e.status === 404)) onProblem(errorMessage(e));
      setOpen(false);
    } finally {
      setBusy(false);
      await reload(job);
    }
  }
  const label = queued ? audioCopy.cancel : audioCopy.remove;
  const icon = queued ? <X className="size-4" strokeWidth={1.5} aria-hidden /> : <Trash2 className="size-4" strokeWidth={1.5} aria-hidden />;
  if (!confirm)
    return (
      <button type="button" aria-label={label} title={label} disabled={busy} onClick={() => void remove()} className={action}>
        {icon}
      </button>
    );
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button type="button" aria-label={label} title={label} onClick={() => setOpen(true)} className={action}>
        {icon}
      </button>
      <DialogContent title={audioCopy.removeTitle} className="max-w-[400px]">
        <p className="px-6 pt-2 text-sm leading-5 text-text-secondary">{audioCopy.removeBody}</p>
        <div className="flex justify-end gap-2 px-6 pt-5 pb-6">
          <DialogClose asChild>
            <Button variant="soft" size="sm">
              {audioCopy.keep}
            </Button>
          </DialogClose>
          <Button variant="white" size="sm" disabled={busy} onClick={() => void remove()}>
            {audioCopy.removeConfirm}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Play, seek and time for one file. Starting one track pauses any other on the page. */
function Player({ asset, label }: { asset: Asset; label: string }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState(0);
  const [length, setLength] = useState(asset.duration ?? 0);
  const [broken, setBroken] = useState(false);

  function toggle() {
    const el = ref.current;
    if (!el) return;
    if (el.paused) {
      document.querySelectorAll("audio").forEach((other) => {
        if (other !== el) other.pause();
      });
      void el.play().catch(() => setBroken(true));
    } else el.pause();
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <button
        type="button"
        aria-label={`${playing ? audioCopy.pause : audioCopy.play}: ${label}`}
        aria-pressed={playing}
        onClick={toggle}
        disabled={broken}
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand text-ink shadow-lime transition-colors duration-150 hover:bg-brand-pressed disabled:opacity-40"
      >
        {playing ? <Pause className="size-4 fill-current" strokeWidth={1.5} aria-hidden /> : <Play className="ml-[2px] size-4 fill-current" strokeWidth={1.5} aria-hidden />}
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <input
          type="range"
          min={0}
          max={length || 1}
          step={0.1}
          value={Math.min(at, length || 1)}
          aria-label={`${audioCopy.seek}: ${label}`}
          aria-valuetext={`${clock(at)} of ${clock(length)}`}
          onChange={(e) => {
            const t = Number(e.target.value);
            setAt(t);
            if (ref.current) ref.current.currentTime = t;
          }}
          className="h-5 min-w-0 flex-1 accent-brand"
        />
        <span className="shrink-0 text-2xs leading-[14px] font-medium text-text-secondary tabular-nums">
          {clock(at)} / {clock(length)}
        </span>
      </div>
      <audio
        ref={ref}
        src={asset.url}
        preload="metadata"
        onLoadedMetadata={(e) => Number.isFinite(e.currentTarget.duration) && setLength(e.currentTarget.duration)}
        onTimeUpdate={(e) => setAt(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setAt(0);
        }}
        onError={() => setBroken(true)}
        className="hidden"
      />
    </div>
  );
}

function FavoriteButton({ asset, job, onProblem }: { asset: Asset; job: Job; onProblem: (m: string | null) => void }) {
  // Shows the new mark at once; the server's answer takes over when the list reloads.
  const [pending, setPending] = useState<boolean | null>(null);
  const on = pending ?? asset.favorite;
  async function flip() {
    const next = !on;
    setPending(next);
    onProblem(null);
    try {
      await api(`/api/assets/${asset.id}`, { method: "PATCH", body: { favorite: next } });
    } catch (e) {
      onProblem(errorMessage(e));
    }
    await reload(job);
    setPending(null);
  }
  const label = on ? audioCopy.unfavorite : audioCopy.favorite;
  return (
    <button type="button" aria-label={label} title={label} aria-pressed={on} onClick={() => void flip()} className={action}>
      <Heart className={cn("size-4", on && "fill-current text-promo")} strokeWidth={1.5} aria-hidden />
    </button>
  );
}

function Title({ job }: { job: Job }) {
  return <p className="truncate text-sm leading-5 font-medium text-text-primary">{job.prompt || job.modelName}</p>;
}

/** A finished track: the player, then download, favourite, use again and remove. */
export function DoneRow({ job, asset, onUse }: { job: Job; asset: Asset; onUse: (job: Job) => void }) {
  const [problem, setProblem] = useState<string | null>(null);
  const title = job.prompt || job.modelName;
  return (
    <li className={row}>
      <div className="flex min-w-0 flex-col gap-1 sm:w-[38%] sm:shrink-0">
        <Title job={job} />
        <Meta job={job} />
        {problem ? (
          <p role="alert" className="text-xs leading-4 text-danger">
            {problem}
          </p>
        ) : null}
      </div>
      <Player asset={asset} label={title} />
      <div className="flex shrink-0 items-center gap-1">
        <a href={`${asset.url}?download=1`} download aria-label={audioCopy.download} title={audioCopy.download} className={action}>
          <Download className="size-4" strokeWidth={1.5} aria-hidden />
        </a>
        <FavoriteButton asset={asset} job={job} onProblem={setProblem} />
        <button type="button" aria-label={audioCopy.useAgain} title={audioCopy.useAgain} onClick={() => onUse(job)} className={action}>
          <RotateCcw className="size-4" strokeWidth={1.5} aria-hidden />
        </button>
        <RemoveButton job={job} confirm onProblem={setProblem} />
      </div>
    </li>
  );
}

/** A job waiting or being made, with a bar that creeps toward the model's usual time. */
export function PendingRow({ job }: { job: Job }) {
  const now = useNow();
  const [problem, setProblem] = useState<string | null>(null);
  const running = job.status === "running" && job.startedAt !== null;
  const share = running && now !== null && job.eta > 0 ? Math.min(0.95, Math.max(0.02, (now - job.startedAt! / 1000) / job.eta)) : 0;
  return (
    <li className={cn(row, "shimmer relative overflow-clip")} aria-busy>
      <div className="flex min-w-0 flex-col gap-1 sm:w-[38%] sm:shrink-0">
        <Title job={job} />
        <Meta job={job} />
        {problem ? (
          <p role="alert" className="text-xs leading-4 text-danger">
            {problem}
          </p>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-border-subtle">
          <Spinner className="text-text-tab" label={running ? audioCopy.running : audioCopy.queued} />
        </span>
        <span className="text-sm leading-5 text-text-primary">{running ? audioCopy.running : audioCopy.queued}</span>
      </div>
      <div className="flex shrink-0 items-center gap-1">{job.status === "queued" ? <RemoveButton job={job} confirm={false} onProblem={setProblem} /> : null}</div>
      <div className="absolute inset-x-0 bottom-0 h-[2px] bg-border-subtle">
        <div className="h-full bg-brand transition-[width] duration-1000 ease-linear" style={{ width: `${share * 100}%` }} />
      </div>
    </li>
  );
}

/** A job that failed: the reason, try again, remove. */
export function FailedRow({ job, onUse }: { job: Job; onUse: (job: Job) => void }) {
  const [problem, setProblem] = useState<string | null>(null);
  return (
    <li className={row}>
      <div className="flex min-w-0 flex-col gap-1 sm:w-[38%] sm:shrink-0">
        <Title job={job} />
        <Meta job={job} />
      </div>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#FF6B6B1F]">
          <CircleAlert className="size-5 text-danger" strokeWidth={1.5} aria-hidden />
        </span>
        <div className="flex min-w-0 flex-col gap-[2px]">
          <p className="line-clamp-2 text-sm leading-5 text-text-primary">{job.error?.message ?? audioCopy.failedFallback}</p>
          <p className="text-xs leading-4 text-text-secondary">{problem ?? audioCopy.failedNote}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => onUse(job)}
          className="inline-flex h-8 items-center gap-1 rounded-md bg-border-subtle px-3 text-xs leading-4 font-medium text-text-primary transition-colors duration-150 hover:bg-border-default"
        >
          <RotateCcw className="size-3" strokeWidth={1.5} aria-hidden />
          {audioCopy.tryAgain}
        </button>
        <RemoveButton job={job} confirm={false} onProblem={setProblem} />
      </div>
    </li>
  );
}

/** A finished job that came back with no file. */
export function EmptyResultRow({ job, onUse }: { job: Job; onUse: (job: Job) => void }) {
  const [problem, setProblem] = useState<string | null>(null);
  return (
    <li className={row}>
      <div className="flex min-w-0 flex-col gap-1 sm:w-[38%] sm:shrink-0">
        <Title job={job} />
        <Meta job={job} />
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-border-subtle">
          <Music2 className="size-4 text-text-secondary" strokeWidth={1.5} aria-hidden />
        </span>
        <p className="text-xs leading-4 text-text-secondary">{problem ?? audioCopy.noResult}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button type="button" aria-label={audioCopy.useAgain} title={audioCopy.useAgain} onClick={() => onUse(job)} className={action}>
          <RotateCcw className="size-4" strokeWidth={1.5} aria-hidden />
        </button>
        <RemoveButton job={job} confirm={false} onProblem={setProblem} />
      </div>
    </li>
  );
}

