/**
 * Pure helpers over the registry: which controls show, which values are legal,
 * and what a request costs. Shared by the composer and the job service, so both
 * always agree.
 */
import { usdToMillicredits } from "../config/economy";
import { quoteUsd } from "./quote";
import type { BuiltRequest, Condition, Control, MediaRef, MediaSlot, ModelDef, Option, Value, Values } from "./types";

/** How many items sit in each media slot. */
export type Filled = Record<string, number>;

export function matches(cond: Condition | undefined, values: Values, filled: Filled): boolean {
  if (!cond) return true;
  return Object.entries(cond).every(([key, want]) => {
    const actual: Value | undefined = key.startsWith("slot:")
      ? (filled[key.slice(5)] ?? 0) > 0
        ? "filled"
        : "empty"
      : values[key];
    const allowed = Array.isArray(want) ? want : [want];
    return allowed.some((w) => String(w) === String(actual));
  });
}

export function enabledOptions(control: Extract<Control, { type: "select" }>, values: Values, filled: Filled): Option[] {
  return control.options.filter((o) => matches(o.when, values, filled));
}

/** Slots that apply for the current values. */
export function visibleSlots(model: ModelDef, values: Values, filled: Filled): MediaSlot[] {
  return model.slots.filter((s) => matches(s.when, values, filled));
}

/** Controls that apply for the current values. Pass values that came out of `resolveValues`. */
export function visibleControls(model: ModelDef, values: Values, filled: Filled): Control[] {
  return model.controls.filter((c) => matches(c.when, values, filled));
}

/**
 * Turns anything (saved settings, a request body, nothing) into a complete, legal set of
 * values for the model. Controls are resolved in order, so a control may depend on the
 * ones before it. Hidden controls get no value.
 */
export function resolveValues(model: ModelDef, raw: Record<string, unknown> | null | undefined, filled: Filled): Values {
  const out: Values = {};
  for (const c of model.controls) {
    if (!matches(c.when, out, filled)) continue;
    const given = raw?.[c.id];
    switch (c.type) {
      case "select": {
        const open = enabledOptions(c, out, filled);
        if (open.length === 0) break;
        const wanted = given == null ? null : String(given);
        out[c.id] = (open.find((o) => o.value === wanted) ?? open.find((o) => o.value === c.default) ?? open[0]).value;
        break;
      }
      case "slider": {
        const n = typeof given === "number" || typeof given === "string" ? Number(given) : NaN;
        const v = Number.isFinite(n) ? n : c.default;
        const snapped = Math.round((Math.min(c.max, Math.max(c.min, v)) - c.min) / c.step) * c.step + c.min;
        out[c.id] = Number(snapped.toFixed(4));
        break;
      }
      case "toggle":
        out[c.id] = typeof given === "boolean" ? given : given === "true" ? true : given === "false" ? false : c.default;
        break;
      case "text":
        out[c.id] = (typeof given === "string" ? given : c.default).slice(0, c.maxLength);
        break;
    }
  }
  return out;
}

/** The id inside `asset:<id>` and `asset-b64:<id>` placeholders. */
export const ASSET_URL_PREFIX = "asset:";
export const ASSET_DATA_PREFIX = "asset-b64:";

export function assetRef(assetId: string, mime: string): MediaRef {
  return { url: ASSET_URL_PREFIX + assetId, data: ASSET_DATA_PREFIX + assetId, mime };
}

/** Stand-in media for pricing a request before anything is uploaded. */
function placeholderMedia(filled: Filled): Record<string, MediaRef[]> {
  const media: Record<string, MediaRef[]> = {};
  for (const [slot, n] of Object.entries(filled)) {
    media[slot] = Array.from({ length: Math.max(0, n) }, () => assetRef("pending", "image/png"));
  }
  return media;
}

export interface JobQuote {
  /** Total for this press of Generate, in millicredits. */
  millicredits: number;
  /** Price of one job, in millicredits. */
  perJob: number;
  /** Provider cost of one job, in US dollars. */
  usdPerJob: number;
  /** Separate jobs that will be queued. */
  jobs: number;
  /** Results each job returns. */
  perJobCount: number;
  exact: boolean;
  /** True when the provider bills by usage: this is the most the job can cost, and less may be charged. */
  metered: boolean;
  request: BuiltRequest;
}

export interface JobDraft {
  prompt: string;
  /** Already resolved with `resolveValues`. */
  values: Values;
  /** Real media, or omitted to price with placeholders taken from `filled`. */
  media?: Record<string, MediaRef[]>;
  filled: Filled;
  count: number;
}

export function clampCount(model: ModelDef, count: number): number {
  return Math.min(model.batch.max, Math.max(1, Math.floor(Number(count) || 1)));
}

/** Builds the provider request and prices it. The same call runs in the browser and on the server. */
export function quoteJob(model: ModelDef, draft: JobDraft): JobQuote {
  const n = clampCount(model, draft.count);
  const perJobCount = model.batch.native ? n : 1;
  const jobs = model.batch.native ? 1 : n;
  const request = model.build({
    prompt: draft.prompt,
    values: draft.values,
    media: draft.media ?? placeholderMedia(draft.filled),
    count: perJobCount,
  });
  const q = quoteUsd(request.endpoint, request.body);
  const perJob = usdToMillicredits(q.usd);
  return { millicredits: perJob * jobs, perJob, usdPerJob: q.usd, jobs, perJobCount, exact: q.exact, metered: q.metered, request };
}

/** `16:9` -> 1.777. Falls back to square, or to the given default. */
export function aspectNumber(aspect: unknown, fallback = 1): number {
  if (typeof aspect !== "string") return fallback;
  const m = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(aspect);
  if (!m) return fallback;
  const r = Number(m[1]) / Number(m[2]);
  return Number.isFinite(r) && r > 0 ? r : fallback;
}
