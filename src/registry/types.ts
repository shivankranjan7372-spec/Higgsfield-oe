/**
 * The model registry is plain data plus one pure function per model (`build`).
 * It imports nothing from Node or React, so the browser and the server share it:
 * the browser renders the composer and the live price from it, the server validates
 * and prices the same request again before it spends anything.
 */

export type Kind = "image" | "video" | "audio" | "music";
export type MediaType = "image" | "video" | "audio";

export type Value = string | number | boolean;
export type Values = Record<string, Value>;

/**
 * All entries must hold. A key is a control id, or `slot:<slotId>` whose value is
 * "filled" or "empty". An array means "any of".
 */
export type Condition = Record<string, Value | Value[]>;

export interface Option {
  value: string;
  label: string;
  hint?: string;
  /** The option can only be chosen while this holds. */
  when?: Condition;
}

interface ControlBase {
  /**
   * Shared ids the UI understands: `aspect`, `resolution`, `duration`, `audio`,
   * `quality`, `voice`. Anything else is rendered generically.
   */
  id: string;
  label: string;
  hint?: string;
  /** The control is hidden, and its value dropped, unless this holds. */
  when?: Condition;
  /** Tucked behind the "More" popover in the composer. */
  advanced?: boolean;
}

export interface SelectControl extends ControlBase {
  type: "select";
  options: Option[];
  default: string;
  /** `aspect` draws ratio glyphs, `chips` a segmented row, `menu` a dropdown. */
  display?: "chips" | "menu" | "aspect";
}

export interface SliderControl extends ControlBase {
  type: "slider";
  min: number;
  max: number;
  step: number;
  default: number;
  unit?: string;
}

export interface ToggleControl extends ControlBase {
  type: "toggle";
  default: boolean;
}

export interface TextControl extends ControlBase {
  type: "text";
  default: string;
  placeholder?: string;
  maxLength: number;
}

export type Control = SelectControl | SliderControl | ToggleControl | TextControl;

export interface MediaSlot {
  /** Shared ids: `start`, `end`, `refs`, `portrait`, `voice`. */
  id: string;
  label: string;
  hint?: string;
  accept: MediaType[];
  min: number;
  max: number;
  when?: Condition;
}

/**
 * A reference to an uploaded or generated asset inside a request body.
 * While pricing, and in the stored job, both fields are placeholders
 * (`asset:<id>` and `asset-b64:<id>`). The worker swaps them for a public URL
 * or base64 data just before the provider call.
 */
export interface MediaRef {
  url: string;
  data: string;
  mime: string;
}

export interface BuildContext {
  prompt: string;
  values: Values;
  media: Record<string, MediaRef[]>;
  /** How many results this one request should return. Only above 1 when `batch.native`. */
  count: number;
}

export interface BuiltRequest {
  /** A Treg endpoint id from `treg-catalog.json`. */
  endpoint: string;
  /** The provider's own request body, unchanged by Treg. */
  body: Record<string, unknown>;
  /** Path and query parameters. Treg takes both in the query string. */
  query?: Record<string, string>;
  /** Headers the provider itself wants. The catalog lists the ones an endpoint requires. */
  headers?: Record<string, string>;
}

export type ModelStatus = "available" | "offline" | "soon";

export interface ModelDef {
  id: string;
  kind: Kind;
  name: string;
  /** Who made the model, for the picker's group headings. */
  vendor: string;
  tagline: string;
  badges?: string[];
  featured?: boolean;
  status: ModelStatus;
  /** Shown instead of the tagline when the model cannot be used. */
  statusNote?: string;
  /** Which studios and tools list this model: `image`, `video`, `speech`, `music`, `avatar`... */
  surfaces: string[];
  prompt: { required: boolean; maxLength: number; label?: string; placeholder?: string } | null;
  slots: MediaSlot[];
  controls: Control[];
  batch: {
    /** Most results per press of Generate. */
    max: number;
    /** True when one provider call can return several results. Otherwise we queue one job each. */
    native: boolean;
  };
  output: MediaType;
  /** Typical seconds to a result, for the progress bar. */
  eta: number;
  build(ctx: BuildContext): BuiltRequest;
}
