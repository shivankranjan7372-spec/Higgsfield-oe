"use client";

import { Grid2x2, Grid3x3, Heart, Images, LayoutGrid, ListFilter, Square, Trash2, X } from "lucide-react";
import { useState } from "react";
import { VendorGlyph } from "@/components/brand/logo";
import { imageCopy } from "@/content/image";
import { getModel } from "@/registry";
import { IconButton, MenuItem, MenuLabel, Popover, PopoverContent, PopoverTrigger, cn } from "@/ui";
import type { GridSize } from "./results";
import type { Filters } from "./use-workspace";

const c = imageCopy.toolbar;

/* The two toolbar boxes as drawn: 32 high, hairline border, 6px between icon and word. */
const toolButton =
  "inline-flex h-8 shrink-0 items-center justify-center gap-[6px] rounded-md border border-border-default px-[11px] text-sm leading-4 font-medium whitespace-nowrap text-text-primary transition-colors duration-150 select-none hover:bg-border-subtle data-[state=open]:bg-border-subtle";

const SIZES: { size: GridSize; icon: typeof Square }[] = [
  { size: 2, icon: Square },
  { size: 3, icon: Grid2x2 },
  { size: 4, icon: Grid3x3 },
];

/** The "View" button at the right of the toolbar: how big the workspace tiles are. */
export function ViewMenu({ size, onSize }: { size: GridSize; onSize: (size: GridSize) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={toolButton}>
          <LayoutGrid className="size-4" strokeWidth={1.5} aria-hidden />
          {c.view}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[200px]">
        <MenuLabel>{c.gridSize}</MenuLabel>
        {SIZES.map((option) => (
          <MenuItem
            key={option.size}
            icon={<option.icon className="size-4" strokeWidth={1.5} aria-hidden />}
            selected={option.size === size}
            onClick={() => {
              onSize(option.size);
              setOpen(false);
            }}
          >
            {c.sizes[option.size]}
          </MenuItem>
        ))}
      </PopoverContent>
    </Popover>
  );
}

/** The "Filter" button: favourites only, and one model. Models are the ones in the member's own work. */
export function FilterMenu({ filters, onFilters, modelIds }: { filters: Filters; onFilters: (f: Filters) => void; modelIds: string[] }) {
  const [open, setOpen] = useState(false);
  const active = filters.favorites || filters.model !== null;
  const set = (next: Filters) => {
    onFilters(next);
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={cn(toolButton, "relative")} aria-label={active ? `${c.filter} (on)` : c.filter}>
          <ListFilter className="size-4" strokeWidth={1.5} aria-hidden />
          {c.filter}
          {active ? <span aria-hidden className="absolute -top-[3px] -right-[3px] size-2 rounded-full bg-brand" /> : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="scroll-quiet max-h-[min(420px,calc(100dvh-140px))] w-[240px] overflow-y-auto">
        <MenuLabel>{c.show}</MenuLabel>
        <MenuItem
          icon={<Images className="size-4" strokeWidth={1.5} aria-hidden />}
          selected={!filters.favorites}
          onClick={() => set({ ...filters, favorites: false })}
        >
          {c.all}
        </MenuItem>
        <MenuItem
          icon={<Heart className="size-4" strokeWidth={1.5} aria-hidden />}
          selected={filters.favorites}
          onClick={() => set({ ...filters, favorites: true })}
        >
          {c.favorites}
        </MenuItem>
        <MenuLabel>{c.model}</MenuLabel>
        <MenuItem selected={filters.model === null} onClick={() => set({ ...filters, model: null })}>
          {c.allModels}
        </MenuItem>
        {modelIds.map((id) => {
          const model = getModel(id);
          return (
            <MenuItem
              key={id}
              icon={<VendorGlyph vendor={model?.vendor ?? ""} />}
              selected={filters.model === id}
              onClick={() => set({ ...filters, model: id })}
            >
              {model?.name ?? id}
            </MenuItem>
          );
        })}
        {active ? (
          <MenuItem icon={<X className="size-4" strokeWidth={1.5} aria-hidden />} onClick={() => set({ favorites: false, model: null })}>
            {c.clear}
          </MenuItem>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

const s = imageCopy.selection;

/** Takes the left of the toolbar while pictures are selected: act on all of them at once. */
export function SelectionBar({
  count,
  allFavorite,
  onFavorite,
  onTrash,
  onClear,
}: {
  count: number;
  allFavorite: boolean;
  onFavorite: () => void;
  onTrash: () => void;
  onClear: () => void;
}) {
  return (
    <div role="toolbar" aria-label={s.count(count)} className="flex min-w-0 animate-fade-in items-center gap-2">
      <IconButton size={32} tone="quiet" aria-label={s.clear} onClick={onClear}>
        <X className="size-4" strokeWidth={1.5} aria-hidden />
      </IconButton>
      <span className="truncate text-sm leading-4 font-medium text-text-primary">{s.count(count)}</span>
      <button type="button" onClick={onFavorite} className={toolButton}>
        <Heart className={cn("size-4", allFavorite && "fill-brand text-brand")} strokeWidth={1.5} aria-hidden />
        <span className="max-sm:sr-only">{allFavorite ? s.unfavorite : s.favorite}</span>
      </button>
      <button type="button" onClick={onTrash} className={toolButton}>
        <Trash2 className="size-4" strokeWidth={1.5} aria-hidden />
        <span className="max-sm:sr-only">{s.trash}</span>
      </button>
    </div>
  );
}
