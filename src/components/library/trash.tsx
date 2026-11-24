"use client";

import { RotateCcw, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import useSWRInfinite from "swr/infinite";
import { library } from "@/content/library";
import { api, errorMessage, fetcher } from "@/lib/api";
import { useNow } from "@/lib/browser";
import { Button, cn } from "@/ui";
import { AssetMedia, BOX, CheckBox, ConfirmDialog, EmptyState, ErrorLine, PanelHeader, SkeletonTiles } from "./common";
import { onLibraryChange, assetLabel, bulk, formatBytes, refreshLibrary, type TrashPage } from "./data";

const words = library.trash;

export function TrashView() {
  const now = useNow();
  const { data, error, isLoading, mutate, size, setSize } = useSWRInfinite<TrashPage>(
    (i, prev: TrashPage | null) => (i === 0 ? "/api/library/trash?limit=60" : prev?.nextCursor ? `/api/library/trash?limit=60&cursor=${encodeURIComponent(prev.nextCursor)}` : null),
    fetcher,
  );
  const assets = useMemo(() => data?.flatMap((p) => p.assets) ?? [], [data]);
  useEffect(() => onLibraryChange(() => void mutate()), [mutate]);
  const head = data?.[0];
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [ask, setAsk] = useState<null | "empty" | "some">(null);
  const [problem, setProblem] = useState<string | null>(null);
  const chosen = assets.filter((a) => selected.has(a.id)).map((a) => a.id);

  const run = async (fn: () => Promise<unknown>) => {
    setProblem(null);
    try {
      await fn();
      setSelected(new Set());
      await refreshLibrary();
      await mutate();
    } catch (e) {
      setProblem(errorMessage(e));
    }
  };

  return (
    <>
      <PanelHeader title={library.sections.trash}>
        {assets.length > 0 ? (
          <>
            <button type="button" className={BOX} onClick={() => void run(() => api("/api/library/trash/restore", { method: "POST", body: { all: true } }))}>
              <RotateCcw className="size-4" strokeWidth={1.5} aria-hidden />
              {words.restoreAll}
            </button>
            <button type="button" className={cn(BOX, "hover:text-danger")} onClick={() => setAsk("empty")}>
              <Trash2 className="size-4" strokeWidth={1.5} aria-hidden />
              {words.empty}
            </button>
          </>
        ) : null}
      </PanelHeader>
      <div className="-mx-[15px] flex min-h-0 flex-1 flex-col overflow-y-auto px-[15px] scroll-quiet">
        {head ? (
          <p className="pt-[18px] pb-[14px] pl-[6px] text-sm leading-5 text-text-secondary">
            {words.note(head.retentionDays)}
            {head.count > 0 ? ` ${library.folders.files(head.count)} · ${formatBytes(head.bytes)}` : ""}
          </p>
        ) : null}
        {problem ? <ErrorLine message={problem} /> : null}
        {error ? (
          <ErrorLine message={errorMessage(error)} onRetry={() => void mutate()} />
        ) : isLoading && !data ? (
          <SkeletonTiles />
        ) : assets.length === 0 ? (
          <EmptyState line={library.empty.trash.line} />
        ) : (
          <>
            <ul aria-label={library.sections.trash} className="grid grid-cols-2 gap-1 pb-24 sm:grid-cols-3 lg:grid-cols-4">
              {assets.map((a) => {
                const on = selected.has(a.id);
                const days = now && head ? Math.min(head.retentionDays, Math.max(0, Math.ceil((a.expiresAt - now * 1000) / 86400000))) : null;
                return (
                  <li key={a.id} className={cn("group relative aspect-video overflow-hidden bg-[#222222]", on && "outline-2 -outline-offset-2 outline-brand")}>
                    <button
                      type="button"
                      aria-label={assetLabel(a)}
                      aria-pressed={on}
                      onClick={() => setSelected((p) => (p.has(a.id) ? new Set([...p].filter((x) => x !== a.id)) : new Set([...p, a.id])))}
                      className="absolute inset-0 z-[1] focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset"
                    />
                    <div className="size-full opacity-70">
                      <AssetMedia asset={a} src={a.trashUrl} poster={a.trashPosterUrl} interactive={false} />
                    </div>
                    <CheckBox
                      checked={on}
                      onChange={(v) => setSelected((p) => (v ? new Set([...p, a.id]) : new Set([...p].filter((x) => x !== a.id))))}
                      label={`${library.selectOne}: ${assetLabel(a)}`}
                      className={cn("absolute top-2 left-2 z-[2] opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 [@media(pointer:coarse)]:opacity-100", (on || chosen.length > 0) && "opacity-100")}
                    />
                    {days !== null ? (
                      <span className="pointer-events-none absolute right-2 bottom-2 z-[2] rounded-sm bg-scrim px-[6px] text-2xs leading-[18px] font-semibold text-text-primary">{words.left(days)}</span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            {data?.[data.length - 1]?.nextCursor ? (
              <div className="flex justify-center pb-24">
                <Button variant="outline" size="sm" onClick={() => void setSize(size + 1)}>
                  {library.loadMore}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>

      {chosen.length > 0 ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-30 flex justify-center px-3">
          <div role="toolbar" aria-label={library.selection.count(chosen.length)} className="pointer-events-auto flex max-w-full animate-rise-in items-center gap-1 overflow-x-auto rounded-xl bg-surface-glass p-1.5 shadow-menu backdrop-blur-[40px] scroll-none">
            <span className="shrink-0 px-2 text-sm leading-5 font-semibold text-brand">{library.selection.count(chosen.length)}</span>
            <Button variant="ghost" size="sm" onClick={() => void run(() => bulk("restore", chosen))}>
              <RotateCcw className="size-4" strokeWidth={1.5} aria-hidden />
              {library.selection.restore}
            </Button>
            <Button variant="ghost" size="sm" className="hover:text-danger" onClick={() => setAsk("some")}>
              <Trash2 className="size-4" strokeWidth={1.5} aria-hidden />
              {library.selection.deleteForGood}
            </Button>
            <Button variant="ghost" size="sm" aria-label={library.selection.clear} onClick={() => setSelected(new Set())}>
              <X className="size-4" strokeWidth={1.5} aria-hidden />
            </Button>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={ask !== null}
        onOpenChange={(o) => (o ? null : setAsk(null))}
        title={ask === "empty" ? words.empty : library.selection.deleteForGood}
        body={ask === "empty" ? words.emptyAsk : words.deleteAsk(chosen.length)}
        onConfirm={() => run(() => (ask === "empty" ? api("/api/library/trash", { method: "DELETE" }) : bulk("delete", chosen)))}
      />
    </>
  );
}
