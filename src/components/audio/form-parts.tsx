"use client";

import { ChevronRight, Info, Minus, Plus } from "lucide-react";
import { useState } from "react";
import { VendorGlyph } from "@/components/brand/logo";
import { audioCopy } from "@/content/audio";
import type { Studio } from "@/lib/studio";
import { enabledOptions, type Control } from "@/registry";
import { MenuItem, MenuLabel, Popover, PopoverContent, PopoverTrigger, Switch, Tag, cn } from "@/ui";

type Select = Extract<Control, { type: "select" }>;
type Slider = Extract<Control, { type: "slider" }>;
type Toggle = Extract<Control, { type: "toggle" }>;
type Text = Extract<Control, { type: "text" }>;

/* The grey 12px-radius blocks the form is made of, as drawn. */
export const block = "rounded-xl bg-border-subtle";
const rowButton =
  "flex w-full items-center justify-between gap-3 rounded-xl bg-border-subtle px-3 text-left transition-colors duration-150 hover:bg-border-default data-[state=open]:bg-border-default";
const fieldLabel = "text-sm leading-5 font-medium text-text-muted";

/** The small "Optional" pill in the top right corner of a box. */
export function OptionalTag() {
  return (
    <span className="flex h-[22px] w-14 shrink-0 items-center justify-center rounded-xl bg-border-subtle text-2xs leading-[14px] font-medium text-text-muted">
      {audioCopy.optional}
    </span>
  );
}

/** The script box: what is read aloud (speech) or what the track should sound like (music). */
export function ScriptBox({ studio, label, hint, info, onSubmit }: { studio: Studio; label: string; hint: string; info: string; onSubmit: () => void }) {
  const max = studio.model?.prompt?.maxLength ?? 0;
  const length = studio.prompt.length;
  const over = max > 0 && length > max;
  const id = `script-${studio.surface}`;
  return (
    <div className={cn(block, "relative flex h-[160px] shrink-0 flex-col gap-1 border border-border-subtle px-[13px] pt-[13px] focus-within:border-border-default")}>
      <div className="flex h-5 items-center justify-between">
        <label htmlFor={id} className={fieldLabel}>
          {label}
        </label>
        <span title={info} aria-label={info} role="img" className="text-text-muted">
          <Info className="size-[18px]" strokeWidth={1.5} aria-hidden />
        </span>
      </div>
      <textarea
        id={id}
        value={studio.prompt}
        placeholder={hint}
        onChange={(e) => studio.setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onSubmit();
          }
        }}
        className="scroll-quiet h-[110px] w-full resize-none bg-transparent pb-4 text-xs leading-[18px] text-text-primary outline-none placeholder:text-text-muted"
      />
      {max > 0 ? (
        <span aria-live="polite" className={cn("absolute right-[13px] bottom-[6px] text-2xs leading-[14px] font-medium tabular-nums", over ? "text-danger" : "text-[#FFFFFF66]")}>
          {length.toLocaleString("en-US")} / {max.toLocaleString("en-US")}
        </span>
      ) : null}
    </div>
  );
}

/** The model row: "Model" over the chosen model's name, opening the list of models. */
export function ModelRow({ studio }: { studio: Studio }) {
  const [open, setOpen] = useState(false);
  const { model, models } = studio;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger aria-label={model ? `Model: ${model.name}` : "Pick a model"} className={cn(rowButton, "h-14 shrink-0")}>
        <span className="flex min-w-0 flex-col gap-[5px]">
          <span className="text-xs leading-[18px] font-medium text-text-secondary">{audioCopy.model}</span>
          <span className="flex min-w-0 items-center gap-1">
            <span className="truncate text-sm leading-5 font-medium text-text-primary">{model?.name ?? "Pick a model"}</span>
            {model ? (
              <span className="flex size-[14px] shrink-0 items-center justify-center text-brand">
                <VendorGlyph vendor={model.vendor} />
              </span>
            ) : null}
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 opacity-60" strokeWidth={1.5} aria-hidden />
      </PopoverTrigger>
      <PopoverContent look="panel" side="bottom" align="start" sideOffset={8} className="w-[320px] max-w-[calc(100vw-16px)] p-2">
        <MenuLabel>{audioCopy.model}</MenuLabel>
        <div role="listbox" aria-label="Models" className="flex flex-col gap-1">
          {models.map((m) => {
            const selected = m.id === model?.id;
            const usable = m.status === "available";
            return (
              <button
                key={m.id}
                type="button"
                role="option"
                aria-selected={selected}
                disabled={!usable}
                onClick={() => {
                  studio.pickModel(m.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-xl p-[6px] text-left transition-colors duration-150 hover:bg-border-subtle disabled:pointer-events-none disabled:opacity-50",
                  selected && "bg-border-subtle",
                )}
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-border-subtle">
                  <VendorGlyph vendor={m.vendor} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex items-center gap-1">
                    <span className="truncate text-xs leading-[18px] font-medium text-text-primary">{m.name}</span>
                    {(m.badges ?? []).slice(0, 2).map((badge) => (
                      <Tag key={badge} tone="solid">
                        {badge}
                      </Tag>
                    ))}
                  </span>
                  <span className="truncate text-2xs leading-[14px] text-text-muted">{usable ? m.tagline : (m.statusNote ?? "Not available right now")}</span>
                </span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** "Batch size  − 1/2 +". Only drawn for models that can make more than one at a time. */
export function BatchRow({ studio }: { studio: Studio }) {
  const { count, maxCount } = studio;
  if (maxCount <= 1) return null;
  const step =
    "flex size-6 items-center justify-center rounded-sm text-text-primary transition-colors duration-150 hover:bg-border-default disabled:pointer-events-none disabled:opacity-40";
  return (
    <div className={cn(block, "flex h-12 shrink-0 items-center justify-between px-3")}>
      <span className="text-sm leading-5 font-medium text-text-primary">{audioCopy.batch}</span>
      <div role="group" aria-label={audioCopy.batch} className="flex items-center gap-[2px]">
        <button type="button" aria-label="One fewer" disabled={count <= 1} onClick={() => studio.setCount(count - 1)} className={step}>
          <Minus className="size-4" strokeWidth={1.5} aria-hidden />
        </button>
        <span aria-live="polite" aria-label={`${count} of ${maxCount}`} className="flex w-[31px] justify-center text-sm leading-5 font-semibold text-text-primary tabular-nums">
          {count}/{maxCount}
        </span>
        <button type="button" aria-label="One more" disabled={count >= maxCount} onClick={() => studio.setCount(count + 1)} className={step}>
          <Plus className="size-4" strokeWidth={1.5} aria-hidden />
        </button>
      </div>
    </div>
  );
}

function SelectRow({ control, studio }: { control: Select; studio: Studio }) {
  const [open, setOpen] = useState(false);
  const value = studio.values[control.id];
  const allowed = enabledOptions(control, studio.values, studio.filled);
  const current = control.options.find((o) => o.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger aria-label={`${control.label}: ${current?.label ?? "not set"}`} className={cn(rowButton, "h-14 shrink-0")}>
        <span className="flex min-w-0 flex-col gap-[5px]">
          <span className="text-xs leading-[18px] font-medium text-text-secondary">{control.label}</span>
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="truncate text-sm leading-5 font-medium text-text-primary">{current?.label ?? "Choose"}</span>
            {current?.hint ? <span className="truncate text-xs leading-4 text-text-tertiary">{current.hint}</span> : null}
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 opacity-60" strokeWidth={1.5} aria-hidden />
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" className="w-[260px] max-w-[calc(100vw-16px)]">
        <MenuLabel>{control.label}</MenuLabel>
        <div role="menu" aria-label={control.label} className="scroll-quiet max-h-[320px] overflow-y-auto">
          {control.options.map((option) => (
            <MenuItem
              key={option.value}
              selected={option.value === value}
              disabled={!allowed.includes(option)}
              hint={option.hint}
              onClick={() => {
                studio.setValue(control.id, option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </MenuItem>
          ))}
        </div>
        {control.hint ? <p className="px-2 pt-1 pb-2 text-xs leading-4 text-text-secondary">{control.hint}</p> : null}
      </PopoverContent>
    </Popover>
  );
}

function SliderRow({ control, studio }: { control: Slider; studio: Studio }) {
  const value = Number(studio.values[control.id] ?? control.default);
  return (
    <label className={cn(block, "flex h-12 shrink-0 items-center gap-3 px-3")} title={control.hint}>
      <span className="w-[72px] shrink-0 text-sm leading-5 font-medium text-text-primary">{control.label}</span>
      <input
        type="range"
        min={control.min}
        max={control.max}
        step={control.step}
        value={value}
        onChange={(e) => studio.setValue(control.id, Number(e.target.value))}
        className="h-5 min-w-0 flex-1 accent-brand"
      />
      <span className="w-10 shrink-0 text-right text-sm leading-5 font-semibold text-text-primary tabular-nums">
        {value}
        {control.unit ?? ""}
      </span>
    </label>
  );
}

function ToggleRow({ control, studio }: { control: Toggle; studio: Studio }) {
  return (
    <label className={cn(block, "flex min-h-12 shrink-0 cursor-pointer items-center justify-between gap-3 px-3 py-2")}>
      <span className="flex min-w-0 flex-col">
        <span className="text-sm leading-5 font-medium text-text-primary">{control.label}</span>
        {control.hint ? <span className="text-xs leading-4 text-text-secondary">{control.hint}</span> : null}
      </span>
      <Switch checked={studio.values[control.id] === true} onCheckedChange={(next) => studio.setValue(control.id, next)} aria-label={control.label} />
    </label>
  );
}

/** A free-text control (the delivery note, the lyrics): the "Voice details" box as drawn. */
function TextBlock({ control, studio }: { control: Text; studio: Studio }) {
  const value = String(studio.values[control.id] ?? "");
  const id = `field-${studio.surface}-${control.id}`;
  return (
    <div className={cn(block, "relative h-[122px] shrink-0 border border-border-subtle focus-within:border-border-default")}>
      <label htmlFor={id} className={cn(fieldLabel, "absolute top-[11px] left-3")}>
        {control.label}
      </label>
      <span className="absolute top-[6px] right-[7px]">
        <OptionalTag />
      </span>
      <textarea
        id={id}
        value={value}
        maxLength={control.maxLength}
        placeholder={control.placeholder}
        title={control.hint}
        onChange={(e) => studio.setValue(control.id, e.target.value)}
        className="scroll-quiet absolute top-9 left-3 h-[52px] w-[calc(100%-24px)] resize-none bg-transparent pr-1 text-xs leading-[18px] text-text-primary outline-none placeholder:text-text-muted"
      />
      <span className="absolute right-[13px] bottom-[13px] text-2xs leading-[14px] font-medium text-[#FFFFFF66] tabular-nums">
        {value.length} / {control.maxLength}
      </span>
    </div>
  );
}

/** One form row for one registry control, whatever its kind. */
export function ControlRow({ control, studio }: { control: Control; studio: Studio }) {
  if (control.type === "select") return <SelectRow control={control} studio={studio} />;
  if (control.type === "slider") return <SliderRow control={control} studio={studio} />;
  if (control.type === "toggle") return <ToggleRow control={control} studio={studio} />;
  return <TextBlock control={control} studio={studio} />;
}
