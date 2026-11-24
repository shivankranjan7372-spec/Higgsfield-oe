"use client";

import { MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { library } from "@/content/library";
import { api, errorMessage, fetcher } from "@/lib/api";
import { Button, cn, Dialog, DialogContent, MenuItem, Popover, PopoverContent, PopoverTrigger } from "@/ui";
import { BOX, ConfirmDialog, EmptyState, ErrorLine, PanelHeader } from "./common";
import { refreshLibrary, type ElementType, type LibElement, type LibraryPage } from "./data";

const words = library.elements;
type TypeId = (typeof words.types)[number]["id"];

interface ElementsPage {
  elements: LibElement[];
  total: number;
  counts: Record<TypeId, number>;
}

export function ElementsView() {
  const [type, setType] = useState<TypeId>("all");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<LibElement | "new" | null>(null);
  const [deleting, setDeleting] = useState<LibElement | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setQuery(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  const key = `/api/elements?type=${type}&sort=recent&limit=200${query ? `&q=${encodeURIComponent(query)}` : ""}`;
  const { data, error, isLoading, mutate } = useSWR<ElementsPage>(key, fetcher);

  return (
    <>
      <PanelHeader title={words.title}>
        <label className={cn(BOX, "w-full focus-within:bg-border-subtle sm:w-[184px]")}>
          <Search className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={library.search.placeholder}
            aria-label={words.search}
            maxLength={200}
            className="min-w-0 flex-1 bg-transparent text-sm leading-5 font-medium text-text-primary outline-none placeholder:text-text-primary"
          />
        </label>
        <button type="button" className={BOX} onClick={() => setEditing("new")}>
          <Plus className="size-4" strokeWidth={1.5} aria-hidden />
          {words.create}
        </button>
      </PanelHeader>

      <div role="tablist" aria-label={words.title} className="flex shrink-0 gap-1 overflow-x-auto pt-[18px] pb-[14px] scroll-none">
        {words.types.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={type === t.id}
            onClick={() => setType(t.id)}
            className={cn(
              "flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3 text-sm leading-5 font-medium transition-colors duration-150",
              type === t.id ? "bg-border-default text-text-primary" : "text-text-tab hover:bg-border-subtle hover:text-text-primary",
            )}
          >
            {t.label}
            {data ? <span className="text-2xs leading-[14px] font-semibold text-text-muted">{data.counts[t.id] ?? 0}</span> : null}
          </button>
        ))}
      </div>

      <div className="-mx-[15px] min-h-0 flex-1 overflow-y-auto px-[15px] pb-6 scroll-quiet">
        {error ? (
          <ErrorLine message={errorMessage(error)} onRetry={() => void mutate()} />
        ) : isLoading && !data ? (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4" aria-hidden>
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="shimmer aspect-[4/5] rounded-xl bg-surface-secondary" />
            ))}
          </div>
        ) : !data || data.elements.length === 0 ? (
          <EmptyState
            line={query ? library.empty.filtered.line : `${words.intro} ${words.empty}`}
            action={
              <Button variant="lime" size="sm" onClick={() => setEditing("new")}>
                {words.create}
              </Button>
            }
          />
        ) : (
          <ul aria-label={words.title} className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-5">
            {data.elements.map((el) => (
              <li key={el.id} className="group relative flex flex-col overflow-hidden rounded-xl bg-surface-secondary transition-colors duration-150 hover:bg-surface-secondary-strong">
                <button type="button" className="absolute inset-0 z-[1] rounded-xl" aria-label={`${words.edit}: ${el.name}`} onClick={() => setEditing(el)} />
                <div className="relative aspect-square bg-[#222222]">
                  {el.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={el.cover.url} alt="" loading="lazy" className="size-full object-cover" />
                  ) : null}
                  <span className="absolute top-2 left-2 rounded-sm bg-scrim px-[6px] text-2xs leading-[18px] font-semibold text-text-primary">
                    {words.types.find((t) => t.id === el.type)?.label}
                  </span>
                </div>
                <div className="flex items-start gap-2 p-3">
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm leading-5 font-medium text-text-primary">{el.name}</span>
                    <span className="truncate text-xs leading-4 text-text-secondary">
                      {words.pictures(el.assetIds.length)} · {words.used(el.useCount)}
                    </span>
                  </div>
                  <Popover>
                    <PopoverTrigger
                      aria-label={`${el.name}: options`}
                      className="relative z-[2] flex size-7 shrink-0 items-center justify-center rounded-md text-text-secondary hover:bg-border-default hover:text-text-primary"
                    >
                      <MoreHorizontal className="size-4" strokeWidth={1.5} aria-hidden />
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-[200px]">
                      <MenuItem icon={<Pencil className="size-4" strokeWidth={1.5} />} onClick={() => setEditing(el)}>
                        {words.edit}
                      </MenuItem>
                      <MenuItem icon={<Trash2 className="size-4" strokeWidth={1.5} />} onClick={() => setDeleting(el)}>
                        {words.delete}
                      </MenuItem>
                    </PopoverContent>
                  </Popover>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ElementDialog element={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => (o ? null : setDeleting(null))}
        title={words.delete}
        body={deleting ? words.deleteAsk(deleting.name) : ""}
        onConfirm={async () => {
          if (!deleting) return;
          await api(`/api/elements/${deleting.id}`, { method: "DELETE" });
          await refreshLibrary();
        }}
      />
    </>
  );
}

function ElementDialog({ element, onClose }: { element: LibElement | "new" | null; onClose: () => void }) {
  const open = element !== null;
  const editing = element && element !== "new" ? element : null;
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      {open ? (
        <DialogContent title={editing ? words.edit : words.create} className="max-w-[640px]">
          <ElementForm key={editing?.id ?? "new"} element={editing} onDone={onClose} />
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function ElementForm({ element, onDone }: { element: LibElement | null; onDone: () => void }) {
  const [type, setType] = useState<ElementType>(element?.type ?? "character");
  const [name, setName] = useState(element?.name ?? "");
  const [description, setDescription] = useState(element?.description ?? "");
  const [tags, setTags] = useState(element?.tags.join(", ") ?? "");
  const [ids, setIds] = useState<string[]>(element?.assetIds ?? []);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pics = useSWR<LibraryPage>("/api/library?kind=image&limit=200", fetcher);
  const field = "rounded-lg bg-surface-field px-3 text-sm leading-5 text-text-primary outline-none";

  return (
    <form
      className="flex flex-col gap-4 p-6 pt-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setProblem(null);
        try {
          const body = {
            type,
            name,
            description,
            tags: tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean),
            assetIds: ids,
          };
          await api(element ? `/api/elements/${element.id}` : "/api/elements", { method: element ? "PATCH" : "POST", body });
          await refreshLibrary();
          onDone();
        } catch (err) {
          setProblem(errorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
        <label className="flex flex-col gap-2 text-xs leading-4 font-medium text-text-secondary">
          {words.fields.type}
          <select value={type} onChange={(e) => setType(e.target.value as ElementType)} className={cn(field, "h-10")}>
            {words.types
              .filter((t) => t.id !== "all")
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-xs leading-4 font-medium text-text-secondary">
          {words.fields.name}
          <input required value={name} maxLength={60} onChange={(e) => setName(e.target.value)} className={cn(field, "h-10")} />
        </label>
      </div>
      <label className="flex flex-col gap-2 text-xs leading-4 font-medium text-text-secondary">
        {words.fields.description}
        <textarea value={description} maxLength={1000} rows={2} onChange={(e) => setDescription(e.target.value)} className={cn(field, "resize-none py-2")} />
      </label>
      <label className="flex flex-col gap-2 text-xs leading-4 font-medium text-text-secondary">
        {words.fields.tags}
        <input value={tags} onChange={(e) => setTags(e.target.value)} className={cn(field, "h-10")} />
      </label>
      <fieldset className="flex flex-col gap-2">
        <legend className="pb-2 text-xs leading-4 font-medium text-text-secondary">
          {words.fields.pictures} · {ids.length}/12
        </legend>
        {pics.error ? (
          <ErrorLine message={errorMessage(pics.error)} onRetry={() => void pics.mutate()} />
        ) : !pics.data ? (
          <div className="shimmer h-24 rounded-lg bg-surface-secondary-strong" />
        ) : pics.data.assets.length === 0 ? (
          <p className="text-sm leading-5 text-text-secondary">{words.noPictures}</p>
        ) : (
          <ul className="grid max-h-[240px] grid-cols-4 gap-1 overflow-y-auto scroll-quiet sm:grid-cols-6">
            {pics.data.assets.map((a) => {
              const at = ids.indexOf(a.id);
              return (
                <li key={a.id} className="relative aspect-square">
                  <button
                    type="button"
                    aria-pressed={at >= 0}
                    aria-label={a.prompt || a.title || "Picture"}
                    onClick={() => setIds((p) => (at >= 0 ? p.filter((x) => x !== a.id) : p.length >= 12 ? p : [...p, a.id]))}
                    className={cn("size-full overflow-hidden rounded-md", at >= 0 && "outline-2 -outline-offset-2 outline-brand")}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.url} alt="" loading="lazy" className="size-full object-cover" />
                  </button>
                  {at >= 0 ? (
                    <span className="pointer-events-none absolute top-1 left-1 flex size-5 items-center justify-center rounded-full bg-brand text-2xs leading-3 font-bold text-ink">{at + 1}</span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </fieldset>
      {problem ? <ErrorLine message={problem} /> : null}
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="md" onClick={onDone}>
          {library.cancel}
        </Button>
        <Button type="submit" variant="lime" size="md" disabled={busy || !name.trim() || ids.length === 0}>
          {words.save}
        </Button>
      </div>
    </form>
  );
}
