"use client";

import { useEffect, useState } from "react";
import { mutate as mutateCache } from "swr";
import { SHORT_ASPECT, SHORT_MAX_SECONDS, SHORTS_SURFACE } from "@/content/shorts";
import { ApiError, api, errorMessage, type Job } from "@/lib/api";
import { ensureSession, setBalance } from "@/lib/session";
import { jobsKey, useStudio, type Studio } from "@/lib/studio";
import type { Control, ModelDef } from "@/registry";

type Select = Extract<Control, { type: "select" }>;
type Slider = Extract<Control, { type: "slider" }>;

/** A model can make a short when it can frame the shot tall. */
export function makesShorts(model: ModelDef): boolean {
  const aspect = model.controls.find((c) => c.id === "aspect");
  return aspect?.type === "select" && aspect.options.some((o) => o.value === SHORT_ASPECT);
}

/** The lengths this page offers for a model's duration control, in seconds, never above the cap. */
export function shortLengths(control: Control | undefined): number[] {
  if (!control) return [];
  if (control.type === "select") {
    const all = (control as Select).options.map((o) => Number(o.value)).filter((n) => Number.isFinite(n));
    const fit = all.filter((n) => n <= SHORT_MAX_SECONDS);
    return fit.length ? fit : all.slice(0, 1);
  }
  if (control.type === "slider") {
    const s = control as Slider;
    const top = Math.min(s.max, SHORT_MAX_SECONDS);
    const picks = [s.min, 5, 8, top].filter((n) => n >= s.min && n <= top);
    return [...new Set(picks)].sort((a, b) => a - b);
  }
  return [];
}

export interface ShortsStudio {
  studio: Studio;
  /** Lengths on offer for the chosen model. */
  lengths: number[];
  length: number | null;
  setLength: (seconds: number) => void;
  busy: boolean;
  error: string | null;
  errorCode: string | null;
  clearError: () => void;
  /** Queues the short. Resolves to true when it was queued. */
  generate: () => Promise<boolean>;
  /** Queues a failed job again with the same model, idea and settings. */
  retry: (job: Job) => Promise<boolean>;
}

/**
 * The create form's state: the shared video studio, held to models that can frame 9:16, to
 * that frame, and to short lengths. Jobs are queued with the `shorts` label so this page's
 * results stay apart from the Video studio's.
 */
export function useShorts(): ShortsStudio {
  const base = useStudio("video");
  const models = base.models.filter(makesShorts);
  const studio: Studio = { ...base, models };
  const model = base.model && makesShorts(base.model) ? base.model : undefined;
  const durationControl = model?.controls.find((c) => c.id === "duration");
  const lengths = shortLengths(durationControl);
  const current = Number(base.values.duration);
  const length = Number.isFinite(current) && lengths.length ? current : null;

  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{ message: string; code: string } | null>(null);

  // Open on a model that can make shorts.
  const { pickModel } = base;
  const firstId = models[0]?.id;
  const wrongModel = !model && !!firstId;
  useEffect(() => {
    if (wrongModel && firstId) pickModel(firstId);
  }, [wrongModel, firstId, pickModel]);

  // Hold the frame tall and the length short whenever the model or its values change.
  const { setValue } = base;
  const aspectNow = base.values.aspect;
  const tooLong = lengths.length > 0 && (length === null || length > lengths[lengths.length - 1]);
  const fitLength = lengths[lengths.length - 1];
  useEffect(() => {
    if (model && aspectNow !== SHORT_ASPECT) setValue("aspect", SHORT_ASPECT);
  }, [model, aspectNow, setValue]);
  useEffect(() => {
    if (tooLong && fitLength !== undefined) setValue("duration", durationControl?.type === "select" ? String(fitLength) : fitLength);
  }, [tooLong, fitLength, durationControl, setValue]);

  const fail = (e: unknown) => setFailure({ message: errorMessage(e), code: e instanceof ApiError ? e.code : "error" });

  async function post(body: Record<string, unknown>): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    setFailure(null);
    try {
      await ensureSession();
      const res = await api<{ jobs: Job[]; balance: number }>("/api/jobs", {
        method: "POST",
        body: { ...body, surface: SHORTS_SURFACE },
      });
      await setBalance(res.balance);
      await mutateCache<{ jobs: Job[] }>(jobsKey(SHORTS_SURFACE), (prev) => ({ jobs: [...res.jobs, ...(prev?.jobs ?? [])] }), {
        revalidate: true,
      });
      return true;
    } catch (e) {
      fail(e);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function generate(): Promise<boolean> {
    const blocker = !model ? "Pick a model first." : base.blocker;
    if (!model || blocker) {
      setFailure({ message: blocker ?? "Pick a model first.", code: "blocked" });
      return false;
    }
    const inputs: Record<string, string[]> = {};
    for (const slot of base.slots) {
      const ids = (base.attached[slot.id] ?? []).map((a) => a.id);
      if (ids.length) inputs[slot.id] = ids;
    }
    return post({
      modelId: model.id,
      prompt: base.prompt.trim(),
      values: { ...base.values, aspect: SHORT_ASPECT },
      inputs,
      count: base.count,
    });
  }

  function retry(job: Job): Promise<boolean> {
    return post({ modelId: job.modelId, prompt: job.prompt, values: job.params, inputs: job.inputs, count: job.count });
  }

  return {
    studio,
    lengths,
    length,
    setLength: (s) => setValue("duration", durationControl?.type === "select" ? String(s) : s),
    busy,
    error: failure?.message ?? base.error,
    errorCode: failure?.code ?? base.errorCode,
    clearError: () => {
      setFailure(null);
      base.clearError();
    },
    generate,
    retry,
  };
}
