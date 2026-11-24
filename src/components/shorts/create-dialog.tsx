"use client";

import { Clock, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { LoginDialog } from "@/components/entry/login-dialog";
import { AspectGlyph, AttachedStrip, ControlField, CountChip, ModelPicker, PromptField, ReferenceChip } from "@/components/studio";
import { formatCredits } from "@/config/economy";
import { SHORT_ASPECT, shortsCopy } from "@/content/shorts";
import { routes } from "@/content/site";
import { useSession } from "@/lib/session";
import { Dialog, DialogContent, Spinner, cn } from "@/ui";
import { LIME_BUTTON } from "./styles";
import type { ShortsStudio } from "./use-shorts";

const copy = shortsCopy.form;
const BACK = `${routes.join}?next=${encodeURIComponent(routes.shorts)}`;

function FieldLabel({ children }: { children: string }) {
  return <span className="text-xs leading-4 font-medium text-text-tab">{children}</span>;
}

/** The form behind "Start generating": one idea, a model, a length, and Generate. */
export function CreateDialog({
  open,
  onOpenChange,
  shorts,
  onQueued,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shorts: ShortsStudio;
  onQueued: () => void;
}) {
  const { studio } = shorts;
  const { user, member } = useSession();
  const [join, setJoin] = useState(false);
  const rest = [...studio.controls.main, ...studio.controls.advanced].filter((c) => c.id !== "aspect" && c.id !== "duration");
  const price = studio.quote ? formatCredits(studio.quote.millicredits) : null;
  const needsAccount = shorts.errorCode === "unauthorized" || shorts.errorCode === "forbidden";

  async function submit() {
    if (await shorts.generate()) onQueued();
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent title={copy.title} className="max-w-[560px]" aria-describedby={undefined}>
          <form
            className="flex flex-col gap-5 px-6 pt-5 pb-6"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <label className="flex flex-col gap-2">
              <FieldLabel>{copy.promptLabel}</FieldLabel>
              <div className="rounded-xl bg-surface-field p-2 transition-colors duration-150 focus-within:bg-surface-tertiary">
                <PromptField
                  value={studio.prompt}
                  onChange={studio.setPrompt}
                  onSubmit={() => void submit()}
                  onFiles={(files) => void studio.drop(files)}
                  placeholder={copy.placeholder}
                  maxLength={studio.model?.prompt?.maxLength}
                  label={copy.promptLabel}
                />
              </div>
            </label>

            {studio.models.length === 0 ? (
              <p className="text-sm leading-5 text-text-secondary">{copy.noModels}</p>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <ModelPicker studio={studio} />
                <span
                  aria-label={`${copy.frame}: ${copy.frameValue}`}
                  className="inline-flex h-8 items-center gap-2 rounded-md bg-border-subtle px-3 text-sm leading-4 font-medium text-text-primary"
                >
                  <AspectGlyph value={SHORT_ASPECT} />
                  {SHORT_ASPECT}
                </span>
                {studio.slots.length > 0 ? <ReferenceChip studio={studio} /> : null}
                {studio.maxCount > 1 ? <CountChip studio={studio} /> : null}
              </div>
            )}
            <AttachedStrip studio={studio} />

            {shorts.lengths.length > 0 ? (
              <div className="flex flex-col gap-2">
                <FieldLabel>{copy.length}</FieldLabel>
                <div role="radiogroup" aria-label={copy.length} className="flex flex-wrap gap-2">
                  {shorts.lengths.map((s) => {
                    const on = shorts.length === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => shorts.setLength(s)}
                        className={cn(
                          "inline-flex h-8 items-center gap-1 rounded-md px-3 text-sm leading-4 font-medium transition-colors duration-150",
                          on ? "bg-text-primary text-text-inverse" : "bg-border-subtle text-text-tab hover:bg-border-default hover:text-text-primary",
                        )}
                      >
                        <Clock className="size-4" strokeWidth={1.5} aria-hidden />
                        {`${s}s`}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {rest.length > 0 ? (
              <div className="-mx-2 flex flex-col gap-1">
                {rest.map((control) => (
                  <ControlField key={control.id} control={control} studio={studio} />
                ))}
              </div>
            ) : null}

            {shorts.error ? (
              <div role="alert" className="flex items-start gap-3 rounded-xl bg-[#FF6B6B1A] px-4 py-3 text-sm leading-5 text-danger">
                <span className="min-w-0 flex-1">{shorts.error}</span>
                {shorts.errorCode === "insufficient_credits" ? (
                  <Link href={routes.pricing} className="shrink-0 font-semibold text-brand hover:underline">
                    {copy.topUp}
                  </Link>
                ) : null}
                {needsAccount ? (
                  <button type="button" onClick={() => setJoin(true)} className="shrink-0 font-semibold text-brand hover:underline">
                    {copy.join}
                  </button>
                ) : null}
                <button
                  type="button"
                  aria-label={copy.dismiss}
                  onClick={shorts.clearError}
                  className="shrink-0 rounded-md p-0.5 text-text-secondary transition-colors duration-150 hover:text-text-primary"
                >
                  <X className="size-4" strokeWidth={1.5} aria-hidden />
                </button>
              </div>
            ) : null}

            {user && !member ? (
              <p className="text-xs leading-4 text-text-secondary">
                {copy.guest}{" "}
                <Link href={BACK} className="font-medium text-brand hover:underline">
                  {copy.join}
                </Link>
              </p>
            ) : null}

            <div className="flex items-center justify-between gap-4">
              <span className="flex min-w-0 items-center gap-1 text-sm leading-5 text-text-secondary">
                <Sparkles className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
                <span className="truncate">{price ? copy.cost(price) : copy.noPrice}</span>
              </span>
              <button type="submit" disabled={shorts.busy} className={cn(LIME_BUTTON, "w-[142px] shrink-0 disabled:cursor-progress")}>
                {shorts.busy ? <Spinner /> : copy.generate}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <LoginDialog open={join} onOpenChange={setJoin} mode="join" next={routes.shorts} />
    </>
  );
}
