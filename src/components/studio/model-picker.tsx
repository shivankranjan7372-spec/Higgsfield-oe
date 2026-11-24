"use client";

import { Check, ChevronRight, LayoutGrid, Search, Sparkles } from "lucide-react";
import { useState, type KeyboardEvent, type ReactNode } from "react";
import { VendorGlyph } from "@/components/brand/logo";
import type { Studio } from "@/lib/studio";
import type { ModelDef } from "@/registry";
import { Popover, PopoverContent, PopoverTrigger, Tag, cn } from "@/ui";

function note(model: ModelDef): string {
  if (model.status === "available") return model.tagline;
  return model.statusNote ?? (model.status === "soon" ? "Coming soon" : "Offline for now");
}

function Row({ model, selected, onPick }: { model: ModelDef; selected: boolean; onPick: () => void }) {
  const open = model.status === "available";
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      disabled={!open}
      onClick={onPick}
      className={cn(
        "flex w-full items-center gap-2 rounded-xl p-[6px] text-left transition-colors duration-150 hover:bg-border-subtle focus-visible:-outline-offset-2 disabled:pointer-events-none disabled:opacity-50",
        selected && "bg-border-subtle",
      )}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-border-subtle [box-shadow:#FFFFFF08_0px_2px_3px_inset]">
        <VendorGlyph vendor={model.vendor} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center gap-1">
          <span className="truncate text-xs leading-[18px] font-medium text-text-primary">{model.name}</span>
          {(model.badges ?? []).slice(0, 2).map((badge) => (
            <Tag key={badge} tone="solid">
              {badge}
            </Tag>
          ))}
        </span>
        <span className="truncate text-2xs leading-[14px] text-text-muted">{note(model)}</span>
      </span>
      {selected ? <Check className="mr-1 size-4 shrink-0 text-brand" strokeWidth={1.5} aria-hidden /> : null}
    </button>
  );
}

function Section({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label}>
      <div className="flex h-[34px] items-center gap-[6px] text-xs leading-[18px] font-medium text-text-muted">
        {icon}
        {label}
      </div>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

/** Moves focus between the rows with the arrow keys; Home and End jump to the ends. */
function onListKey(e: KeyboardEvent<HTMLDivElement>) {
  const rows = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]:not(:disabled)'));
  const at = rows.indexOf(document.activeElement as HTMLButtonElement);
  let next = -1;
  if (e.key === "ArrowDown") next = Math.min(rows.length - 1, at + 1);
  else if (e.key === "ArrowUp") next = at - 1;
  else if (e.key === "Home") next = 0;
  else if (e.key === "End") next = rows.length - 1;
  else return;
  e.preventDefault();
  if (next < 0) e.currentTarget.parentElement?.querySelector<HTMLInputElement>("input")?.focus();
  else rows[next]?.focus();
}

/**
 * The model chip and the panel behind it: a search box, then the featured models, then the
 * rest. Models that are offline or not out yet are listed but can't be picked.
 */
export function ModelPicker({ studio }: { studio: Studio }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { model, models } = studio;

  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const found = models.filter((m) => {
    const hay = `${m.name} ${m.vendor} ${m.tagline} ${(m.badges ?? []).join(" ")}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
  const featured = found.filter((m) => m.featured);
  const rest = found.filter((m) => !m.featured);

  function pick(id: string) {
    studio.pickModel(id);
    setOpen(false);
  }

  const row = (m: ModelDef) => <Row key={m.id} model={m} selected={m.id === model?.id} onPick={() => pick(m.id)} />;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger
        aria-label={model ? `Model: ${model.name}` : "Pick a model"}
        className="inline-flex h-8 max-w-[220px] min-w-0 shrink-0 items-center gap-2 rounded-md bg-border-subtle pr-[14px] pl-3 text-text-primary transition-colors duration-150 hover:bg-border-default data-[state=open]:bg-border-default"
      >
        <span className="flex size-4 shrink-0 items-center justify-center">
          <VendorGlyph vendor={model?.vendor ?? ""} />
        </span>
        <span className="truncate text-sm leading-4 font-medium">{model?.name ?? "Pick a model"}</span>
        <ChevronRight className="size-4 shrink-0 text-text-idle" strokeWidth={1.5} aria-hidden />
      </PopoverTrigger>
      <PopoverContent
        look="panel"
        side="top"
        sideOffset={4}
        className="flex max-h-[min(642px,var(--radix-popover-content-available-height))] w-[402px] max-w-[calc(100vw-16px)] flex-col"
      >
        <span aria-hidden className="pointer-events-none absolute top-0 left-0 h-[37px] w-full rounded-[317px] bg-[#8BD5F43D] blur-[50px]" />
        <span aria-hidden className="pointer-events-none absolute top-[379px] left-0 h-[37px] w-full rounded-[317px] bg-[#8BD5F43D] blur-[50px]" />
        <label className="relative flex h-[42px] shrink-0 items-center gap-2 border-b border-[#D9D9D90A] px-3 text-[#F7F7F880]">
          <span className="flex size-6 shrink-0 items-center justify-center">
            <Search className="size-5" strokeWidth={1.5} aria-hidden />
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                e.currentTarget.closest("label")?.nextElementSibling?.querySelector<HTMLButtonElement>('[role="option"]:not(:disabled)')?.focus();
              } else if (e.key === "Enter") {
                const first = found.find((m) => m.status === "available");
                if (first) pick(first.id);
              }
            }}
            placeholder="Search..."
            aria-label="Search models"
            autoComplete="off"
            spellCheck={false}
            className="h-full min-w-0 flex-1 bg-transparent text-sm leading-5 text-text-primary outline-none placeholder:text-[#F7F7F880]"
          />
        </label>
        <div role="listbox" aria-label="Models" onKeyDown={onListKey} className="scroll-quiet relative min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          {featured.length > 0 ? (
            <Section icon={<Sparkles className="size-[14px]" strokeWidth={1.5} aria-hidden />} label="Featured models">
              {featured.map(row)}
            </Section>
          ) : null}
          {rest.length > 0 ? (
            <Section icon={<LayoutGrid className="size-[14px]" strokeWidth={1.5} aria-hidden />} label={featured.length > 0 ? "More models" : "Models"}>
              {rest.map(row)}
            </Section>
          ) : null}
          {found.length === 0 ? <p className="px-[6px] py-6 text-center text-xs leading-[18px] text-text-muted">No model matches that.</p> : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
