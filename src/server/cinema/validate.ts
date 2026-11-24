import "server-only";

import { getModel, type ModelDef } from "@/registry";
import { badRequest } from "@/server/errors";
import type { Preset } from "./presets";

/** Small readers for request bodies. Every field is checked for type and length here. */

export function text(body: Record<string, unknown>, field: string, label: string, max: number): string | undefined {
  const v = body[field];
  if (v === undefined) return undefined;
  if (v === null) return "";
  if (typeof v !== "string") throw badRequest(`${label} must be text.`);
  const t = v.trim();
  if (t.length > max) throw badRequest(`Keep ${label.toLowerCase()} under ${max} characters.`);
  return t;
}

export function requiredText(body: Record<string, unknown>, field: string, label: string, max: number): string {
  const t = text(body, field, label, max);
  if (!t) throw badRequest(`Give it ${label.toLowerCase()}.`);
  return t;
}

/** A preset id from `list`, or "" to clear. */
export function preset(body: Record<string, unknown>, field: string, label: string, list: Preset[]): string | undefined {
  const v = body[field];
  if (v === undefined) return undefined;
  if (v === null || v === "") return "";
  if (typeof v !== "string" || !list.some((x) => x.id === v)) throw badRequest(`That ${label.toLowerCase()} is not one of the choices.`);
  return v;
}

export function idList(body: Record<string, unknown>, field: string, label: string, max: number): string[] | undefined {
  const v = body[field];
  if (v === undefined) return undefined;
  if (v === null) return [];
  if (!Array.isArray(v) || v.length > max || v.some((x) => typeof x !== "string" || x.length > 64)) {
    throw badRequest(`${label} must be a list of at most ${max} ids.`);
  }
  return [...new Set(v as string[])];
}

/** Can make a still for a shot. */
export function isStillModel(m: ModelDef | undefined): m is ModelDef {
  return !!m && m.output === "image" && m.status === "available" && !!m.prompt;
}

/** Can take a start frame: used to animate a still. */
export function canAnimate(m: ModelDef | undefined): m is ModelDef {
  return !!m && m.output === "video" && m.status === "available" && !!m.prompt && m.slots.some((s) => s.id === "start");
}

/** Can make video from words alone. */
export function canTextToVideo(m: ModelDef | undefined): m is ModelDef {
  return !!m && m.output === "video" && m.status === "available" && !!m.prompt && m.slots.every((s) => s.min === 0);
}

export function isMotionModel(m: ModelDef | undefined): m is ModelDef {
  return canAnimate(m) || canTextToVideo(m);
}

export function stillModel(id: unknown): ModelDef {
  const m = getModel(typeof id === "string" ? id : null);
  if (!isStillModel(m)) throw badRequest("Pick an image model for stills.");
  return m;
}

export function motionModel(id: unknown): ModelDef {
  const m = getModel(typeof id === "string" ? id : null);
  if (!isMotionModel(m)) throw badRequest("Pick a video model for motion.");
  return m;
}
