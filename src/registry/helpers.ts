/** Small builders so model definitions read like a spec sheet. */
import type { Condition, Option, SelectControl, SliderControl, TextControl, ToggleControl } from "./types";

type OptionInput = string | Option;

function toOption(o: OptionInput): Option {
  return typeof o === "string" ? { value: o, label: o } : o;
}

export function select(
  id: string,
  label: string,
  options: OptionInput[],
  defaultValue: string,
  extra: Partial<Omit<SelectControl, "id" | "label" | "options" | "default" | "type">> = {},
): SelectControl {
  return { type: "select", id, label, options: options.map(toOption), default: defaultValue, display: "chips", ...extra };
}

export function aspect(values: OptionInput[], defaultValue?: string): SelectControl {
  const options = values.map(toOption);
  return { type: "select", id: "aspect", label: "Aspect ratio", options, default: defaultValue ?? options[0].value, display: "aspect" };
}

export function resolution(values: OptionInput[], defaultValue: string, label = "Resolution"): SelectControl {
  return select("resolution", label, values, defaultValue);
}

/** A list of lengths draws chips. A range draws a slider. */
export function duration(spec: number[] | { min: number; max: number }, defaultValue: number, label = "Duration"): SelectControl | SliderControl {
  if (Array.isArray(spec)) {
    return select("duration", label, spec.map((s) => ({ value: String(s), label: `${s}s` })), String(defaultValue));
  }
  return { type: "slider", id: "duration", label, min: spec.min, max: spec.max, step: 1, default: defaultValue, unit: "s" };
}

export function toggle(id: string, label: string, defaultValue: boolean, extra: Partial<Omit<ToggleControl, "id" | "label" | "default" | "type">> = {}): ToggleControl {
  return { type: "toggle", id, label, default: defaultValue, ...extra };
}

export function audio(defaultValue = true): ToggleControl {
  return toggle("audio", "Sound", defaultValue, { hint: "Generate dialogue, effects and ambience with the picture." });
}

export function slider(id: string, label: string, min: number, max: number, step: number, defaultValue: number, extra: Partial<Omit<SliderControl, "id" | "label" | "min" | "max" | "step" | "default" | "type">> = {}): SliderControl {
  return { type: "slider", id, label, min, max, step, default: defaultValue, ...extra };
}

export function text(id: string, label: string, maxLength: number, extra: Partial<Omit<TextControl, "id" | "label" | "maxLength" | "type">> = {}): TextControl {
  return { type: "text", id, label, maxLength, default: "", ...extra };
}

export function opt(value: string, label?: string, extra: { hint?: string; when?: Condition } = {}): Option {
  return { value, label: label ?? value, ...extra };
}

/** Drops undefined entries, so optional fields never reach the provider as nulls. */
export function compact<T extends Record<string, unknown>>(obj: T): T {
  for (const k of Object.keys(obj)) if (obj[k] === undefined) delete obj[k];
  return obj;
}
