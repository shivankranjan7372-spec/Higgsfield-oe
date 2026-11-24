"use client";

import { BookOpen, X } from "lucide-react";
import { guideHint } from "@/content/site";
import { closeForGood } from "@/lib/closable";
import { ButtonLink, IconButton } from "@/ui";

/** The pill above the hero that points a newcomer at the guide. Closing it is remembered. */
export function GuideHint() {
  return (
    <aside
      data-closable="guide"
      aria-label="Getting started"
      className="flex w-[458px] max-w-full items-center gap-3 rounded-full bg-surface-secondary-strong p-[10px]"
    >
      <span className="flex size-[38px] shrink-0 items-center justify-center rounded-full border border-border-default bg-border-subtle text-text-primary [box-shadow:#FFFFFF0D_0px_2px_3px_inset,#00000026_0px_4px_20px_-8px]">
        <BookOpen className="size-5" strokeWidth={1.5} aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
        <span className="truncate text-sm leading-5 font-medium text-text-primary">{guideHint.title}</span>
        <span className="truncate text-xs leading-4 text-text-secondary">{guideHint.sub}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1">
        <ButtonLink href={guideHint.cta.href} variant="white" size="pill">
          {guideHint.cta.label}
        </ButtonLink>
        <IconButton size={38} tone="quiet" aria-label="Close this tip" onClick={() => closeForGood("guide")}>
          <X className="size-6" strokeWidth={1.5} aria-hidden />
        </IconButton>
      </span>
    </aside>
  );
}
