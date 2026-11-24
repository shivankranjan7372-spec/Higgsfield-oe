"use client";

import { ChevronRight, CircleAlert, LoaderCircle, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { LoginDialog } from "@/components/entry/login-dialog";
import { formatCredits } from "@/config/economy";
import { audioCopy, audioTabs, type AudioSurface } from "@/content/audio";
import { routes } from "@/content/site";
import type { Studio } from "@/lib/studio";
import { cn } from "@/ui";
import { BatchRow, ControlRow, ModelRow, ScriptBox } from "./form-parts";

const NEEDS_ACCOUNT = new Set(["insufficient_credits", "unauthorized", "forbidden", "members_only", "guest_limit"]);

/** The 56px lime Generate bar at the foot of the panel, with the live price beside the word. */
function GenerateBar({ studio }: { studio: Studio }) {
  const price = studio.quote ? formatCredits(studio.quote.millicredits) : null;
  return (
    <button
      type="button"
      disabled={studio.busy}
      aria-disabled={studio.blocker ? true : undefined}
      aria-label={price ? `${audioCopy.generate}, ${price} credits` : audioCopy.generate}
      onClick={() => void studio.generate()}
      className="relative flex h-14 w-full shrink-0 items-center justify-center gap-2 overflow-clip rounded-xl bg-brand bg-linear-to-b from-[#FFFF1400] to-[#FFFF14] [box-shadow:#00000026_0px_32px_24px,#00000040_0px_6px_4px] transition-[filter] duration-150 hover:brightness-105 active:brightness-90 disabled:cursor-progress"
    >
      <span className="text-lg leading-6 font-semibold tracking-[-0.0222em] text-[#1B1B1B]">{audioCopy.generate}</span>
      <span className="flex items-center gap-1 text-lg leading-6 font-semibold text-[#1B1B1B] tabular-nums">
        {studio.busy ? (
          <LoaderCircle className="size-4 animate-spin" strokeWidth={2} aria-hidden />
        ) : price ? (
          <>
            <Sparkles className="size-4 fill-current" strokeWidth={1.5} aria-hidden />
            {price}
          </>
        ) : null}
      </span>
      <span aria-hidden className="pointer-events-none absolute inset-0 rounded-xl [box-shadow:#829B19_0px_-3px_0px_inset]" />
    </button>
  );
}

function Problem({ studio }: { studio: Studio }) {
  const [login, setLogin] = useState(false);
  if (!studio.error) return null;
  const account = studio.errorCode !== null && NEEDS_ACCOUNT.has(studio.errorCode);
  return (
    <div role="alert" className="flex shrink-0 items-start gap-2 rounded-xl border border-[#FF6B6B33] bg-[#FF6B6B14] p-3 text-xs leading-[18px] text-text-primary">
      <CircleAlert className="mt-[1px] size-4 shrink-0 text-danger" strokeWidth={1.5} aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p>{studio.error}</p>
        {account ? (
          <button
            type="button"
            onClick={() => setLogin(true)}
            className="inline-flex h-7 w-fit items-center rounded-md bg-brand px-3 text-xs leading-4 font-semibold text-ink transition-colors duration-150 hover:bg-brand-pressed"
          >
            {audioCopy.createAccount}
          </button>
        ) : null}
      </div>
      <button
        type="button"
        aria-label={audioCopy.dismiss}
        onClick={studio.clearError}
        className="flex size-6 shrink-0 items-center justify-center rounded-sm text-text-secondary transition-colors duration-150 hover:bg-border-default hover:text-text-primary"
      >
        <X className="size-4" strokeWidth={1.5} aria-hidden />
      </button>
      <LoginDialog open={login} onOpenChange={setLogin} mode="join" next={routes.audio} />
    </div>
  );
}

/** The form for one tab: script, model, the model's own controls, the advanced drawer. */
function TabForm({ studio, surface }: { studio: Studio; surface: AudioSurface }) {
  const [advanced, setAdvanced] = useState(false);
  const copy = audioCopy[surface];
  const { main, advanced: more } = studio.controls;
  const texts = main.filter((c) => c.type === "text");
  const rows = main.filter((c) => c.type !== "text");
  const label = studio.model?.prompt?.label ?? copy.scriptLabel;
  return (
    <>
      <ScriptBox studio={studio} label={label} hint={copy.scriptHint} info={copy.scriptInfo} onSubmit={() => void studio.generate()} />
      <ModelRow studio={studio} />
      <BatchRow studio={studio} />
      {rows.map((c) => (
        <ControlRow key={c.id} control={c} studio={studio} />
      ))}
      {texts.map((c) => (
        <ControlRow key={c.id} control={c} studio={studio} />
      ))}
      {more.length > 0 ? (
        <div className="flex shrink-0 flex-col gap-3">
          <button
            type="button"
            aria-expanded={advanced}
            onClick={() => setAdvanced((v) => !v)}
            className="flex h-8 w-full items-center gap-2 rounded-xl pr-[6px] pl-[6px] text-left text-text-primary transition-colors duration-150 hover:bg-border-subtle"
          >
            <SlidersHorizontal className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
            <span className="flex-1 text-sm leading-5 font-medium">{audioCopy.advanced}</span>
            <ChevronRight className={cn("size-4 shrink-0 opacity-60 transition-transform duration-150", advanced && "rotate-90")} strokeWidth={1.5} aria-hidden />
          </button>
          {advanced ? more.map((c) => <ControlRow key={c.id} control={c} studio={studio} />) : null}
        </div>
      ) : null}
      <Problem studio={studio} />
    </>
  );
}

/**
 * The left panel: the tabs across the top, the form, and the Generate bar pinned to the
 * bottom. On a phone it is the top of the page and the bar sticks to the bottom of the window.
 */
export function AudioForm({ surface, onSurface, studios }: { surface: AudioSurface; onSurface: (s: AudioSurface) => void; studios: Record<AudioSurface, Studio> }) {
  const studio = studios[surface];
  return (
    <section
      aria-label="Create audio"
      className="flex w-full shrink-0 flex-col items-center rounded-4xl border border-border-subtle bg-surface-secondary lg:h-[788px] lg:max-h-full lg:w-[394px] lg:overflow-clip"
    >
      <div role="tablist" aria-label="What to make" className="flex h-[49px] w-[calc(100%-26px)] shrink-0 items-start gap-5 border-b border-[#D9D9D90A] pt-3 pl-2">
        {audioTabs.map((tab) => {
          const on = tab.surface === surface;
          return (
            <button
              key={tab.surface}
              type="button"
              role="tab"
              id={`tab-${tab.surface}`}
              aria-selected={on}
              aria-controls="audio-form"
              onClick={() => onSurface(tab.surface)}
              onKeyDown={(e) => {
                if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
                const i = audioTabs.findIndex((t) => t.surface === surface);
                const next = audioTabs[(i + (e.key === "ArrowRight" ? 1 : audioTabs.length - 1)) % audioTabs.length];
                onSurface(next.surface);
                document.getElementById(`tab-${next.surface}`)?.focus();
              }}
              tabIndex={on ? 0 : -1}
              className={cn(
                "flex h-9 shrink-0 items-start border-b-2 text-sm leading-5 font-medium transition-colors duration-150",
                on ? "border-text-primary text-text-primary" : "border-transparent text-[#FFFFFF99] hover:text-text-primary",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div id="audio-form" role="tabpanel" aria-labelledby={`tab-${surface}`} className="scroll-quiet flex min-h-0 w-full flex-1 flex-col lg:overflow-y-auto">
        <div key={surface} className="flex shrink-0 animate-fade-in flex-col gap-3 px-3 pt-3 pb-6 lg:pb-14">
          <TabForm studio={studio} surface={surface} />
        </div>
        <div className="min-h-0 flex-1" />
        <div className="sticky bottom-0 z-10 -mt-6 flex shrink-0 justify-center rounded-b-4xl bg-linear-to-b from-[#1C1E2100] to-surface-secondary px-3 pt-6 pb-4 lg:-mt-14 lg:pt-14">
          <GenerateBar studio={studio} />
        </div>
      </div>
    </section>
  );
}
