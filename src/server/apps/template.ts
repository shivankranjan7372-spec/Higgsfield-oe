/**
 * The prompt template engine. It only substitutes checked field values into fixed text:
 *
 *   {{field}}                  the field's value
 *   {{?field}}text{{/field}}   `text` (which may hold other {{field}}s) only when the field is not empty
 *
 * It never evaluates anything. Member text cannot add placeholders: braces are removed from it,
 * and substitution is one pass, so an inserted value is never read again.
 */
import type { AppDef, AppField } from "./types";

export class FieldError extends Error {}

export type FieldValues = Record<string, string | number>;

const COLOUR = /^#[0-9a-fA-F]{6}$/;

/** Cleans member text: no control characters, no braces, single spaces. */
export function cleanText(raw: string): string {
  return raw
    .replace(/[\u0000-\u001f\u007f{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Checks one field. Returns the stored value. Throws `FieldError` with a message for the member. */
export function checkField(f: AppField, raw: unknown): string | number {
  switch (f.type) {
    case "text": {
      if (raw != null && typeof raw !== "string") throw new FieldError(`"${f.label}" must be text.`);
      const text = raw == null ? f.default : cleanText(raw);
      if (text.length > f.maxLength) throw new FieldError(`Keep "${f.label}" under ${f.maxLength} characters.`);
      if (f.required && !text) throw new FieldError(`Fill in "${f.label}" first.`);
      return text;
    }
    case "choice": {
      if (raw == null) return f.default;
      const hit = f.options.find((o) => o.value === raw);
      if (!hit) throw new FieldError(`Pick one of the options for "${f.label}".`);
      return hit.value;
    }
    case "number": {
      if (raw == null) return f.default;
      const n = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() ? Number(raw) : NaN;
      if (!Number.isFinite(n)) throw new FieldError(`"${f.label}" must be a number.`);
      if (n < f.min || n > f.max) throw new FieldError(`"${f.label}" must be between ${f.min} and ${f.max}.`);
      return Number((Math.round((n - f.min) / f.step) * f.step + f.min).toFixed(4));
    }
    case "colour": {
      if (raw == null) return f.default;
      if (typeof raw !== "string" || !COLOUR.test(raw.trim())) throw new FieldError(`"${f.label}" must be a colour like #1a2b3c.`);
      return raw.trim().toLowerCase();
    }
  }
}

/** Checks every field of the app. Unknown keys are ignored. */
export function checkFields(app: AppDef, raw: unknown): FieldValues {
  const given = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const out: FieldValues = {};
  for (const f of app.fields) out[f.id] = checkField(f, given[f.id]);
  return out;
}

/** The text a checked value puts into the prompt. */
function promptText(f: AppField, value: string | number): string {
  if (f.type === "choice") {
    const o = f.options.find((x) => x.value === value);
    return o ? (o.prompt ?? o.label) : "";
  }
  if (f.type === "number") return `${value}${!f.unit ? "" : f.unit === "%" ? "%" : ` ${f.unit}`}`;
  return String(value);
}

const SECTION = /\{\{\?([a-z0-9_]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;
const SLOT = /\{\{([a-z0-9_]+)\}\}/g;

/** Every field id the template mentions, for the catalog check. */
export function templateNames(template: string): string[] {
  const names = new Set<string>();
  for (const m of template.matchAll(SECTION)) names.add(m[1]);
  for (const m of template.replace(SECTION, "$2").matchAll(SLOT)) names.add(m[1]);
  return [...names];
}

/** Builds the prompt from checked values. */
export function render(app: AppDef, values: FieldValues): string {
  const byId = new Map(app.fields.map((f) => [f.id, f]));
  const text = (id: string) => {
    const f = byId.get(id);
    return f ? promptText(f, values[id] ?? "") : "";
  };
  // Sections first, on the template only. Then one pass over the slots: inserted text is never rescanned.
  const shaped = app.template.replace(SECTION, (_all, id: string, inner: string) => (text(id).trim() ? inner : ""));
  return shaped
    .replace(SLOT, (_all, id: string) => text(id))
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}
