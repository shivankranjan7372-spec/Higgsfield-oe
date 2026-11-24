/**
 * An app is a one-purpose tool on top of one registry model: a small form, one button.
 * Apps are plain data. This file imports nothing from Node, so the catalog can be checked
 * from a script as well as from the server.
 */
import type { MediaType, Values } from "@/registry";

export type AppCategory = "image-tool" | "video-tool" | "effect" | "template";

export const CATEGORIES: { id: AppCategory; label: string }[] = [
  { id: "image-tool", label: "Image tools" },
  { id: "video-tool", label: "Video tools" },
  { id: "effect", label: "Effects" },
  { id: "template", label: "Templates" },
];

export type AppStatus = "available" | "soon";

interface FieldBase {
  /** Used as `{{id}}` in the prompt template. Lowercase letters, digits and underscores. */
  id: string;
  label: string;
  hint?: string;
}

export interface TextField extends FieldBase {
  type: "text";
  required: boolean;
  default: string;
  placeholder?: string;
  maxLength: number;
}

export interface ChoiceOption {
  value: string;
  label: string;
  /** What goes into the prompt. Defaults to the label. */
  prompt?: string;
}

export interface ChoiceField extends FieldBase {
  type: "choice";
  options: ChoiceOption[];
  default: string;
}

export interface NumberField extends FieldBase {
  type: "number";
  min: number;
  max: number;
  step: number;
  default: number;
  unit?: string;
}

export interface ColourField extends FieldBase {
  type: "colour";
  /** `#rrggbb`. */
  default: string;
}

export type AppField = TextField | ChoiceField | NumberField | ColourField;

/** One upload tile on the form, mapped to one of the model's media slots. */
export interface AppInput {
  id: string;
  label: string;
  hint?: string;
  /** The model slot the files go into. Several inputs may share a slot; their files are joined in form order. */
  slot: string;
  min: number;
  max: number;
}

export interface AppDef {
  /** URL-safe, at most 36 characters. */
  id: string;
  name: string;
  category: AppCategory;
  /** One line under the name. */
  pitch: string;
  tags: string[];
  /** Null only for `soon` apps whose model does not exist yet. */
  modelId: string | null;
  /** Control values the app runs with. For a control listed in `open`, this is only its starting value. */
  values: Values;
  /** Model controls the member may set on the form (aspect, duration...). All others are fixed. */
  open: string[];
  /** The prompt. `{{field}}` is replaced by the checked value; `{{?field}}...{{/field}}` is kept only when the field is not empty. */
  template: string;
  fields: AppField[];
  inputs: AppInput[];
  result: MediaType;
  status: AppStatus;
  /** Why a `soon` app cannot run yet. */
  note?: string;
  badge?: "new" | "trending";
  /** `YYYY-MM-DD`, for the "new" sort. */
  added: string;
}
