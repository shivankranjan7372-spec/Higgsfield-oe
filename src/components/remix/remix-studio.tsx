"use client";

import { FolderClosed, Wand2 } from "lucide-react";
import { useLayoutEffect, useState } from "react";
import {
  REMIX_SURFACE,
  remixCopy,
  remixModes,
  type RemixModeId,
} from "@/content/remix";
import { api, type Asset, type Job } from "@/lib/api";
import { findBlocker, useJobs, useStudio } from "@/lib/studio";
import { cn } from "@/ui";
import { RemixExamples } from "./remix-examples";
import { RemixForm } from "./remix-form";
import { RemixHistory } from "./remix-history";
import { draftFrom, draftFromJob, useRemixSubmit } from "./use-remix";

type Tab = "ideas" | "history";

const MODE_MODELS: readonly string[] = remixModes.map((m) => m.modelId);

/* The lit pill behind the chosen tab, as drawn: grey glass with a faint diagonal sheen. */
const pill =
  "border border-border-subtle bg-[#23262ABF] bg-[linear-gradient(149deg,#FFFFFF0A_22.61%,#FFFFFF0F_51.26%,#FFFFFF05_79.91%)] [box-shadow:#FFFFFF0D_0px_2px_3px_inset,#0000001F_0px_2px_2px]";

/**
 * The Remix studio: the form on the left, and on the right either sample directions or the
 * member's own remixes. It runs on the core jobs API with the video models that start from
 * a picture; the jobs are tagged `surface: "remix"`.
 */
export function RemixStudio() {
  const studio = useStudio("video");
  const { jobs, loading } = useJobs(REMIX_SURFACE);
  const { busy, failure, setFailure, submit } = useRemixSubmit();
  const [tab, setTab] = useState<Tab>("ideas");

  // Only the picture-to-video models behind the Mode row belong here. Open on Standard
  // unless the address (?model=) already names one of them.
  const modelId = studio.model?.id;
  const { pickModel } = studio;
  useLayoutEffect(() => {
    if (!modelId || !MODE_MODELS.includes(modelId))
      pickModel(remixModes[0].modelId);
  }, [modelId, pickModel]);

  const mode: RemixModeId =
    remixModes.find((m) => m.modelId === modelId)?.id ?? remixModes[0].id;

  // The Prompt switch, as drawn: off until there is a direction. null follows the text, so a
  // picked direction or a prompt handed over in the address turns it on.
  const [promptChoice, setPromptChoice] = useState<boolean | null>(null);
  const promptOn = promptChoice ?? studio.prompt.length > 0;
  const text = promptOn ? studio.prompt.trim() : "";
  // A remix always starts from a picture, also on a model that could work from words alone.
  const slots = studio.slots.map((s) =>
    s.id === "start" ? { ...s, min: 1, label: remixCopy.source.name } : s,
  );
  // The prompt is optional on this page, so it never blocks Generate.
  const blocker = findBlocker(
    { model: studio.model, text, uploading: studio.uploading, slots, attached: studio.attached },
    false,
  );

  async function generate() {
    setFailure(null);
    if (blocker) {
      setFailure({ message: blocker, code: "blocked", status: 0 });
      return;
    }
    // With no direction of the member's own, a model that needs words gets a plain one.
    const prompt = text || (studio.model?.prompt?.required ? remixCopy.prompt.fallback : "");
    const draft = draftFrom(studio, mode, prompt);
    if (!draft) return;
    if (await submit(draft)) setTab("history");
  }

  async function reuse(job: Job) {
    studio.load(job);
    setPromptChoice(job.prompt === remixCopy.prompt.fallback ? false : null);
    // Put the pictures it started from back in their slots, when they still exist.
    for (const [slotId, ids] of Object.entries(job.inputs ?? {})) {
      const slot = studio.model?.slots.find((s) => s.id === slotId);
      if (!slot) continue;
      for (const id of ids) {
        try {
          const { asset } = await api<{ asset: Asset }>(`/api/assets/${id}`);
          studio.attachAssets(slot, [asset]);
        } catch {
          // Gone since: the slot stays empty.
        }
      }
    }
  }

  return (
    <div className="scroll-quiet flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pt-2 pb-4 lg:flex-row lg:justify-center lg:overflow-hidden lg:px-4 lg:pb-7">
      <RemixForm
        studio={studio}
        mode={mode}
        busy={busy}
        blocked={Boolean(blocker)}
        promptOn={promptOn}
        onPromptToggle={setPromptChoice}
        failure={failure}
        onDismiss={() => setFailure(null)}
        onGenerate={() => void generate()}
      />
      <section
        aria-label="Gallery"
        className="relative flex min-h-[640px] min-w-0 flex-col overflow-clip rounded-3xl border border-border-default bg-[radial-gradient(circle_farthest-corner_at_50%_50%,#191B1D_0%,#00000000_100%)] lg:min-h-0 lg:max-w-[1080px] lg:flex-1 lg:self-stretch"
      >
        <div className="flex h-14 shrink-0 items-start px-4 pt-2">
          <div
            role="tablist"
            aria-label="Gallery view"
            className="flex h-9 items-center gap-1"
          >
            {(
              [
                { id: "ideas", label: remixCopy.tabs.ideas, icon: Wand2 },
                {
                  id: "history",
                  label: remixCopy.tabs.history,
                  icon: FolderClosed,
                },
              ] as const
            ).map((t) => {
              const on = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "flex h-8 items-center gap-1 rounded-md px-2 text-xs leading-4 font-medium transition-colors duration-150",
                    on
                      ? cn(pill, "text-text-primary")
                      : "border border-transparent text-text-tab hover:text-text-primary",
                  )}
                >
                  <t.icon className="size-4" strokeWidth={1.5} aria-hidden />
                  {t.label}
                  {t.id === "history" &&
                  jobs.some(
                    (j) => j.status === "queued" || j.status === "running",
                  ) ? (
                    <span
                      aria-label="working"
                      className="size-1.5 animate-pulse rounded-full bg-brand"
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
        <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto px-4">
          {tab === "ideas" ? (
            <RemixExamples
              onPick={(direction) => {
                studio.setPrompt(direction);
                setPromptChoice(null);
              }}
            />
          ) : (
            <RemixHistory
              jobs={jobs}
              loading={loading}
              busy={busy}
              onRetry={(job) => void submit(draftFromJob(job))}
              onReuse={(job) => void reuse(job)}
            />
          )}
        </div>
      </section>
    </div>
  );
}
