"use client";

/* eslint-disable @next/next/no-img-element */
import { Check, ImagePlus, LoaderCircle, MapPin, Package, Trash2, User } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import useSWR from "swr";
import { cinema } from "@/content/cinema";
import { api, fetcher, type Asset } from "@/lib/api";
import { Button, Dialog, DialogContent, MenuLabel, Popover, PopoverContent, PopoverTrigger, cn } from "@/ui";
import { refreshProject, type CinemaElement, type ElementKind } from "./data";
import { useCinema } from "./state";

const t = cinema.cast;
const KINDS: ElementKind[] = ["character", "location", "prop"];
const KIND_ICON = { character: User, location: MapPin, prop: Package } as const;

function ElementThumb({ element, size = "size-8" }: { element: CinemaElement; size?: string }) {
  const Icon = KIND_ICON[element.kind];
  const ref = element.refs[0];
  return (
    <span className={cn("flex shrink-0 items-center justify-center overflow-clip rounded-md bg-surface-field", size)}>
      {ref ? <img src={ref.url} alt="" className="size-full object-cover" /> : <Icon className="size-4 text-text-secondary" strokeWidth={1.5} aria-hidden />}
    </span>
  );
}

/** The popover that attaches cast, props and a place to the open shot. */
export function CastPicker({ trigger }: { trigger: ReactNode }) {
  const { board, fields, patchShot, setCastOpen, project } = useCinema();
  const elements = board.data?.elements ?? [];
  const people = elements.filter((e) => e.kind !== "location");
  const places = elements.filter((e) => e.kind === "location");

  function toggle(id: string) {
    const has = fields.castIds.includes(id);
    void patchShot({ castIds: has ? fields.castIds.filter((x) => x !== id) : [...fields.castIds, id] });
  }

  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent look="panel" className="scroll-quiet flex max-h-[min(460px,70dvh)] w-[min(320px,calc(100vw-16px))] flex-col gap-2 overflow-y-auto p-2">
        {!project ? (
          <p className="px-2 py-3 text-sm leading-5 text-text-secondary">{t.needProject}</p>
        ) : (
          <>
            <MenuLabel>{t.castAndProps}</MenuLabel>
            {people.length === 0 ? <p className="px-2 text-xs leading-4 text-text-tertiary">{t.empty}</p> : null}
            {people.map((e) => {
              const on = fields.castIds.includes(e.id);
              return (
                <button
                  key={e.id}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={on}
                  onClick={() => toggle(e.id)}
                  className={cn("flex h-11 items-center gap-2 rounded-md px-2 text-left transition-colors duration-150 hover:bg-border-subtle", on && "bg-border-subtle")}
                >
                  <ElementThumb element={e} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm leading-5 font-medium text-text-primary">{e.name}</span>
                    <span className="truncate text-xs leading-4 text-text-secondary">{t.kinds[e.kind]}</span>
                  </span>
                  {on ? <Check className="size-4 shrink-0 text-brand" strokeWidth={1.5} aria-hidden /> : null}
                </button>
              );
            })}
            <MenuLabel>{t.place}</MenuLabel>
            {[null, ...places].map((e) => {
              const on = fields.locationId === (e?.id ?? null);
              return (
                <button
                  key={e?.id ?? "none"}
                  type="button"
                  role="menuitemradio"
                  aria-checked={on}
                  onClick={() => void patchShot({ locationId: e?.id ?? null })}
                  className={cn("flex h-11 items-center gap-2 rounded-md px-2 text-left transition-colors duration-150 hover:bg-border-subtle", on && "bg-border-subtle")}
                >
                  {e ? (
                    <ElementThumb element={e} />
                  ) : (
                    <span className="flex size-8 items-center justify-center rounded-md bg-surface-field">
                      <MapPin className="size-4 text-text-tertiary" strokeWidth={1.5} aria-hidden />
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm leading-5 font-medium text-text-primary">{e?.name ?? t.noLocation}</span>
                  {on ? <Check className="size-4 shrink-0 text-brand" strokeWidth={1.5} aria-hidden /> : null}
                </button>
              );
            })}
            <Button variant="soft" size="sm" className="mt-1" onClick={() => setCastOpen(true)}>
              {t.manage}
            </Button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

function NewElement({ projectId, onDone }: { projectId: string; onDone: () => void }) {
  const { report } = useCinema();
  const [kind, setKind] = useState<ElementKind>("character");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [picked, setPicked] = useState<{ id: string; url: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const images = useSWR<{ assets: Asset[] }>("/api/assets?kind=image&limit=24", fetcher);

  function togglePick(a: { id: string; url: string }) {
    setPicked((p) => (p.some((x) => x.id === a.id) ? p.filter((x) => x.id !== a.id) : p.length >= 8 ? p : [...p, a]));
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setProblem(null);
    try {
      for (const f of Array.from(files).slice(0, 8 - picked.length)) {
        const form = new FormData();
        form.append("file", f);
        form.append("accept", "image");
        const { asset } = await api<{ asset: Asset }>("/api/assets", { method: "POST", body: form });
        setPicked((p) => [...p, { id: asset.id, url: asset.url }]);
      }
      void images.mutate();
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
      if (file.current) file.current.value = "";
    }
  }

  async function save() {
    setSaving(true);
    setProblem(null);
    try {
      await api(`/api/cinema/projects/${projectId}/elements`, {
        method: "POST",
        body: { kind, name: name.trim(), description: description.trim(), refAssetIds: picked.map((p) => p.id) },
      });
      refreshProject(projectId);
      onDone();
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e));
      report(e);
    } finally {
      setSaving(false);
    }
  }

  const fieldClass = "rounded-lg bg-surface-field px-3 text-sm leading-5 text-text-primary outline-none placeholder:text-text-muted";

  return (
    <form
      className="flex flex-col gap-4 rounded-2xl bg-border-subtle p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div role="radiogroup" aria-label={t.kindLabel} className="flex gap-1">
        {KINDS.map((k) => {
          const Icon = KIND_ICON[k];
          return (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => setKind(k)}
              className={cn(
                "flex h-8 items-center gap-1 rounded-md px-3 text-xs leading-4 font-medium transition-colors duration-150",
                kind === k ? "bg-brand-tint text-brand" : "bg-border-subtle text-text-primary hover:bg-border-default",
              )}
            >
              <Icon className="size-4" strokeWidth={1.5} aria-hidden />
              {t.kinds[k]}
            </button>
          );
        })}
      </div>
      <label className="flex flex-col gap-1 text-xs leading-4 font-medium text-text-secondary">
        {t.nameLabel}
        <input value={name} maxLength={80} required placeholder={t.namePlaceholder} onChange={(e) => setName(e.target.value)} className={cn(fieldClass, "h-10")} />
      </label>
      <label className="flex flex-col gap-1 text-xs leading-4 font-medium text-text-secondary">
        {t.descLabel}
        <textarea value={description} maxLength={1000} rows={2} placeholder={t.descPlaceholder} onChange={(e) => setDescription(e.target.value)} className={cn(fieldClass, "resize-none py-2")} />
      </label>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs leading-4 font-medium text-text-secondary">
            {t.picsLabel} {picked.length}/8
          </span>
          <Button variant="soft" size="sm" disabled={uploading || picked.length >= 8} onClick={() => file.current?.click()}>
            {uploading ? <LoaderCircle className="size-4 animate-spin" strokeWidth={1.5} aria-hidden /> : <ImagePlus className="size-4" strokeWidth={1.5} aria-hidden />}
            {uploading ? t.uploading : t.upload}
          </Button>
          <input ref={file} type="file" accept="image/*" multiple hidden onChange={(e) => void upload(e.target.files)} aria-label={t.upload} />
        </div>
        <span className="text-xs leading-4 text-text-tertiary">{t.yourImages}</span>
        {images.data?.assets.length ? (
          <ul className="grid grid-cols-4 gap-1 sm:grid-cols-6">
            {images.data.assets.map((a) => {
              const on = picked.some((p) => p.id === a.id);
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    aria-label={a.title || a.prompt || a.id}
                    onClick={() => togglePick({ id: a.id, url: a.url })}
                    className={cn("relative block aspect-square w-full overflow-clip rounded-md border-2", on ? "border-brand" : "border-transparent hover:border-border-strong")}
                  >
                    <img src={a.url} alt="" loading="lazy" className="size-full object-cover" />
                    {on ? (
                      <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-brand text-ink">
                        <Check className="size-3" strokeWidth={2} aria-hidden />
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-xs leading-4 text-text-tertiary">{t.noImages}</p>
        )}
      </div>
      {problem ? (
        <p role="alert" className="text-sm leading-5 text-danger">
          {problem}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button variant="soft" size="md" onClick={onDone}>
          {cinema.sidebar.cancel}
        </Button>
        <Button variant="lime" size="md" type="submit" disabled={saving || !name.trim()}>
          {t.save}
        </Button>
      </div>
    </form>
  );
}

/** The window that lists a project's cast, places and props and makes new ones. */
export function CastDialog() {
  const { castOpen, setCastOpen, board, project, report } = useCinema();
  const [creating, setCreating] = useState(false);
  const elements = board.data?.elements ?? [];

  async function remove(id: string) {
    try {
      await api(`/api/cinema/elements/${id}`, { method: "DELETE" });
      refreshProject(project?.id ?? null);
    } catch (e) {
      report(e);
    }
  }

  return (
    <Dialog
      open={castOpen}
      onOpenChange={(o) => {
        setCastOpen(o);
        if (!o) setCreating(false);
      }}
    >
      <DialogContent title={t.title} className="max-w-[640px]">
        <div className="flex flex-col gap-4 p-6 pt-3">
          <p className="text-sm leading-5 text-text-secondary">{t.intro}</p>
          {!project ? (
            <p className="text-sm leading-5 text-text-secondary">{t.needProject}</p>
          ) : creating ? (
            <NewElement projectId={project.id} onDone={() => setCreating(false)} />
          ) : (
            <Button variant="lime" size="md" className="self-start" onClick={() => setCreating(true)}>
              <ImagePlus className="size-4" strokeWidth={1.5} aria-hidden />
              {t.create}
            </Button>
          )}
          {KINDS.map((k) => {
            const list = elements.filter((e) => e.kind === k);
            return (
              <section key={k} className="flex flex-col gap-2">
                <h3 className="text-xs leading-4 font-medium text-text-tab">{t.kindsPlural[k]}</h3>
                {list.length === 0 ? (
                  <p className="text-xs leading-4 text-text-tertiary">{t.empty}</p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {list.map((e) => (
                      <li key={e.id} className="flex items-center gap-3 rounded-xl bg-border-subtle p-2">
                        <ElementThumb element={e} size="size-12" />
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-sm leading-5 font-medium text-text-primary">{e.name}</span>
                          <span className="line-clamp-2 text-xs leading-4 text-text-secondary">{e.description || " "}</span>
                        </div>
                        <button
                          type="button"
                          aria-label={`${t.remove}: ${e.name}`}
                          onClick={() => void remove(e.id)}
                          className="flex size-8 shrink-0 items-center justify-center rounded-md text-text-secondary transition-colors duration-150 hover:bg-border-default hover:text-danger"
                        >
                          <Trash2 className="size-4" strokeWidth={1.5} aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

