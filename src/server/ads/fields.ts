import "server-only";

import { badRequest } from "@/server/errors";
import { ownedAsset } from "@/server/assets";

/** Small, strict readers for request bodies. Each throws a 400 written for the member. */

export const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export function text(body: Record<string, unknown>, key: string, label: string, max: number, required = false): string {
  const v = body[key];
  if (v == null) {
    if (required) throw badRequest(`Add ${label}.`);
    return "";
  }
  if (typeof v !== "string") throw badRequest(`${cap(label)} must be text.`);
  const out = v.replace(/\s+/g, " ").trim();
  if (required && !out) throw badRequest(`Add ${label}.`);
  if (out.length > max) throw badRequest(`Keep ${label} under ${max} characters.`);
  return out;
}

/** Like `text` but keeps line breaks (scripts). */
export function longText(body: Record<string, unknown>, key: string, label: string, max: number): string {
  const v = body[key];
  if (v == null) return "";
  if (typeof v !== "string") throw badRequest(`${cap(label)} must be text.`);
  const out = v.replace(/\r\n/g, "\n").trim();
  if (out.length > max) throw badRequest(`Keep ${label} under ${max} characters.`);
  return out;
}

export function textList(body: Record<string, unknown>, key: string, label: string, maxItems: number, maxLen: number): string[] {
  const v = body[key];
  if (v == null) return [];
  if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) throw badRequest(`${cap(label)} must be a list of text.`);
  const out = (v as string[]).map((x) => x.replace(/\s+/g, " ").trim()).filter(Boolean);
  if (out.length > maxItems) throw badRequest(`Use at most ${maxItems} ${label}.`);
  if (out.some((x) => x.length > maxLen)) throw badRequest(`Keep each of the ${label} under ${maxLen} characters.`);
  return [...new Set(out)];
}

export function link(body: Record<string, unknown>, key: string): string {
  const out = text(body, key, "the link", 500);
  if (!out) return "";
  try {
    const u = new URL(out);
    if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error();
    return u.toString();
  } catch {
    throw badRequest("Enter a full web link, starting with https://");
  }
}

/** One of the member's own images. Someone else's id reads as "does not exist". */
export function ownImage(userId: string, id: unknown, label: string): string {
  if (typeof id !== "string" || id.length > 80) throw badRequest(`${cap(label)} must be a file id.`);
  const asset = ownedAsset(userId, id);
  if (asset.kind !== "image") throw badRequest(`${cap(label)} must be an image.`);
  return asset.id;
}

export function has(body: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(body, key);
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
