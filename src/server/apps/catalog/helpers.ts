/** Small builders so catalog entries read like a menu card, not boilerplate. */
import { getModel } from "@/registry";
import type { AppCategory, AppDef, AppField, AppInput, ChoiceField, ChoiceOption, ColourField, NumberField, TextField } from "../types";

type Defaults = "values" | "open" | "fields" | "inputs" | "status" | "added" | "tags" | "result";
type Entry = Omit<AppDef, Defaults> & Partial<Pick<AppDef, Defaults>>;

/** Fills the usual defaults. The result kind follows the model's output unless given. */
export function app(e: Entry): AppDef {
  const output = getModel(e.modelId)?.output ?? "image";
  return { values: {}, open: [], fields: [], inputs: [], status: "available", added: "2026-10-01", tags: [], result: output, ...e };
}

export function text(id: string, label: string, o: Partial<Omit<TextField, "id" | "label" | "type">> = {}): TextField {
  return { type: "text", id, label, required: false, default: "", maxLength: 200, ...o };
}

export function choice(id: string, label: string, options: (string | ChoiceOption)[], o: Partial<Omit<ChoiceField, "id" | "label" | "type" | "options">> = {}): ChoiceField {
  const list = options.map((x) => (typeof x === "string" ? { value: x.toLowerCase().replace(/[^a-z0-9]+/g, "-"), label: x } : x));
  return { type: "choice", id, label, options: list, default: list[0].value, ...o };
}

export function num(id: string, label: string, min: number, max: number, step: number, def: number, o: Partial<Omit<NumberField, "id" | "label" | "type">> = {}): NumberField {
  return { type: "number", id, label, min, max, step, default: def, ...o };
}

export function colour(id: string, label: string, def: string, o: Partial<Omit<ColourField, "id" | "label" | "type" | "default">> = {}): ColourField {
  return { type: "colour", id, label, default: def, ...o };
}

export function input(id: string, label: string, slot: string, o: Partial<Omit<AppInput, "id" | "label" | "slot">> = {}): AppInput {
  return { id, label, slot, min: 1, max: 1, ...o };
}

/** A photo for an image-editing model. */
export const photo = (label = "Photo", hint?: string): AppInput => input("photo", label, "refs", { hint });
/** A still that becomes the first frame of a clip. */
export const still = (label = "Image", hint = "The first frame of the clip."): AppInput => input("image", label, "start", { hint });

export type { AppCategory, AppField };
