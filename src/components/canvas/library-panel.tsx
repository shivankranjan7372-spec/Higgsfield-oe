"use client";

import { X } from "lucide-react";
import useSWRInfinite from "swr/infinite";
import { canvasCopy } from "@/content/canvas";
import { errorMessage, fetcher, type Asset } from "@/lib/api";
import { useSession } from "@/lib/session";
import { cn } from "@/ui";

const t = canvasCopy.library;

interface Page {
  assets: Asset[];
  nextCursor: string | null;
}

export const DRAG_TYPE = "application/x-parallax-asset";

/**
 * The member's own pictures from the library, to place on the board. A side panel at full
 * width, a sheet over the bottom half on a phone. Click adds to the middle of the view; drag
 * drops it where it lands.
 */
export function LibraryPanel({ onClose, onAdd, onSignIn }: { onClose: () => void; onAdd: (asset: Asset) => void; onSignIn: () => void }) {
  const { user, loading: sessionLoading } = useSession();
  const { data, error, isLoading, size, setSize, mutate } = useSWRInfinite<Page>(
    (i, prev: Page | null) => {
      if (!user) return null;
      if (i > 0 && !prev?.nextCursor) return null;
      return `/api/library?kind=image&limit=40${i > 0 && prev?.nextCursor ? `&cursor=${encodeURIComponent(prev.nextCursor)}` : ""}`;
    },
    fetcher,
  );
  const assets = data?.flatMap((p) => p.assets) ?? [];
  const more = !!data?.[data.length - 1]?.nextCursor;
  const loadingMore = size > 0 && data && typeof data[size - 1] === "undefined";

  let body;
  if (sessionLoading || (user && isLoading)) {
    body = (
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-2" aria-busy="true">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="shimmer aspect-square rounded-lg bg-surface-secondary" />
        ))}
      </div>
    );
  } else if (!user) {
    body = (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <p className="text-sm leading-5 text-text-muted">{t.signedOut}</p>
        <button type="button" onClick={onSignIn} className="inline-flex h-8 items-center rounded-full bg-text-primary px-[15px] text-xs leading-[18px] font-semibold text-ink transition-colors duration-150 hover:bg-text-soft">
          {t.signIn}
        </button>
      </div>
    );
  } else if (error && !assets.length) {
    body = (
      <div role="alert" className="flex flex-col items-center gap-3 py-8 text-center">
        <p className="text-sm leading-5 text-danger">{errorMessage(error) || t.error}</p>
        <button type="button" onClick={() => void mutate()} className="h-8 rounded-full bg-border-subtle px-4 text-xs font-semibold text-text-primary transition-colors duration-150 hover:bg-border-default">
          {t.retry}
        </button>
      </div>
    );
  } else if (!assets.length) {
    body = <p className="py-8 text-center text-sm leading-5 text-text-muted">{t.empty}</p>;
  } else {
    body = (
      <>
        <p className="text-xs leading-[18px] text-text-secondary">{t.hint}</p>
        <ul aria-label={t.title} className="grid grid-cols-3 gap-2 sm:grid-cols-2">
          {assets.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(a));
                  e.dataTransfer.effectAllowed = "copy";
                }}
                onClick={() => onAdd(a)}
                aria-label={t.add(a.title || a.prompt)}
                className="block aspect-square w-full overflow-hidden rounded-lg bg-surface-secondary transition-opacity duration-150 hover:opacity-80"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.posterUrl ?? a.url} alt="" loading="lazy" draggable={false} className="size-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
        {more ? (
          <button
            type="button"
            disabled={!!loadingMore}
            onClick={() => void setSize(size + 1)}
            className="h-8 w-full rounded-full bg-border-subtle text-xs font-semibold text-text-primary transition-colors duration-150 hover:bg-border-default disabled:opacity-40"
          >
            {t.more}
          </button>
        ) : null}
      </>
    );
  }

  return (
    <aside
      data-ui
      aria-label={t.title}
      className={cn(
        "absolute z-30 flex animate-rise-in flex-col overflow-hidden border-border-default bg-surface-menu shadow-menu",
        "inset-x-0 bottom-0 max-h-[55%] rounded-t-2xl border-t",
        "sm:inset-x-auto sm:top-3 sm:bottom-3 sm:left-3 sm:max-h-none sm:w-[280px] sm:rounded-2xl sm:border",
      )}
    >
      <div className="flex h-12 shrink-0 items-center justify-between pr-2 pl-4">
        <h2 className="text-sm leading-5 font-semibold text-text-primary">{t.title}</h2>
        <button
          type="button"
          aria-label={t.close}
          onClick={onClose}
          className="flex size-8 items-center justify-center rounded-full text-text-secondary transition-colors duration-150 hover:bg-border-subtle hover:text-text-primary"
        >
          <X className="size-4" strokeWidth={1.5} aria-hidden />
        </button>
      </div>
      <div className="scroll-quiet flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4">{body}</div>
    </aside>
  );
}
