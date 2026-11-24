import "server-only";

import { getModel, type ModelDef, type Values } from "@/registry";
import { assetById } from "@/server/assets";
import { parseJson } from "@/server/db";
import { ANGLES, FILM_STOCKS, FOCUS, GRADES, LENSES, LENS_FAMILIES, LIGHTING_STYLES, MOODS, MOVEMENTS, SHOT_SIZES, presetById } from "./presets";
import { lookOf, type ElementRow, type ProjectRow, type ShotRow } from "./store";

/**
 * The prompt composer. Pure apart from checking that reference files still exist:
 * the same shot, project and elements always give the same prompt and the same slots.
 *
 * Sentence order (empty parts are left out):
 *   1. Framing      "<Shot size> <angle>."               e.g. "Close-up from a low angle."
 *   2. Action       "<action>."
 *   3. Cast         "Featuring <name> (<description>); <name> (...)."  characters and props, in cast order
 *   4. Place        "Location: <name>, <description>."
 *   5. Camera       "<movement sentence>" (video only)  "Shot with a <lens>, <depth of field>."
 *   6. Light, mood  "Lighting: <shot lighting, else the project's lighting>. Mood: <mood>."
 *   7. Look         "Look: <film stock>, <grade>, <lens family>."
 *   8. Sound        "Sound: <note>." (video only)
 * The result is cut to the model's prompt limit.
 */

export type Mode = "still" | "animate" | "text";

export interface Composed {
  modelId: string;
  mode: Mode;
  prompt: string;
  values: Values;
  /** `{ slotId: [assetId] }`, ready for `submitJobs`. */
  inputs: Record<string, string[]>;
  /** Things the member may want to know: references that did not fit, a ratio the model lacks... */
  notes: string[];
}

/** What a shot with nothing filled in sends as its prompt. */
export const EMPTY_PROMPT = "A cinematic shot.";

const sentence = (s: string) => {
  const t = s.trim().replace(/\s+/g, " ");
  if (!t) return "";
  const cap = t[0].toUpperCase() + t.slice(1);
  return /[.!?]$/.test(cap) ? cap : `${cap}.`;
};

const describe = (e: ElementRow) => (e.description ? `${e.name} (${e.description})` : e.name);

export function composePrompt(project: ProjectRow, shot: ShotRow, elements: ElementRow[], mode: Mode): string {
  const byId = new Map(elements.map((e) => [e.id, e]));
  const cast = parseJson<string[]>(shot.cast_ids, []).map((id) => byId.get(id)).filter((e): e is ElementRow => !!e);
  const place = shot.location_id ? byId.get(shot.location_id) : undefined;
  const look = lookOf(project);
  const motion = mode !== "still";

  const size = presetById(SHOT_SIZES, shot.size)?.phrase;
  const angle = presetById(ANGLES, shot.angle)?.phrase;
  const lens = presetById(LENSES, shot.lens)?.phrase;
  const focus = presetById(FOCUS, shot.focus)?.phrase;
  const lighting = presetById(LIGHTING_STYLES, shot.lighting || look.lighting)?.phrase;
  const mood = presetById(MOODS, shot.mood)?.phrase;
  const lookParts = [presetById(FILM_STOCKS, look.filmStock)?.phrase, presetById(GRADES, look.grade)?.phrase, presetById(LENS_FAMILIES, look.lensFamily)?.phrase].filter(Boolean);

  const parts = [
    sentence([size ?? (angle ? "Shot" : ""), angle].filter(Boolean).join(" ")),
    sentence(shot.action),
    cast.length ? sentence(`Featuring ${cast.map(describe).join("; ")}`) : "",
    place ? sentence(`Location: ${place.description ? `${place.name}, ${place.description}` : place.name}`) : "",
    motion ? (presetById(MOVEMENTS, shot.movement)?.phrase ?? "") : "",
    lens || focus ? sentence(`Shot with ${[lens ? `a ${lens}` : "", focus].filter(Boolean).join(", ")}`) : "",
    lighting ? sentence(`Lighting: ${lighting}`) : "",
    mood ? sentence(`Mood: ${mood}`) : "",
    lookParts.length ? sentence(`Look: ${lookParts.join(", ")}`) : "",
    motion && shot.sound ? sentence(`Sound: ${shot.sound}`) : "",
  ];
  return parts.filter(Boolean).join(" ");
}

/** Reference images in a fixed order: cast (in cast order), then the location. Missing files are skipped. */
export function gatherRefs(userId: string, shot: ShotRow, elements: ElementRow[]): string[] {
  const byId = new Map(elements.map((e) => [e.id, e]));
  const order = [...parseJson<string[]>(shot.cast_ids, []), ...(shot.location_id ? [shot.location_id] : [])];
  const out: string[] = [];
  for (const id of order) {
    const el = byId.get(id);
    if (!el) continue;
    for (const assetId of parseJson<string[]>(el.ref_asset_ids, [])) {
      const a = assetById(assetId);
      if (a && a.user_id === userId && a.kind === "image" && !out.includes(assetId)) out.push(assetId);
    }
  }
  return out;
}

function pickAspect(model: ModelDef, aspect: string, notes: string[]): string | undefined {
  const control = model.controls.find((c) => c.id === "aspect");
  if (!control || control.type !== "select") return undefined;
  if (control.options.some((o) => o.value === aspect)) return aspect;
  notes.push(`${model.name} cannot make ${aspect}; it uses ${control.default} instead.`);
  return undefined;
}

function pickDuration(model: ModelDef, seconds: number): number | string | undefined {
  const control = model.controls.find((c) => c.id === "duration");
  if (!control) return undefined;
  if (control.type === "slider") return seconds;
  if (control.type === "select") {
    const nums = control.options.map((o) => o.value).filter((v) => Number.isFinite(Number(v)));
    if (!nums.length) return undefined;
    return nums.reduce((best, v) => (Math.abs(Number(v) - seconds) < Math.abs(Number(best) - seconds) ? v : best));
  }
  return undefined;
}

/** The values every take sends: the ratio and, for video, the length. Also prices a shot that does not exist yet. */
export function baseValues(model: ModelDef, mode: Mode, aspect: string, seconds: number, notes: string[] = []): Values {
  const values: Values = {};
  const ratio = pickAspect(model, aspect, notes);
  if (ratio) values.aspect = ratio;
  if (mode !== "still") {
    const d = pickDuration(model, seconds);
    if (d !== undefined) values.duration = d;
  }
  return values;
}

/**
 * Builds everything `submitJobs` needs for one take.
 * `startAssetId` is the still to animate (mode "animate" only).
 */
export function composeShot(opts: {
  userId: string;
  project: ProjectRow;
  shot: ShotRow;
  elements: ElementRow[];
  mode: Mode;
  model: ModelDef;
  startAssetId?: string | null;
  values?: Record<string, unknown>;
}): Composed {
  const { userId, project, shot, elements, mode, model } = opts;
  const notes: string[] = [];
  let prompt = composePrompt(project, shot, elements, mode);
  if (!prompt) prompt = EMPTY_PROMPT;
  const max = model.prompt?.maxLength ?? 2000;
  if (prompt.length > max) {
    prompt = prompt.slice(0, max);
    notes.push(`The prompt was cut to ${max} characters for ${model.name}.`);
  }

  const values = baseValues(model, mode, project.aspect, shot.duration, notes);
  // Explicit overrides from the caller win; submitJobs still checks every value.
  for (const [k, v] of Object.entries(opts.values ?? {})) {
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") values[k] = v;
  }

  const inputs: Record<string, string[]> = {};
  if (mode === "animate" && opts.startAssetId) inputs.start = [opts.startAssetId];
  const refs = gatherRefs(userId, shot, elements);
  const refSlot = model.slots.find((s) => s.id === "refs");
  if (refs.length && mode === "still") {
    if (!refSlot) notes.push(`${model.name} does not take reference images, so the cast and place pictures are not used.`);
    else {
      inputs.refs = refs.slice(0, refSlot.max);
      if (refs.length > refSlot.max) notes.push(`${model.name} takes ${refSlot.max} reference images; ${refs.length - refSlot.max} were left out.`);
    }
  } else if (refs.length && mode === "text") {
    notes.push("Video from text alone does not use reference images. Make a still first and animate it to keep the look.");
  }
  return { modelId: model.id, mode, prompt, values, inputs, notes };
}

export function modelFor(project: ProjectRow, mode: Mode, override: unknown): ModelDef | undefined {
  if (typeof override === "string" && override) return getModel(override);
  return getModel(mode === "still" ? project.image_model_id : project.video_model_id);
}
