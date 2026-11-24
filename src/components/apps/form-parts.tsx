"use client";

import { FolderOpen, Upload, X } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import useSWR from "swr";
import { AspectGlyph } from "@/components/studio";
import { appCopy } from "@/content/apps";
import { api, errorMessage, fetcher, type Asset } from "@/lib/api";
import type { Control } from "@/registry";
import { Popover, PopoverContent, PopoverTrigger, Spinner, Switch, cn } from "@/ui";
import type { AppField, AppInput, FieldValue } from "./types";

export const panel = "rounded-2xl bg-[#131517] shadow-[#FFFFFF05_2px_2px_2px_inset]";
const box =
  "w-full rounded-xl bg-[#FFFFFF0A] px-3 text-sm leading-5 text-text-primary outline-none transition-colors duration-150 placeholder:text-[#FFFFFF66] hover:bg-[#FFFFFF0F] focus:bg-[#FFFFFF14]";
const chip = (on: boolean) =>
  cn(
    "flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg px-3 text-sm leading-5 font-medium transition-colors duration-150",
    on ? "bg-[#2E3031] text-text-soft shadow-[#0000000D_0px_1px_2px]" : "bg-[#FFFFFF0A] text-[#FFFFFF99] hover:bg-border-default hover:text-text-primary",
  );

export function Row({ label, hint, htmlFor, extra, children }: { label: string; hint?: string | null; htmlFor?: string; extra?: ReactNode; children: ReactNode }) {
  const Label = htmlFor ? "label" : "p";
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={htmlFor} className="text-sm leading-5 font-medium text-text-primary">
          {label}
        </Label>
        {extra}
      </div>
      {children}
      {hint ? <p className="text-xs leading-4 text-text-secondary">{hint}</p> : null}
    </div>
  );
}

function Chips({ label, options, value, onChange, glyph }: { label: string; options: { value: string; label: string }[]; value: string; onChange: (v: string) => void; glyph?: boolean }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)} className={chip(value === o.value)}>
          {glyph ? <AspectGlyph value={o.value} /> : null}
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Slider({ id, min, max, step, value, unit, onChange }: { id: string; min: number; max: number; step: number; value: number; unit?: string; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-3">
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-1 min-w-0 flex-1 cursor-pointer accent-brand" />
      <span className="w-14 shrink-0 text-right font-mono text-xs leading-4 text-text-primary tabular-nums">
        {value}
        {unit ? ` ${unit}` : ""}
      </span>
    </div>
  );
}

export function FieldInput({ field, value, onChange }: { field: AppField; value: FieldValue | undefined; onChange: (v: FieldValue) => void }) {
  const id = `field-${field.id}`;
  switch (field.type) {
    case "text": {
      const text = String(value ?? "");
      const extra = (
        <span className="text-xs leading-4 text-text-tertiary">
          {field.required ? null : `${appCopy.optional} · `}
          {text.length}/{field.maxLength}
        </span>
      );
      return (
        <Row label={field.label} hint={field.hint} htmlFor={id} extra={extra}>
          {field.maxLength > 200 ? (
            <textarea id={id} value={text} maxLength={field.maxLength} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} rows={3} className={cn(box, "resize-none py-[10px]")} />
          ) : (
            <input id={id} type="text" value={text} maxLength={field.maxLength} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} className={cn(box, "h-10")} />
          )}
        </Row>
      );
    }
    case "choice": {
      const v = String(value ?? field.default);
      if (field.options.length > 6) {
        return (
          <Row label={field.label} hint={field.hint} htmlFor={id}>
            <select id={id} value={v} onChange={(e) => onChange(e.target.value)} className={cn(box, "h-10 cursor-pointer appearance-auto bg-surface-field")}>
              {field.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Row>
        );
      }
      return (
        <Row label={field.label} hint={field.hint}>
          <Chips label={field.label} options={field.options} value={v} onChange={onChange} />
        </Row>
      );
    }
    case "number":
      return (
        <Row label={field.label} hint={field.hint} htmlFor={id}>
          <Slider id={id} min={field.min} max={field.max} step={field.step} value={Number(value ?? field.default)} unit={field.unit} onChange={onChange} />
        </Row>
      );
    case "colour": {
      const v = String(value ?? field.default);
      return (
        <Row label={field.label} hint={field.hint} htmlFor={id}>
          <div className="flex items-center gap-3">
            <input id={id} type="color" value={v} onChange={(e) => onChange(e.target.value)} aria-label={`${field.label}: ${appCopy.pickColour}`} className="h-10 w-14 cursor-pointer rounded-lg border border-border-default bg-transparent p-1" />
            <span className="font-mono text-xs leading-4 text-text-primary uppercase">{v}</span>
          </div>
        </Row>
      );
    }
  }
}

export function ControlInput({ control, value, onChange }: { control: Control; value: FieldValue | undefined; onChange: (v: FieldValue) => void }) {
  const id = `control-${control.id}`;
  switch (control.type) {
    case "select": {
      const v = String(value ?? control.default);
      if (control.display === "menu" || control.options.length > 8) {
        return (
          <Row label={control.label} hint={control.hint} htmlFor={id}>
            <select id={id} value={v} onChange={(e) => onChange(e.target.value)} className={cn(box, "h-10 cursor-pointer bg-surface-field")}>
              {control.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Row>
        );
      }
      return (
        <Row label={control.label} hint={control.hint}>
          <Chips label={control.label} options={control.options} value={v} onChange={onChange} glyph={control.display === "aspect"} />
        </Row>
      );
    }
    case "slider":
      return (
        <Row label={control.label} hint={control.hint} htmlFor={id}>
          <Slider id={id} min={control.min} max={control.max} step={control.step} value={Number(value ?? control.default)} unit={control.unit} onChange={onChange} />
        </Row>
      );
    case "toggle":
      return (
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-[2px]">
            <span className="text-sm leading-5 font-medium text-text-primary">{control.label}</span>
            {control.hint ? <span className="text-xs leading-4 text-text-secondary">{control.hint}</span> : null}
          </div>
          <Switch aria-label={control.label} checked={Boolean(value ?? control.default)} onCheckedChange={(on) => onChange(on)} />
        </div>
      );
    case "text":
      return (
        <Row label={control.label} hint={control.hint} htmlFor={id}>
          <input id={id} type="text" value={String(value ?? control.default)} maxLength={control.maxLength} placeholder={control.placeholder} onChange={(e) => onChange(e.target.value)} className={cn(box, "h-10")} />
        </Row>
      );
  }
}

/** A still for a file: its poster or itself, or the kind's name for sound. */
export function Thumb({ asset, className }: { asset: Asset; className?: string }) {
  if (asset.kind === "audio") {
    return <div className={cn("flex items-center justify-center bg-surface-tertiary text-2xs text-text-secondary uppercase", className)}>{asset.kind}</div>;
  }
  if (asset.kind === "video" && !asset.posterUrl) {
    return <video src={asset.url} muted preload="metadata" className={cn("object-cover", className)} />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={asset.posterUrl ?? asset.url} alt={asset.title || ""} loading="lazy" className={cn("object-cover", className)} />;
}

function Library({ input, onPick, taken }: { input: AppInput; onPick: (a: Asset) => void; taken: string[] }) {
  const kind = input.accept.length === 1 ? `&kind=${input.accept[0]}` : "";
  const { data, error, isLoading } = useSWR<{ assets: Asset[] }>(`/api/assets?limit=30${kind}`, fetcher);
  const fitting = (data?.assets ?? []).filter((a) => input.accept.includes(a.kind) && !taken.includes(a.id));
  return (
    <div className="flex w-[280px] flex-col gap-2 p-2">
      <p className="px-1 text-xs leading-4 font-medium text-text-secondary">{appCopy.fromFiles}</p>
      {error ? (
        <p className="px-1 text-sm leading-5 text-danger">{errorMessage(error)}</p>
      ) : isLoading ? (
        <div className="grid grid-cols-4 gap-1">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="shimmer aspect-square rounded-md bg-surface-secondary" />
          ))}
        </div>
      ) : fitting.length === 0 ? (
        <p className="px-1 pb-1 text-sm leading-5 text-text-primary">{appCopy.noFiles}</p>
      ) : (
        <ul aria-label={appCopy.fromFiles} className="grid max-h-[240px] grid-cols-4 gap-1 overflow-y-auto scroll-quiet">
          {fitting.map((a) => (
            <li key={a.id}>
              <button type="button" onClick={() => onPick(a)} aria-label={`Use ${a.title || a.kind}`} className="block aspect-square w-full overflow-clip rounded-md transition-opacity duration-150 hover:opacity-80">
                <Thumb asset={a} className="size-full" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function InputTile({
  input,
  files,
  onChange,
  needSession,
}: {
  input: AppInput;
  files: Asset[];
  onChange: (files: Asset[]) => void;
  /** Asks the visitor to sign in; returns false when there is no session yet. */
  needSession: () => boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const full = files.length >= input.max;

  async function upload(list: FileList | null) {
    if (!list || list.length === 0) return;
    setProblem(null);
    setBusy(true);
    let next = files;
    try {
      for (const file of Array.from(list).slice(0, input.max - files.length)) {
        const form = new FormData();
        form.append("file", file);
        form.append("accept", input.accept.join(","));
        const { asset } = await api<{ asset: Asset }>("/api/assets", { method: "POST", body: form });
        next = [...next, asset];
        onChange(next);
      }
    } catch (e) {
      setProblem(errorMessage(e));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const accept = input.accept.map((k) => `${k}/*`).join(",");
  return (
    <div className="flex min-w-0 flex-col gap-2" data-input={input.id}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm leading-5 font-medium text-text-primary">{input.label}</p>
        <span className="text-xs leading-4 text-text-tertiary">
          {input.min === 0 ? `${appCopy.optional} · ` : null}
          {files.length}/{input.max}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {files.map((a) => (
          <div key={a.id} className="group relative size-[72px] overflow-clip rounded-xl bg-surface-secondary">
            <Thumb asset={a} className="size-full" />
            <button
              type="button"
              aria-label={appCopy.remove(input.label)}
              onClick={() => onChange(files.filter((f) => f.id !== a.id))}
              className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-md bg-[#00000099] text-text-primary hover:bg-[#000000CC]"
            >
              <X className="size-3.5" strokeWidth={1.5} aria-hidden />
            </button>
          </div>
        ))}
        {busy ? (
          <div className="shimmer flex size-[72px] items-center justify-center rounded-xl bg-surface-secondary">
            <Spinner label={appCopy.uploading} className="text-text-tab" />
          </div>
        ) : null}
        {!full ? (
          <div className="flex min-w-0 flex-1 gap-2">
            <button
              type="button"
              onClick={() => needSession() && fileRef.current?.click()}
              disabled={busy}
              className="flex h-[72px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border-strong text-sm leading-5 font-medium text-text-primary transition-colors duration-150 hover:bg-border-subtle disabled:opacity-40"
            >
              <Upload className="size-4" strokeWidth={1.5} aria-hidden />
              {appCopy.upload}
            </button>
            <Popover open={open} onOpenChange={(o) => setOpen(o && needSession())}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label={`${appCopy.fromFiles}: ${input.label}`}
                  className="flex h-[72px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl bg-[#FFFFFF0A] text-sm leading-5 font-medium text-text-primary transition-colors duration-150 hover:bg-border-default"
                >
                  <FolderOpen className="size-4" strokeWidth={1.5} aria-hidden />
                  {appCopy.fromFiles}
                </button>
              </PopoverTrigger>
              <PopoverContent look="panel" align="start">
                <Library
                  input={input}
                  taken={files.map((f) => f.id)}
                  onPick={(a) => {
                    const next = [...files, a];
                    onChange(next);
                    if (next.length >= input.max) setOpen(false);
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>
        ) : null}
      </div>
      <input ref={fileRef} type="file" accept={accept} multiple={input.max - files.length > 1} hidden aria-hidden onChange={(e) => void upload(e.target.files)} data-upload={input.id} />
      {input.hint ? <p className="text-xs leading-4 text-text-secondary">{input.hint}</p> : null}
      {problem ? (
        <p role="alert" className="text-xs leading-4 text-danger">
          {problem}
        </p>
      ) : null}
    </div>
  );
}
