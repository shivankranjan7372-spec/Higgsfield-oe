"use client";

import { AtSign, AudioLines, Check, Clapperboard, Plus, X } from "lucide-react";
import { useRef, useState } from "react";
import useSWR from "swr";
import { fetcher, type Asset } from "@/lib/api";
import { useSession } from "@/lib/session";
import type { Studio } from "@/lib/studio";
import type { MediaSlot } from "@/registry";
import { MenuItem, MenuLabel, Popover, PopoverContent, PopoverTrigger, cn } from "@/ui";

/** A square preview of anything in the library: the picture, a video's poster, or an icon for sound. */
export function AssetThumb({ asset }: { asset: Asset }) {
  const src = asset.kind === "image" ? (asset.posterUrl ?? asset.url) : asset.posterUrl;
  if (asset.kind === "audio" || !src) {
    const Icon = asset.kind === "audio" ? AudioLines : Clapperboard;
    return (
      <span className="flex size-full items-center justify-center text-text-tab">
        <Icon className="size-4" strokeWidth={1.5} aria-hidden />
      </span>
    );
  }
  // Served by our own API behind the session cookie, so the image optimizer can't fetch it.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" loading="lazy" className="size-full object-cover" />;
}

/** The small previews of what is attached, each with a remove button, plus a shimmer per file still uploading. */
export function AttachedStrip({ studio }: { studio: Studio }) {
  const items = studio.slots.flatMap((slot) => (studio.attached[slot.id] ?? []).map((asset) => ({ slot, asset })));
  if (items.length === 0 && studio.uploading === 0) return null;
  return (
    <ul aria-label="Attached files" className="flex flex-wrap gap-1 px-1 pt-1">
      {items.map(({ slot, asset }) => (
        <li key={`${slot.id}:${asset.id}`} title={`${slot.label}${asset.title ? `: ${asset.title}` : ""}`} className="group relative size-10 overflow-clip rounded-md bg-border-subtle">
          <AssetThumb asset={asset} />
          <button
            type="button"
            aria-label={`Remove ${asset.title || slot.label}`}
            onClick={() => studio.detach(slot.id, asset.id)}
            className="absolute top-[2px] right-[2px] flex size-4 items-center justify-center rounded-full bg-[#000000B3] text-text-primary opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
          >
            <X className="size-3" strokeWidth={2} aria-hidden />
          </button>
        </li>
      ))}
      {Array.from({ length: studio.uploading }, (_, i) => (
        <li key={`up-${i}`} aria-label="Uploading" className="shimmer size-10 rounded-md bg-border-subtle" />
      ))}
    </ul>
  );
}

function LibraryPanel({ studio }: { studio: Studio }) {
  const { user } = useSession();
  const kinds = [...new Set(studio.slots.flatMap((s) => s.accept))];
  const key = user ? `/api/assets?limit=48${kinds.length === 1 ? `&kind=${kinds[0]}` : ""}` : null;
  const { data, isLoading } = useSWR<{ assets: Asset[] }>(key, fetcher);
  const assets = (data?.assets ?? []).filter((a) => kinds.includes(a.kind));

  function toggle(asset: Asset) {
    const holder = studio.slots.find((s) => studio.attached[s.id]?.some((a) => a.id === asset.id));
    if (holder) return studio.detach(holder.id, asset.id);
    const slot = studio.slotFor(asset.kind);
    if (!slot) return;
    // A slot that holds one thing swaps it; a fuller slot just stops taking more.
    const there = studio.attached[slot.id] ?? [];
    if (slot.max === 1 && there[0]) studio.detach(slot.id, there[0].id);
    studio.attachAssets(slot, [asset]);
  }

  if (key && isLoading) {
    return (
      <div aria-label="Loading your library" className="grid grid-cols-4 gap-1">
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} className="shimmer aspect-square rounded-md bg-border-subtle" />
        ))}
      </div>
    );
  }
  if (assets.length === 0) {
    return <p className="px-2 pt-1 pb-3 text-xs leading-4 text-text-secondary">Nothing here yet. What you make or upload shows up in this list.</p>;
  }
  return (
    <div className="scroll-quiet grid max-h-[284px] grid-cols-4 gap-1 overflow-y-auto">
      {assets.map((asset) => {
        const on = studio.slots.some((s) => studio.attached[s.id]?.some((a) => a.id === asset.id));
        const slot = studio.slotFor(asset.kind);
        const full = !on && slot !== undefined && slot.max > 1 && (studio.attached[slot.id]?.length ?? 0) >= slot.max;
        return (
          <button
            key={asset.id}
            type="button"
            aria-pressed={on}
            aria-label={asset.title || asset.prompt || "Library item"}
            disabled={full}
            onClick={() => toggle(asset)}
            className="relative aspect-square overflow-clip rounded-md bg-border-subtle transition-opacity duration-150 hover:opacity-80 focus-visible:-outline-offset-2 disabled:pointer-events-none disabled:opacity-40"
          >
            <AssetThumb asset={asset} />
            {on ? (
              <span className="absolute inset-0 flex items-center justify-center bg-[#00000080]">
                <span className="flex size-5 items-center justify-center rounded-full bg-brand text-ink">
                  <Check className="size-3" strokeWidth={2.5} aria-hidden />
                </span>
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

const half =
  "flex size-8 items-center justify-center text-text-primary transition-colors duration-150 hover:bg-border-default focus-visible:-outline-offset-2 disabled:pointer-events-none disabled:opacity-40 data-[state=open]:bg-border-default";

/**
 * The "+ | @" chip. "+" uploads from the device, "@" picks from the library. Both fill the
 * current model's reference slots; a model that takes no references greys the chip out.
 */
export function ReferenceChip({ studio }: { studio: Studio }) {
  const input = useRef<HTMLInputElement>(null);
  const target = useRef<MediaSlot | null>(null);
  const [slotMenu, setSlotMenu] = useState(false);
  const { slots } = studio;
  const none = slots.length === 0;
  const why = none ? `${studio.model?.name ?? "This model"} takes no reference files` : undefined;

  function browse(slot: MediaSlot) {
    const el = input.current;
    if (!el) return;
    target.current = slot;
    el.accept = slot.accept.map((kind) => `${kind}/*`).join(",");
    el.multiple = slot.max > 1;
    el.value = "";
    el.click();
  }

  const plus = <Plus className="size-4" strokeWidth={1.5} aria-hidden />;

  return (
    <div title={why} className={cn("flex h-8 shrink-0 items-center overflow-clip rounded-md bg-border-subtle", none && "opacity-40")}>
      <input
        ref={input}
        type="file"
        hidden
        tabIndex={-1}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (target.current && files.length) void studio.attach(target.current, files);
        }}
      />
      {slots.length > 1 ? (
        <Popover open={slotMenu} onOpenChange={setSlotMenu}>
          <PopoverTrigger aria-label="Upload a reference" className={half}>
            {plus}
          </PopoverTrigger>
          <PopoverContent side="top" className="w-[220px]">
            <MenuLabel>Upload to</MenuLabel>
            {slots.map((slot) => (
              <MenuItem
                key={slot.id}
                hint={`${studio.attached[slot.id]?.length ?? 0}/${slot.max}`}
                onClick={() => {
                  setSlotMenu(false);
                  browse(slot);
                }}
              >
                {slot.label}
              </MenuItem>
            ))}
          </PopoverContent>
        </Popover>
      ) : (
        <button type="button" aria-label={slots[0] ? `Upload: ${slots[0].label.toLowerCase()}` : "Upload a reference"} disabled={none} onClick={() => slots[0] && browse(slots[0])} className={half}>
          {plus}
        </button>
      )}
      <span aria-hidden className="h-4 w-px bg-border-default" />
      <Popover>
        <PopoverTrigger aria-label="Pick from your library" disabled={none} className={half}>
          <AtSign className="size-4" strokeWidth={1.5} aria-hidden />
        </PopoverTrigger>
        <PopoverContent side="top" className="w-[296px] max-w-[calc(100vw-16px)]">
          <MenuLabel>From your library</MenuLabel>
          <LibraryPanel studio={studio} />
        </PopoverContent>
      </Popover>
    </div>
  );
}
