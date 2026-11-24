"use client";

import { Folder as FolderIcon, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { library } from "@/content/library";
import { api, errorMessage } from "@/lib/api";
import { Button, Dialog, DialogContent, MenuItem, Popover, PopoverContent, PopoverTrigger } from "@/ui";
import { BOX, ConfirmDialog, EmptyState, ErrorLine, PanelHeader } from "./common";
import { formatBytes, refreshLibrary, type Folder } from "./data";

const words = library.folders;

/** Asks for a folder name, to create one or rename one. */
export function FolderNameDialog({
  open,
  onOpenChange,
  folder,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  folder?: Folder;
  onSaved?: (f: Folder) => void;
}) {
  const [name, setName] = useState(folder?.name ?? "");
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (o) {
          setName(folder?.name ?? "");
          setProblem(null);
        }
      }}
    >
      <DialogContent title={folder ? words.rename : words.create} className="max-w-[420px]">
        <form
          className="flex flex-col gap-4 p-6 pt-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setProblem(null);
            try {
              const r = await api<{ folder: Folder }>(folder ? `/api/folders/${folder.id}` : "/api/folders", {
                method: folder ? "PATCH" : "POST",
                body: { name },
              });
              await refreshLibrary();
              onSaved?.(r.folder);
              onOpenChange(false);
              setName("");
            } catch (err) {
              setProblem(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="flex flex-col gap-2 text-xs leading-4 font-medium text-text-secondary">
            {words.name}
            <input
              autoFocus
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              className="h-10 rounded-lg bg-surface-field px-3 text-sm leading-5 text-text-primary outline-none"
            />
          </label>
          {problem ? <ErrorLine message={problem} /> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="md" onClick={() => onOpenChange(false)}>
              {words.cancel}
            </Button>
            <Button type="submit" variant="lime" size="md" disabled={busy || !name.trim()}>
              {words.save}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Rename and delete for one folder, behind a "…" button. */
export function FolderMenu({ folder, onDeleted, label }: { folder: Folder; onDeleted?: () => void; label?: boolean }) {
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  return (
    <>
      <Popover>
        <PopoverTrigger className={label ? BOX : "flex size-7 items-center justify-center rounded-md text-text-secondary transition-colors duration-150 hover:bg-border-default hover:text-text-primary"} aria-label={`${folder.name}: options`}>
          <MoreHorizontal className="size-4" strokeWidth={1.5} aria-hidden />
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[200px]">
          <MenuItem icon={<Pencil className="size-4" strokeWidth={1.5} />} onClick={() => setRenaming(true)}>
            {words.rename}
          </MenuItem>
          <MenuItem icon={<Trash2 className="size-4" strokeWidth={1.5} />} onClick={() => setDeleting(true)}>
            {words.delete}
          </MenuItem>
        </PopoverContent>
      </Popover>
      <FolderNameDialog open={renaming} onOpenChange={setRenaming} folder={folder} />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={words.delete}
        body={words.deleteAsk(folder.name)}
        onConfirm={async () => {
          await api(`/api/folders/${folder.id}`, { method: "DELETE" });
          await refreshLibrary();
          onDeleted?.();
        }}
      />
    </>
  );
}

export function FolderList({
  folders,
  loading,
  error,
  onRetry,
  onOpen,
}: {
  folders: Folder[];
  loading: boolean;
  error?: unknown;
  onRetry: () => void;
  onOpen: (id: string) => void;
}) {
  const [creating, setCreating] = useState(false);
  return (
    <>
      <PanelHeader title={words.title}>
        <button type="button" className={BOX} onClick={() => setCreating(true)}>
          <Plus className="size-4" strokeWidth={1.5} aria-hidden />
          {words.create}
        </button>
      </PanelHeader>
      <div className="-mx-[15px] min-h-0 flex-1 overflow-y-auto px-[15px] pt-[18px] scroll-quiet">
        {error ? (
          <ErrorLine message={errorMessage(error)} onRetry={onRetry} />
        ) : loading ? (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4" aria-hidden>
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="shimmer h-[92px] rounded-xl bg-surface-secondary" />
            ))}
          </div>
        ) : folders.length === 0 ? (
          <EmptyState
            line={words.empty}
            action={
              <Button variant="lime" size="sm" onClick={() => setCreating(true)}>
                {words.create}
              </Button>
            }
          />
        ) : (
          <ul aria-label={words.title} className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {folders.map((f) => (
              <li key={f.id} className="group relative flex items-start gap-3 rounded-xl bg-surface-secondary p-3 transition-colors duration-150 hover:bg-surface-secondary-strong">
                <button type="button" onClick={() => onOpen(f.id)} className="absolute inset-0 rounded-xl" aria-label={f.name} />
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-border-subtle">
                  <FolderIcon className="size-5" strokeWidth={1.5} aria-hidden />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1 pt-0.5">
                  <span className="truncate text-sm leading-5 font-medium text-text-primary">{f.name}</span>
                  <span className="text-xs leading-4 text-text-secondary">
                    {words.files(f.count)} · {formatBytes(f.bytes)}
                  </span>
                </span>
                <span className="relative z-[1]">
                  <FolderMenu folder={f} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <FolderNameDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}
