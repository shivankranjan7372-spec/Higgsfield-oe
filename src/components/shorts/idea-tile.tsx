"use client";

import { ArrowUpRight } from "lucide-react";
import { shortsCopy, type ShortIdea } from "@/content/shorts";
import { Artwork } from "@/ui";
import { TILE, TILE_GLOW, TILE_SHADE } from "./styles";

/** A sample idea, drawn like the design's preset tile: a tall picture, a shade, and a small end frame. */
export function IdeaTile({ idea, onUse }: { idea: ShortIdea; onUse: (idea: ShortIdea) => void }) {
  return (
    <button type="button" onClick={() => onUse(idea)} aria-label={shortsCopy.idea.use(idea.title)} className={TILE}>
      <Artwork
        name={`shorts/idea-${idea.id}`}
        className="absolute inset-0 size-full transition-transform duration-300 ease-out-soft group-hover:scale-[1.03]"
      />
      <span className={TILE_SHADE} />
      <span className="absolute inset-x-3 bottom-[15px] flex items-end gap-3">
        <span className="flex min-w-0 flex-1 flex-col gap-1 pb-1">
          <span className="line-clamp-2 text-sm leading-5 font-semibold text-text-primary">{idea.title}</span>
          <span className="flex items-center gap-1 text-xs leading-4 font-medium text-brand opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
            {shortsCopy.idea.hint}
            <ArrowUpRight className="size-3" strokeWidth={1.5} aria-hidden />
          </span>
        </span>
        <span className="relative h-[68px] w-[46px] shrink-0 overflow-clip rounded-md border border-text-primary bg-surface-secondary">
          <Artwork name={`shorts/idea-${idea.id}-frame`} className="absolute inset-0 size-full" />
        </span>
      </span>
      <span className={TILE_GLOW} />
    </button>
  );
}
