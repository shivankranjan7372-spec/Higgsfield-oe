"use client";

import { useState } from "react";
import { mutate } from "swr";
import { REMIX_SURFACE } from "@/content/remix";
import { ApiError, api, errorMessage, type Job } from "@/lib/api";
import { ensureSession, setBalance } from "@/lib/session";
import { jobsKey, type Studio } from "@/lib/studio";
import type { Values } from "@/registry";

export interface RemixDraft {
  modelId: string;
  prompt: string;
  values: Values | Job["params"];
  inputs: Record<string, string[]>;
  count: number;
  mode: string;
}

export interface Failure {
  message: string;
  code: string;
  status: number;
}

/**
 * Sends work from the Remix page. It is the core `POST /api/jobs`, with `surface: "remix"` and
 * `meta: { studio: "remix", mode }`, so `GET /api/jobs?surface=remix` lists only this page's
 * work. (`useStudio().generate()` always sends the studio's own surface, so we post here.)
 */
export function useRemixSubmit() {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);

  async function submit(draft: RemixDraft): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    setFailure(null);
    try {
      await ensureSession();
      const res = await api<{ jobs: Job[]; balance: number }>("/api/jobs", {
        method: "POST",
        body: {
          modelId: draft.modelId,
          prompt: draft.prompt,
          values: draft.values,
          inputs: draft.inputs,
          count: draft.count,
          surface: REMIX_SURFACE,
          meta: { studio: REMIX_SURFACE, mode: draft.mode },
        },
      });
      await setBalance(res.balance);
      await mutate<{ jobs: Job[] }>(
        jobsKey(REMIX_SURFACE),
        (prev) => ({ jobs: [...res.jobs, ...(prev?.jobs ?? [])] }),
        { revalidate: true },
      );
      return true;
    } catch (e) {
      setFailure({
        message: errorMessage(e),
        code: e instanceof ApiError ? e.code : "error",
        status: e instanceof ApiError ? e.status : 0,
      });
      return false;
    } finally {
      setBusy(false);
    }
  }

  return { busy, failure, setFailure, submit };
}

/** What the form would send right now, with the prompt the page settled on. */
export function draftFrom(studio: Studio, mode: string, prompt: string): RemixDraft | null {
  if (!studio.model) return null;
  const inputs: Record<string, string[]> = {};
  for (const slot of studio.slots) {
    const ids = (studio.attached[slot.id] ?? []).map((a) => a.id);
    if (ids.length) inputs[slot.id] = ids;
  }
  return {
    modelId: studio.model.id,
    prompt,
    values: studio.values,
    inputs,
    count: studio.count,
    mode,
  };
}

/** A past job, sent again as it was. */
export function draftFromJob(job: Job): RemixDraft {
  const mode = typeof job.meta?.mode === "string" ? job.meta.mode : "standard";
  return {
    modelId: job.modelId,
    prompt: job.prompt,
    values: job.params,
    inputs: job.inputs,
    count: Math.max(1, job.count),
    mode,
  };
}
