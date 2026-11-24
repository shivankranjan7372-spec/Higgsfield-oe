"use client";

import { Check, Minus, Music, Pause, Play } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { library } from "@/content/library";
import { Button, cn, Dialog, DialogContent } from "@/ui";
import { formatDuration, type Asset } from "./data";

/** The design's hairline panels. */
export const PANEL = "rounded-2xl border border-[#1F2022] bg-surface-primary";
/** The toolbar's 32-pixel outline boxes (Search, Filter, View). */
export const BOX =
  "flex h-8 shrink-0 items-center gap-[6px] rounded-md border border-[#2B2C2E] px-2 text-sm leading-5 font-medium text-text-primary transition-colors duration-150 hover:bg-border-subtle data-[state=open]:bg-border-subtle";

/** The page title row inside the main panel. */
export function PanelHeader({ title, lead, children }: { title: ReactNode; lead?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex min-h-8 shrink-0 flex-wrap items-center justify-between gap-2 pl-[2px]">
      <div className="flex min-w-0 items-center gap-2">
        {lead}
        <h1 className="truncate text-xl leading-[28px] font-semibold tracking-[-0.01em] text-text-primary">{title}</h1>
      </div>
      {children ? <div className="flex min-w-0 flex-wrap items-center gap-1">{children}</div> : null}
    </div>
  );
}

/** The 20-pixel square box drawn beside each date and on each tile. */
export function CheckBox({
  checked,
  mixed,
  onChange,
  label,
  className,
}: {
  checked: boolean;
  mixed?: boolean;
  onChange: (next: boolean) => void;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={mixed ? "mixed" : checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-sm border-2 transition-colors duration-150",
        checked || mixed ? "border-brand bg-brand text-ink" : "border-[#262628] bg-surface-primary hover:border-border-strong",
        className,
      )}
    >
      {checked ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : mixed ? <Minus className="size-3.5" strokeWidth={3} aria-hidden /> : null}
    </button>
  );
}

export function EmptyState({ line, action }: { line: string; action?: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <p className="max-w-[360px] text-sm leading-5 text-text-secondary">{line}</p>
      {action}
    </div>
  );
}

export function ErrorLine({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl bg-[#FF6B6B14] px-3 py-2 text-sm leading-5 text-danger">
      <span className="min-w-0 flex-1">{message}</span>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {library.retry}
        </Button>
      ) : null}
    </div>
  );
}

/** A quiet block grid in the shape of tiles while the first page loads. */
export function SkeletonTiles({ count = 8 }: { count?: number }) {
  return (
    <div className="mt-[52px] grid grid-cols-2 gap-1 md:grid-cols-4" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="shimmer aspect-video bg-[#222222]" />
      ))}
    </div>
  );
}

/** Asks before something that cannot be undone. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirm = library.confirm,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  body: string;
  confirm?: string;
  onConfirm: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title} className="max-w-[420px]">
        <div className="flex flex-col gap-5 p-6 pt-3">
          <p className="text-sm leading-5 text-text-secondary">{body}</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="md" onClick={() => onOpenChange(false)}>
              {library.cancel}
            </Button>
            <Button
              variant="white"
              size="md"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onConfirm();
                  onOpenChange(false);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {confirm}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * One file drawn to fill its box: a picture, a video that plays while hovered, or a sound
 * card with a small play button.
 */
export function AssetMedia({
  asset,
  src,
  poster,
  interactive = true,
  active = false,
  controls = false,
}: {
  asset: Asset;
  src?: string;
  poster?: string | null;
  interactive?: boolean;
  /** True while the tile is hovered or focused: a video plays. */
  active?: boolean;
  /** Full player controls, for the large view. */
  controls?: boolean;
}) {
  const url = src ?? asset.url;
  const still = poster === undefined ? asset.posterUrl : poster;
  const video = useRef<HTMLVideoElement>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [broken, setBroken] = useState(false);
  const alt = asset.prompt || asset.title || asset.kind;

  useEffect(() => {
    const v = video.current;
    if (!v || controls) return;
    if (active && interactive) void v.play().catch(() => {});
    else {
      v.pause();
      v.currentTime = 0;
    }
  }, [active, interactive, controls]);

  if (asset.kind === "image") {
    return broken ? (
      <div className="size-full bg-[#222222]" />
    ) : (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={alt} loading={interactive ? "lazy" : "eager"} onError={() => setBroken(true)} className="size-full object-cover" />
    );
  }
  if (asset.kind === "video") {
    return (
      <div className="relative size-full bg-[#222222]">
        <video
          ref={video}
          src={url}
          poster={still ?? undefined}
          muted={!controls}
          loop={!controls}
          controls={controls}
          playsInline
          preload="metadata"
          aria-label={alt}
          className={controls ? "size-full object-contain" : "size-full object-cover"}
        />
        {controls ? null : (
        <span className="pointer-events-none absolute right-2 bottom-2 flex items-center gap-1 rounded-sm bg-scrim px-[6px] text-2xs leading-[18px] font-semibold text-text-primary">
          <Play className="size-2.5 fill-current" strokeWidth={1.5} aria-hidden />
          {asset.duration ? formatDuration(asset.duration) : null}
        </span>
        )}
      </div>
    );
  }
  return (
    <div className="relative flex size-full flex-col items-center justify-center gap-2 bg-[linear-gradient(135deg,#23262A,#1C1E21)] p-3">
      <Music className="size-6 text-text-secondary" strokeWidth={1.5} aria-hidden />
      <span className="line-clamp-2 max-w-full text-center text-xs leading-4 text-text-nav">{alt}</span>
      {interactive ? (
        <button
          type="button"
          aria-label={playing ? "Pause" : "Play"}
          onClick={(e) => {
            e.stopPropagation();
            const a = audio.current;
            if (!a) return;
            if (a.paused) void a.play().catch(() => {});
            else a.pause();
          }}
          className="absolute right-2 bottom-2 z-[3] flex h-6 items-center gap-1 rounded-full bg-text-primary px-2 text-2xs leading-4 font-semibold text-text-inverse transition-colors duration-150 hover:bg-text-soft"
        >
          {playing ? <Pause className="size-2.5 fill-current" strokeWidth={1.5} aria-hidden /> : <Play className="size-2.5 fill-current" strokeWidth={1.5} aria-hidden />}
          {asset.duration ? formatDuration(asset.duration) : null}
        </button>
      ) : null}
      <audio ref={audio} src={url} preload="none" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
    </div>
  );
}
