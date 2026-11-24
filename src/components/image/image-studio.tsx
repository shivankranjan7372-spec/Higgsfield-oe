"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { Composer, ComposerDock } from "@/components/studio";
import { imageCopy } from "@/content/image";
import { heroes } from "@/content/site";
import { useStudio } from "@/lib/studio";
import { cn } from "@/ui";
import { GuideHint } from "./guide-hint";
import { ImageHero } from "./hero";
import { Results, type GridSize } from "./results";
import { FilterMenu, SelectionBar, ViewMenu } from "./toolbar";
import { applyFilters, shotsOf, useWorkspace, type Filters, type Notice } from "./use-workspace";
import { Viewer } from "./viewer";

/** A short line over the composer after an action, with Undo where the action can be undone. */
function NoticeToast({ notice, onUndo, setNotice }: { notice: Notice; onUndo: () => void; setNotice: (n: Notice | null) => void }) {
  useEffect(() => {
    const id = window.setTimeout(() => setNotice(null), notice.undo ? 8000 : 5000);
    return () => window.clearTimeout(id);
  }, [notice, setNotice]);
  const onClose = () => setNotice(null);
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[44px] z-30 sm:top-auto sm:bottom-[156px] flex justify-center px-4">
      <div
        role={notice.tone === "error" ? "alert" : "status"}
        className={cn(
          "pointer-events-auto flex max-w-full animate-rise-in items-center gap-3 rounded-xl bg-surface-menu py-2 pr-2 pl-4 text-sm leading-5 shadow-menu",
          notice.tone === "error" ? "text-danger" : "text-text-primary",
        )}
      >
        <span className="min-w-0">{notice.text}</span>
        {notice.undo ? (
          <button type="button" onClick={onUndo} className="shrink-0 rounded-md px-2 py-1 font-semibold text-brand transition-colors duration-150 hover:bg-border-subtle">
            {imageCopy.notice.undo}
          </button>
        ) : null}
        <button
          type="button"
          aria-label={imageCopy.notice.dismiss}
          onClick={onClose}
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-text-secondary transition-colors duration-150 hover:bg-border-subtle hover:text-text-primary"
        >
          <X className="size-4" strokeWidth={1.5} aria-hidden />
        </button>
      </div>
    </div>
  );
}

/**
 * The Image page. Before the first picture it is the welcome hero; after that it is the
 * workspace grid. The composer floats over the bottom of both.
 */
export function ImageStudio() {
  const studio = useStudio("image");
  const ws = useWorkspace();
  const [size, setSize] = useState<GridSize>(3);
  const [filters, setFilters] = useState<Filters>({ favorites: false, model: null });
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [openId, setOpenId] = useState<string | null>(null);

  const shown = applyFilters(ws.jobs, filters);
  const shots = shotsOf(shown);
  const everything = shotsOf(ws.jobs);
  // Only count selections that are still on the page.
  const selected = new Set(everything.filter((s) => picked.has(s.asset.id)).map((s) => s.asset.id));
  const allFavorite = selected.size > 0 && everything.every((s) => !selected.has(s.asset.id) || s.asset.favorite);
  const modelIds = [...new Set(ws.jobs.map((j) => j.modelId))];
  const filtering = filters.favorites || filters.model !== null;
  const hasWork = ws.jobs.length > 0 || ws.canceled.length > 0;

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const { notice, setNotice } = ws;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col gap-[10px]">
      <div className="flex h-8 shrink-0 items-center justify-between gap-2 px-4">
        {selected.size > 0 ? (
          <SelectionBar
            count={selected.size}
            allFavorite={allFavorite}
            onFavorite={() => void ws.setFavorite([...selected], !allFavorite)}
            onTrash={() => {
              const ids = [...selected];
              void ws.trash(ids, imageCopy.notice.trashed(ids.length)).then((ok) => ok && setPicked(new Set()));
            }}
            onClear={() => setPicked(new Set())}
          />
        ) : (
          <span />
        )}
        <div className="flex shrink-0 items-center gap-2">
          {hasWork ? <FilterMenu filters={filters} onFilters={setFilters} modelIds={modelIds} /> : null}
          <ViewMenu size={size} onSize={setSize} />
        </div>
      </div>
      {ws.loading ? (
        <div className="min-h-0 flex-1" />
      ) : !hasWork ? (
        <div className="scroll-none relative flex min-h-0 flex-1 animate-fade-in overflow-y-auto pb-[244px]">
          <div className="absolute inset-x-0 top-0 flex justify-center px-4">
            <GuideHint />
          </div>
          <div className="m-auto py-[74px]">
            <ImageHero />
          </div>
        </div>
      ) : (
        <Results
          jobs={shown}
          canceled={filtering ? [] : ws.canceled}
          studio={studio}
          ws={ws}
          size={size}
          selected={selected}
          onSelect={toggle}
          onOpen={setOpenId}
          emptyNote={filtering && shown.length === 0 ? (filters.favorites && !filters.model ? imageCopy.feed.noFavorites : imageCopy.feed.noMatch) : null}
        />
      )}
      <Viewer shots={shots} openId={openId} onOpenId={setOpenId} studio={studio} ws={ws} />
      {notice ? (
        <NoticeToast
          notice={notice}
          setNotice={setNotice}
          onUndo={() => notice.undo && void ws.restore(notice.undo, imageCopy.notice.restored)}
        />
      ) : null}
      <ComposerDock>
        <Composer studio={studio} placeholder={heroes.image.placeholder} />
      </ComposerDock>
    </div>
  );
}
