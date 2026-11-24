"use client";

import { CircleAlert, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { routes } from "@/content/site";
import type { Studio } from "@/lib/studio";
import { ButtonLink, cn } from "@/ui";
import { ControlChip, MoreChip } from "./control-chip";
import { CountChip } from "./count-chip";
import { GenerateButton } from "./generate-button";
import { ModelPicker } from "./model-picker";
import { PromptField } from "./prompt-field";
import { AttachedStrip, ReferenceChip } from "./reference-chip";

/**
 * Where the composer floats: centred, 16px above the bottom of the page area, 880 wide at
 * most. Put it last inside a `relative` box that fills the page (see ImageStudio).
 */
export function ComposerDock({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center px-4">
      <div className="pointer-events-auto w-full max-w-[880px]">{children}</div>
    </div>
  );
}

/** What went wrong, in a pill just above the composer. */
function Trouble({ studio }: { studio: Studio }) {
  if (!studio.error) return null;
  return (
    <div className="absolute inset-x-0 bottom-full mb-3 flex justify-center">
      <div role="alert" className="flex max-w-full animate-rise-in items-center gap-2 rounded-full bg-surface-secondary-strong py-[6px] pr-[6px] pl-3 shadow-menu">
        <CircleAlert className="size-4 shrink-0 text-danger" strokeWidth={1.5} aria-hidden />
        <span className="min-w-0 text-sm leading-5 text-text-primary">{studio.error}</span>
        {studio.errorCode === "insufficient_credits" ? (
          <ButtonLink href={routes.pricing} variant="white" size="pill-xs">
            Get credits
          </ButtonLink>
        ) : null}
        <button
          type="button"
          aria-label="Dismiss"
          onClick={studio.clearError}
          className="flex size-6 shrink-0 items-center justify-center rounded-full bg-border-subtle text-text-secondary transition-colors duration-150 hover:bg-border-default hover:text-text-primary"
        >
          <X className="size-4" strokeWidth={1.5} aria-hidden />
        </button>
      </div>
    </div>
  );
}

/**
 * The composer every create page shares: the prompt, a row of chips, and Generate.
 *
 *   const studio = useStudio("image");
 *   <ComposerDock><Composer studio={studio} placeholder="Describe the image you have in mind" /></ComposerDock>
 *
 * Nothing here is specific to one studio. The chips are drawn from the current model's
 * registry entry: its reference slots, its controls (advanced ones behind "..."), and how
 * many results it can make at once. Pass `extra` to add a page's own chips after the model's.
 * `placeholder` is the page's designed prompt hint; leave it out to show the model's own.
 * Files can be dropped anywhere on it, or pasted into the prompt.
 */
export function Composer({ studio, placeholder, extra }: { studio: Studio; placeholder?: string; extra?: ReactNode }) {
  const [over, setOver] = useState(false);
  const prompt = studio.model?.prompt ?? null;

  return (
    <div className="relative">
      <Trouble studio={studio} />
      <div
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
        }}
        onDrop={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          setOver(false);
          void studio.drop(Array.from(e.dataTransfer.files));
        }}
        className={cn("rounded-3xl bg-surface-secondary p-1 shadow-composer", over && "outline-2 outline-offset-2 outline-brand")}
      >
        <div className="flex flex-col gap-3 rounded-2xl bg-surface-field p-3 sm:flex-row sm:items-end">
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex flex-col">
              <AttachedStrip studio={studio} />
              {prompt ? (
                <PromptField
                  value={studio.prompt}
                  onChange={studio.setPrompt}
                  onSubmit={() => void studio.generate()}
                  onFiles={(files) => void studio.drop(files)}
                  placeholder={placeholder ?? prompt.placeholder}
                  maxLength={prompt.maxLength}
                  label={prompt.label ?? "Prompt"}
                />
              ) : (
                <p className="min-h-12 p-1 text-sm leading-5 text-text-secondary">{studio.model?.tagline ?? "Pick a model to begin."}</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <ReferenceChip studio={studio} />
              <ModelPicker studio={studio} />
              {studio.controls.main.map((control) => (
                <ControlChip key={control.id} control={control} studio={studio} />
              ))}
              <MoreChip controls={studio.controls.advanced} studio={studio} />
              <CountChip studio={studio} />
              {extra}
            </div>
          </div>
          <GenerateButton studio={studio} />
        </div>
      </div>
    </div>
  );
}
