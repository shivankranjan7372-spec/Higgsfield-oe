import "server-only";

import { badRequest } from "@/server/errors";

export const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** A trimmed string, or a 400 when it is missing, not a string or too long. */
export function text(v: unknown, label: string, max: number, opts: { required?: boolean } = {}): string {
  if (v == null || v === "") {
    if (opts.required) throw badRequest(`${label} is required.`);
    return "";
  }
  if (typeof v !== "string") throw badRequest(`${label} must be text.`);
  const t = v.trim();
  if (opts.required && !t) throw badRequest(`${label} is required.`);
  if (t.length > max) throw badRequest(`Keep ${label.toLowerCase()} under ${max.toLocaleString("en-US")} characters.`);
  return t;
}

export function idList(v: unknown, label: string, max: number): string[] {
  if (v == null) return [];
  if (!Array.isArray(v) || v.length > max || v.some((x) => typeof x !== "string" || x.length > 64)) {
    throw badRequest(`${label} must be a list of at most ${max} ids.`);
  }
  return [...new Set(v as string[])];
}

export function bool(v: unknown, label: string): boolean | undefined {
  if (v == null) return undefined;
  if (typeof v !== "boolean") throw badRequest(`${label} must be true or false.`);
  return v;
}

/**
 * Wraps text from a computer, a connector or the web so the model reads it as data.
 * The closing tag is defused so the content cannot end the wrapper early.
 */
export function asData(source: string, content: string): string {
  // Neither the wrapper nor the member-message tag can be closed or faked from inside.
  const safe = content.replace(/<\/?(untrusted-data|member-message)/gi, (m) => m.replace("<", "&lt;"));
  return `<untrusted-data source="${source}">\n${safe}\n</untrusted-data>`;
}

export function clip(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** A tool call's input, cut down to what an activity row may hold. */
export function summarizeInput(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input).slice(0, 12)) out[k] = typeof v === "string" ? clip(v, 300) : v;
  const text = JSON.stringify(out);
  return text.length > 2000 ? { preview: clip(text, 2000) } : out;
}
