"use client";

import { Clock, Ellipsis, Gem, Mic, PenLine, Scan, SlidersHorizontal, Volume2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { Studio } from "@/lib/studio";
import { enabledOptions, type Control, type Value } from "@/registry";
import { Chip, MenuItem, MenuLabel, Popover, PopoverContent, PopoverTrigger, Switch, cn, iconButtonClass } from "@/ui";

type Select = Extract<Control, { type: "select" }>;
type Slider = Extract<Control, { type: "slider" }>;
type Toggle = Extract<Control, { type: "toggle" }>;
type Text = Extract<Control, { type: "text" }>;

/* ───────────────────────── icons ───────────────────────── */

/** A small outline in the shape of "16:9", "3:4"... Anything that is not a ratio ("auto") gets the frame icon. */
export function AspectGlyph({ value, box = 16 }: { value: string; box?: 16 | 20 }) {
  const ratio = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(value);
  if (!ratio) return <Scan className={box === 20 ? "size-5" : "size-4"} strokeWidth={1.5} aria-hidden />;
  const [w, h] = [Number(ratio[1]), Number(ratio[2])];
  const longest = box - 4;
  const width = w >= h ? longest : Math.max(5, Math.round((longest * w) / h));
  const height = h >= w ? longest : Math.max(5, Math.round((longest * h) / w));
  return (
    <span aria-hidden className={cn("flex shrink-0 items-center justify-center", box === 20 ? "size-5" : "size-4")}>
      <span className="rounded-[2px] border-[1.5px] border-current" style={{ width, height }} />
    </span>
  );
}

function controlIcon(control: Control, value: Value | undefined): ReactNode {
  if (control.type === "select" && control.display === "aspect") return <AspectGlyph value={String(value ?? "")} />;
  const cls = "size-4";
  if (control.id === "resolution" || control.id === "quality") return <Gem className={cls} strokeWidth={1.5} aria-hidden />;
  if (control.id === "duration") return <Clock className={cls} strokeWidth={1.5} aria-hidden />;
  if (control.id === "audio") return <Volume2 className={cls} strokeWidth={1.5} aria-hidden />;
  if (control.id === "voice") return <Mic className={cls} strokeWidth={1.5} aria-hidden />;
  if (control.type === "text") return <PenLine className={cls} strokeWidth={1.5} aria-hidden />;
  return <SlidersHorizontal className={cls} strokeWidth={1.5} aria-hidden />;
}

/* ───────────────────────── one chip per kind of control ───────────────────────── */

function SelectChip({ control, studio }: { control: Select; studio: Studio }) {
  const [open, setOpen] = useState(false);
  const value = studio.values[control.id];
  const allowed = enabledOptions(control, studio.values, studio.filled);
  const current = control.options.find((o) => o.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Chip aria-label={`${control.label}: ${current?.label ?? "not set"}`}>
          {controlIcon(control, value)}
          {current?.label ?? control.label}
        </Chip>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-[200px]">
        <MenuLabel>{control.label}</MenuLabel>
        <div role="menu" aria-label={control.label} className="scroll-quiet max-h-[288px] overflow-y-auto">
          {control.options.map((option) => (
            <MenuItem
              key={String(option.value)}
              selected={option.value === value}
              disabled={!allowed.includes(option)}
              hint={option.hint}
              icon={control.display === "aspect" ? <AspectGlyph value={String(option.value)} box={20} /> : undefined}
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

function ToggleChip({ control, studio }: { control: Toggle; studio: Studio }) {
  const on = studio.values[control.id] === true;
  return (
    <label className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-2 rounded-md bg-border-subtle px-3 text-sm leading-4 font-medium whitespace-nowrap text-text-primary">
      {control.label}
      <Switch checked={on} onCheckedChange={(next) => studio.setValue(control.id, next)} aria-label={control.label} />
    </label>
  );
}

function Range({ control, studio }: { control: Slider; studio: Studio }) {
  const value = Number(studio.values[control.id] ?? control.default);
  return (
    <input
      type="range"
      min={control.min}
      max={control.max}
      step={control.step}
      value={value}
      aria-label={control.label}
      onChange={(e) => studio.setValue(control.id, Number(e.target.value))}
      className="h-5 w-full accent-brand"
    />
  );
}

function SliderChip({ control, studio }: { control: Slider; studio: Studio }) {
  const value = Number(studio.values[control.id] ?? control.default);
  const shown = `${value}${control.unit ?? ""}`;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Chip aria-label={`${control.label}: ${shown}`}>
          {controlIcon(control, value)}
          {shown}
        </Chip>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-[240px]">
        <MenuLabel className="justify-between">
          {control.label}
          <span className="text-text-primary tabular-nums">{shown}</span>
        </MenuLabel>
        <div className="px-2 pb-2">
          <Range control={control} studio={studio} />
          {control.hint ? <p className="pt-1 text-xs leading-4 text-text-secondary">{control.hint}</p> : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function TextBox({ control, studio }: { control: Text; studio: Studio }) {
  return (
    <textarea
      rows={3}
      value={String(studio.values[control.id] ?? "")}
      maxLength={control.maxLength}
      placeholder={control.placeholder}
      aria-label={control.label}
      onChange={(e) => studio.setValue(control.id, e.target.value)}
      className="scroll-quiet block w-full resize-none rounded-md bg-border-subtle p-2 text-sm leading-5 text-text-primary outline-none focus-visible:bg-border-default"
    />
  );
}

function TextChip({ control, studio }: { control: Text; studio: Studio }) {
  const filled = String(studio.values[control.id] ?? "").trim().length > 0;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Chip aria-label={filled ? `${control.label}: filled in` : control.label}>
          {controlIcon(control, undefined)}
          {control.label}
          {filled ? <span aria-hidden className="size-[6px] rounded-full bg-brand" /> : null}
        </Chip>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-[320px] max-w-[calc(100vw-16px)]">
        <MenuLabel>{control.label}</MenuLabel>
        <div className="px-2 pb-2">
          <TextBox control={control} studio={studio} />
          {control.hint ? <p className="pt-1 text-xs leading-4 text-text-secondary">{control.hint}</p> : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * One composer chip for one registry control, whatever its kind: a menu for a choice, a
 * switch for an on/off, a slider, or a small text box. Options that don't apply right now
 * (the registry's `when` rules) are shown but can't be picked.
 */
export function ControlChip({ control, studio }: { control: Control; studio: Studio }) {
  if (control.type === "select") return <SelectChip control={control} studio={studio} />;
  if (control.type === "toggle") return <ToggleChip control={control} studio={studio} />;
  if (control.type === "slider") return <SliderChip control={control} studio={studio} />;
  return <TextChip control={control} studio={studio} />;
}

/* ───────────────────────── the "more" menu ───────────────────────── */

/** The same control drawn as a labelled row, for panels and the "more" menu. */
export function ControlField({ control, studio }: { control: Control; studio: Studio }) {
  const value = studio.values[control.id];
  if (control.type === "toggle") {
    return (
      <label className="flex min-h-9 cursor-pointer items-center justify-between gap-3 px-2 text-sm leading-5 font-medium text-text-primary">
        <span className="min-w-0">
          {control.label}
          {control.hint ? <span className="block text-xs leading-4 font-normal text-text-secondary">{control.hint}</span> : null}
        </span>
        <Switch checked={value === true} onCheckedChange={(next) => studio.setValue(control.id, next)} aria-label={control.label} />
      </label>
    );
  }
  return (
    <div className="flex flex-col gap-1 px-2 pb-2">
      <div className="flex h-7 items-center justify-between text-xs leading-4 font-medium text-text-tab">
        {control.label}
        {control.type === "slider" ? <span className="text-text-primary tabular-nums">{`${Number(value ?? control.default)}${control.unit ?? ""}`}</span> : null}
      </div>
      {control.type === "select" ? (
        <div role="radiogroup" aria-label={control.label} className="flex flex-wrap gap-1">
          {control.options.map((option) => {
            const on = option.value === value;
            return (
              <button
                key={String(option.value)}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={!enabledOptions(control, studio.values, studio.filled).includes(option)}
                onClick={() => studio.setValue(control.id, option.value)}
                className={cn(
                  "inline-flex h-7 items-center rounded-md px-2 text-xs leading-4 font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40",
                  on ? "bg-border-strong text-text-primary" : "bg-border-subtle text-text-tab hover:bg-border-default hover:text-text-primary",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : control.type === "slider" ? (
        <Range control={control} studio={studio} />
      ) : (
        <TextBox control={control} studio={studio} />
      )}
      {control.hint ? <p className="text-xs leading-4 text-text-secondary">{control.hint}</p> : null}
    </div>
  );
}

/** The "..." chip: every control the registry marks `advanced`, stacked in one menu. */
export function MoreChip({ controls, studio }: { controls: Control[]; studio: Studio }) {
  if (controls.length === 0) return null;
  return (
    <Popover>
      <PopoverTrigger aria-label="More settings" className={iconButtonClass(32, "soft", "data-[state=open]:bg-border-default")}>
        <Ellipsis className="size-4" strokeWidth={1.5} aria-hidden />
      </PopoverTrigger>
      <PopoverContent side="top" className="w-[280px] max-w-[calc(100vw-16px)]">
        <MenuLabel>More settings</MenuLabel>
        <div className="scroll-quiet flex max-h-[320px] flex-col gap-1 overflow-y-auto">
          {controls.map((control) => (
            <ControlField key={control.id} control={control} studio={studio} />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
