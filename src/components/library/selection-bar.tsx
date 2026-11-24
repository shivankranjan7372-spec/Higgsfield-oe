"use client";

import { Download, FolderInput, FolderPlus, Heart, Trash2, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { library } from "@/content/library";
import { api, errorMessage } from "@/lib/api";
import { Button, cn, MenuItem, MenuLabel, Popover, PopoverContent, PopoverTrigger } from "@/ui";
import { bulk, download, refreshLibrary, type Asset, type Folder } from "./data";

/** The "Move to" menu: every folder, "No folder" and a quick new folder. */
export function MoveMenu({ ids, folders, current, trigger, onDone }: { ids: string[]; folders: Folder[]; current?: string | null; trigger: ReactNode; onDone?: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const move = async (folderId: string | null) => {
    setProblem(null);
    try {
      await bulk("move", ids, { folderId });
      setOpen(false);
      onDone?.();
    } catch (e) {
      setProblem(errorMessage(e));
    }
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" side="top" className="max-h-[60vh] w-[240px] overflow-y-auto scroll-quiet">
        <MenuLabel>{library.move.title}</MenuLabel>
        <MenuItem selected={current === null} onClick={() => void move(null)}>
          {library.move.none}
        </MenuItem>
        {folders.map((f) => (
          <MenuItem key={f.id} selected={current === f.id} hint={f.count} onClick={() => void move(f.id)}>
            {f.name}
          </MenuItem>
        ))}
        <form
          className="mt-1 flex items-center gap-1 border-t border-border-subtle pt-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim()) return;
            setProblem(null);
            try {
              const r = await api<{ folder: Folder }>("/api/folders", { method: "POST", body: { name } });
              setName("");
              await move(r.folder.id);
            } catch (err) {
              setProblem(errorMessage(err));
            }
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            placeholder={library.move.newFolder}
            aria-label={library.folders.name}
            className="h-8 min-w-0 flex-1 rounded-md bg-surface-field px-2 text-sm leading-5 text-text-primary outline-none placeholder:text-text-secondary"
          />
          <button type="submit" aria-label={library.move.newFolder} className="flex size-8 items-center justify-center rounded-md bg-border-subtle hover:bg-border-default">
            <FolderPlus className="size-4" strokeWidth={1.5} aria-hidden />
          </button>
        </form>
        {problem ? (
          <p role="alert" className="px-2 pt-2 text-xs leading-4 text-danger">
            {problem}
          </p>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

const ACT = "flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-sm leading-5 font-medium text-text-primary transition-colors duration-150 hover:bg-border-default disabled:opacity-40";

/** The floating bar shown while files are selected. */
export function SelectionBar({ assets, total, folders, onSelectAll, onClear }: { assets: Asset[]; total: number; folders: Folder[]; onSelectAll: () => void; onClear: () => void }) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  if (assets.length === 0) return null;
  const ids = assets.map((a) => a.id);
  const allFav = assets.every((a) => a.favorite);
  const run = async (fn: () => Promise<unknown>, clear = false) => {
    setBusy(true);
    setProblem(null);
    try {
      await fn();
      if (clear) onClear();
    } catch (e) {
      setProblem(errorMessage(e));
      await refreshLibrary();
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-30 flex justify-center px-3">
      <div
        role="toolbar"
        aria-label={library.selection.count(assets.length)}
        className="pointer-events-auto flex max-w-full animate-rise-in flex-col gap-1 rounded-xl bg-surface-glass p-1.5 shadow-menu backdrop-blur-[40px]"
      >
        {problem ? (
          <p role="alert" className="px-2 py-1 text-xs leading-4 text-danger">
            {problem}
          </p>
        ) : null}
        <div className="flex items-center gap-1 overflow-x-auto scroll-none">
          <span className="shrink-0 px-2 text-sm leading-5 font-semibold text-brand">{library.selection.count(assets.length)}</span>
          {assets.length < total ? (
            <button type="button" className={ACT} onClick={onSelectAll}>
              {library.selection.all}
            </button>
          ) : null}
          <span className="mx-1 h-5 w-px shrink-0 bg-border-default" />
          <button type="button" className={ACT} disabled={busy} onClick={() => void run(() => bulk("favorite", ids, { favorite: !allFav }))}>
            <Heart className={cn("size-4", allFav && "fill-current")} strokeWidth={1.5} aria-hidden />
            <span className="max-sm:sr-only">{allFav ? library.selection.unfavourite : library.selection.favourite}</span>
          </button>
          <MoveMenu
            ids={ids}
            folders={folders}
            onDone={onClear}
            trigger={
              <button type="button" className={ACT} disabled={busy}>
                <FolderInput className="size-4" strokeWidth={1.5} aria-hidden />
                <span className="max-sm:sr-only">{library.selection.move}</span>
              </button>
            }
          />
          <button type="button" className={ACT} disabled={busy} onClick={() => download(assets)}>
            <Download className="size-4" strokeWidth={1.5} aria-hidden />
            <span className="max-sm:sr-only">{library.selection.download}</span>
          </button>
          <button type="button" className={cn(ACT, "hover:text-danger")} disabled={busy} onClick={() => void run(() => bulk("trash", ids), true)}>
            <Trash2 className="size-4" strokeWidth={1.5} aria-hidden />
            <span className="max-sm:sr-only">{library.selection.delete}</span>
          </button>
          <Button variant="ghost" size="sm" aria-label={library.selection.clear} onClick={onClear}>
            <X className="size-4" strokeWidth={1.5} aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}
