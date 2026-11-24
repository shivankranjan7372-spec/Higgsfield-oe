"use client";

import { useEffect, useRef, useState } from "react";
import useSWR, { mutate as mutateCache } from "swr";
import {
  clampCount,
  defaultModel,
  getModel,
  modelsFor,
  quoteJob,
  resolveValues,
  visibleControls,
  visibleSlots,
  type Control,
  type Filled,
  type JobQuote,
  type MediaSlot,
  type ModelDef,
  type Value,
  type Values,
} from "@/registry";
import { ApiError, api, errorMessage, fetcher, type Asset, type Job } from "./api";
import { useQueryParam } from "./browser";
import { ensureSession, refreshSession, setBalance, useSession } from "./session";

/* ───────────────────────── jobs ───────────────────────── */

export function isActive(job: Job): boolean {
  return job.status === "queued" || job.status === "running";
}

/** The cache key for one studio's recent jobs. */
export function jobsKey(surface: string): string {
  return `/api/jobs?surface=${encodeURIComponent(surface)}&limit=40`;
}

const NO_JOBS: Job[] = [];

/**
 * The newest jobs made on one studio ("image", "video"...), newest first. While any of them
 * is still queued or running it asks the server again every 1.5 seconds, so tiles fill in on
 * their own. Signed-out visitors have no jobs and cause no request.
 */
export function useJobs(surface: string) {
  const { user, loading: sessionLoading } = useSession();
  const { data, isLoading, mutate } = useSWR<{ jobs: Job[] }>(user ? jobsKey(surface) : null, fetcher);
  const jobs = data?.jobs ?? NO_JOBS;
  const working = jobs.some(isActive);

  // Our own timer: SWR's `refreshInterval` is not re-armed when it goes from 0 to a number,
  // and its request de-duplication would swallow every other tick.
  useEffect(() => {
    if (!working) return;
    const id = window.setInterval(() => void mutate(), 1500);
    return () => window.clearInterval(id);
  }, [working, mutate]);

  // When the last job lands the balance may have moved (a failed job is refunded).
  const wasWorking = useRef(false);
  useEffect(() => {
    if (wasWorking.current && !working) void refreshSession();
    wasWorking.current = working;
  }, [working]);

  return {
    jobs,
    /** True while anything is queued or running. */
    working,
    /** True until we know whether there is anything to show. Draw nothing while it is true. */
    loading: sessionLoading || (user !== null && isLoading),
  };
}

/* ───────────────────────── the composer ───────────────────────── */

export interface Studio {
  surface: string;
  /** Every model this studio offers, in display order. */
  models: ModelDef[];
  model: ModelDef | undefined;
  pickModel: (id: string) => void;

  prompt: string;
  setPrompt: (text: string) => void;

  /** The settled value of every control of the current model. */
  values: Values;
  setValue: (controlId: string, value: Value) => void;
  /** The controls that apply right now. `advanced` ones belong behind a "more" menu. */
  controls: { main: Control[]; advanced: Control[] };
  /** How many files sit in each slot. Pass it to `enabledOptions(control, values, filled)`. */
  filled: Filled;

  /** The reference slots that apply right now, and what is in them. */
  slots: MediaSlot[];
  attached: Record<string, Asset[]>;
  /** Uploads files from the person's device into a slot. Extra files beyond the slot's room are ignored. */
  attach: (slot: MediaSlot, files: File[]) => Promise<void>;
  /** Puts things already in the library into a slot. */
  attachAssets: (slot: MediaSlot, assets: Asset[]) => void;
  detach: (slotId: string, assetId: string) => void;
  /** Where a file of this kind ("image", "video", "audio") would land: the first slot that takes it and has room, else the first that takes it. */
  slotFor: (kind: string) => MediaSlot | undefined;
  /** Dropped or pasted files. Each one goes to the slot `slotFor` names. */
  drop: (files: File[]) => Promise<void>;
  /** Files still on their way up. */
  uploading: number;

  count: number;
  setCount: (count: number) => void;
  maxCount: number;

  /** The live price, or null when it can't be worked out yet. `quote.millicredits` is the total. */
  quote: JobQuote | null;
  /** Why Generate would be refused, in words to show. Null when it is good to go. */
  blocker: string | null;
  busy: boolean;
  /** What went wrong last, in words to show as they are. */
  error: string | null;
  /** The server's code for it ("insufficient_credits", "model_unavailable"...), or "blocked" for our own checks. */
  errorCode: string | null;
  clearError: () => void;
  /** Queues the work. Signs a new visitor in as a guest first. Resolves to true when it was queued. */
  generate: () => Promise<boolean>;
  /** Puts a past job's model, prompt and settings back in the composer. */
  load: (job: Job) => void;
}

/**
 * Why Generate cannot run yet, or null. The same checks the server makes, in the same words,
 * so a press that can't work never reaches the server (and never turns a visitor into a guest
 * account for nothing). `needPrompt: false` leaves out the missing-prompt check, for a page
 * that sends a prompt of its own when the person wrote none.
 */
export function findBlocker(
  now: { model: ModelDef | null | undefined; text: string; uploading: number; slots: MediaSlot[]; attached: Record<string, Asset[]> },
  needPrompt = true,
): string | null {
  const { model, text } = now;
  if (!model) return "Pick a model first.";
  if (model.status !== "available") return model.statusNote ?? `${model.name} is not available right now.`;
  if (needPrompt && model.prompt?.required && !text) return "Write a prompt first.";
  if (model.prompt && text.length > model.prompt.maxLength) {
    return `Keep the prompt under ${model.prompt.maxLength.toLocaleString("en-US")} characters.`;
  }
  if (now.uploading > 0) return "Wait for the upload to finish.";
  const short = now.slots.find((s) => (now.attached[s.id]?.length ?? 0) < s.min);
  if (!short) return null;
  return short.min === 1 ? `Add ${short.label.toLowerCase()} first.` : `"${short.label}" needs at least ${short.min} files.`;
}

/**
 * Everything a create page's composer needs, for one studio. The page stays a thin layer of
 * markup: it draws `controls` and `slots`, shows `quote`, and calls `generate`.
 *
 *   const studio = useStudio("image");
 *   const { jobs } = useJobs("image");
 *
 * Which model: the one the person picked, else `?model=<id>` in the address, else the
 * studio's default. The prompt starts from `?prompt=<text>` in the address when there is one. All rules (which options apply, what it costs) come from the registry,
 * the same code the server checks with.
 */
export function useStudio(surface: string): Studio {
  const models = modelsFor(surface);
  const fromAddress = useQueryParam("model");
  const [picked, setPicked] = useState<string | null>(null);
  const [raw, setRaw] = useState<Record<string, unknown>>({});
  // `?prompt=<text>` in the address fills the box until the person types. Another screen uses
  // it to hand a prompt over: `${routes.image}?model=<id>&prompt=<text>`.
  const promptFromAddress = useQueryParam("prompt");
  const [typed, setPrompt] = useState<string | null>(null);
  const prompt = typed ?? promptFromAddress ?? "";
  const [count, setCountRaw] = useState(1);
  const [attached, setAttached] = useState<Record<string, Asset[]>>({});
  const [uploading, setUploading] = useState(0);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{ message: string; code: string } | null>(null);
  const setError = (message: string | null, code = "blocked") => setFailure(message ? { message, code } : null);
  const fail = (e: unknown) => setError(errorMessage(e), e instanceof ApiError ? e.code : "error");
  const error = failure?.message ?? null;

  const onSurface = (id: string | null) => {
    const m = getModel(id);
    return m && m.surfaces.includes(surface) ? m : undefined;
  };
  const model = onSurface(picked) ?? onSurface(fromAddress) ?? defaultModel(surface);

  const filled: Filled = {};
  for (const [slot, list] of Object.entries(attached)) if (list.length) filled[slot] = list.length;

  const values: Values = model ? resolveValues(model, raw, filled) : {};
  const shown = model ? visibleControls(model, values, filled) : [];
  const slots = model ? visibleSlots(model, values, filled) : [];
  const maxCount = model?.batch.max ?? 1;
  const safeCount = model ? clampCount(model, count) : 1;
  const text = prompt.trim();

  let quote: JobQuote | null = null;
  if (model && model.status === "available") {
    try {
      quote = quoteJob(model, { prompt: text, values, filled, count: safeCount });
    } catch {
      quote = null; // not enough filled in to price yet
    }
  }

  const blocker = findBlocker({ model, text, uploading, slots, attached });

  function roomIn(slot: MediaSlot, now: Record<string, Asset[]>): number {
    return Math.max(0, slot.max - (now[slot.id]?.length ?? 0));
  }

  function attachAssets(slot: MediaSlot, assets: Asset[]) {
    const fitting = assets.filter((a) => slot.accept.includes(a.kind));
    if (fitting.length < assets.length) setError(`"${slot.label}" does not take that kind of file.`);
    setAttached((prev) => {
      const have = prev[slot.id] ?? [];
      const fresh = fitting.filter((a) => !have.some((h) => h.id === a.id)).slice(0, roomIn(slot, prev));
      return fresh.length ? { ...prev, [slot.id]: [...have, ...fresh] } : prev;
    });
  }

  async function attach(slot: MediaSlot, files: File[]) {
    const take = files.slice(0, roomIn(slot, attached));
    if (!take.length) {
      if (files.length) setError(`"${slot.label}" takes at most ${slot.max} ${slot.max === 1 ? "file" : "files"}.`);
      return;
    }
    setError(null);
    let left = take.length;
    setUploading((n) => n + take.length);
    try {
      await ensureSession();
      for (const file of take) {
        const form = new FormData();
        form.set("file", file);
        form.set("accept", slot.accept.join(","));
        const { asset } = await api<{ asset: Asset }>("/api/assets", { method: "POST", body: form });
        setAttached((prev) => (roomIn(slot, prev) ? { ...prev, [slot.id]: [...(prev[slot.id] ?? []), asset] } : prev));
        left -= 1;
        setUploading((n) => n - 1);
      }
    } catch (e) {
      fail(e);
    } finally {
      const rest = left;
      if (rest) setUploading((n) => n - rest);
    }
  }

  function detach(slotId: string, assetId: string) {
    setAttached((prev) => ({ ...prev, [slotId]: (prev[slotId] ?? []).filter((a) => a.id !== assetId) }));
  }

  function slotFor(kind: string, spoken: Record<string, number> = {}): MediaSlot | undefined {
    const taking = slots.filter((s) => s.accept.some((a) => a === kind));
    return taking.find((s) => roomIn(s, attached) > (spoken[s.id] ?? 0)) ?? taking[0];
  }

  async function drop(files: File[]) {
    if (!files.length) return;
    if (!model || !slots.length) {
      setError(model ? `${model.name} does not take reference files.` : "Pick a model first.");
      return;
    }
    const plan = new Map<MediaSlot, File[]>();
    const spoken: Record<string, number> = {};
    for (const file of files) {
      const slot = slotFor(file.type.split("/")[0], spoken);
      if (!slot) continue;
      plan.set(slot, [...(plan.get(slot) ?? []), file]);
      spoken[slot.id] = (spoken[slot.id] ?? 0) + 1;
    }
    if (!plan.size) {
      setError(`${model.name} does not take that kind of file.`);
      return;
    }
    // One slot at a time, so a first-time visitor is signed in as a guest only once.
    for (const [slot, list] of plan) await attach(slot, list);
  }

  async function generate(): Promise<boolean> {
    if (busy) return false;
    if (!model || blocker) {
      setError(blocker);
      return false;
    }
    setBusy(true);
    setError(null);
    try {
      await ensureSession();
      const inputs: Record<string, string[]> = {};
      for (const slot of slots) {
        const ids = (attached[slot.id] ?? []).map((a) => a.id);
        if (ids.length) inputs[slot.id] = ids;
      }
      const res = await api<{ jobs: Job[]; balance: number }>("/api/jobs", {
        method: "POST",
        body: { modelId: model.id, prompt: text, values, inputs, count: safeCount, surface },
      });
      await setBalance(res.balance);
      // Show the new tiles at once, then let the server's own list replace them.
      await mutateCache<{ jobs: Job[] }>(jobsKey(surface), (prev) => ({ jobs: [...res.jobs, ...(prev?.jobs ?? [])] }), {
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

  function load(job: Job) {
    if (onSurface(job.modelId)) setPicked(job.modelId);
    setRaw({ ...job.params });
    setPrompt(job.prompt);
    setError(null);
  }

  return {
    surface,
    models,
    model,
    pickModel: (id) => {
      setPicked(id);
      setError(null);
    },
    prompt,
    setPrompt: (next) => {
      setPrompt(next);
      if (error) setError(null);
    },
    values,
    setValue: (id, value) => setRaw((prev) => ({ ...prev, [id]: value })),
    controls: { main: shown.filter((c) => !c.advanced), advanced: shown.filter((c) => c.advanced) },
    filled,
    slots,
    attached,
    attach,
    attachAssets,
    detach,
    slotFor: (kind) => slotFor(kind),
    drop,
    uploading,
    count: safeCount,
    setCount: (next) => setCountRaw(model ? clampCount(model, next) : 1),
    maxCount,
    quote,
    blocker,
    busy,
    error,
    errorCode: failure?.code ?? null,
    clearError: () => setError(null),
    generate,
    load,
  };
}
