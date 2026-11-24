import "server-only";

import { badRequest } from "@/server/errors";

/** Most files one bulk call may touch. */
export const BULK_MAX = 200;

/** Days a file stays in the trash before it is deleted for good. */
export const TRASH_DAYS = 30;
export const TRASH_MS = TRASH_DAYS * 86_400_000;

export const KINDS = ["image", "video", "audio"] as const;
export const SOURCES = ["generated", "upload"] as const;

/** `?, ?, ?` for an IN list. */
export function marks(n: number): string {
  return Array.from({ length: n }, () => "?").join(",");
}

/** Reads a list of file ids from a body field: 1..max distinct short strings. */
export function idList(value: unknown, max = BULK_MAX, what = "files"): string[] {
  if (!Array.isArray(value) || value.length === 0) throw badRequest(`Pick at least one of your ${what}.`);
  if (value.length > max) throw badRequest(`You can change at most ${max} ${what} at once.`);
  const out = new Set<string>();
  for (const v of value) {
    if (typeof v !== "string" || v.length === 0 || v.length > 64) throw badRequest(`One of those ${what} is not valid.`);
    out.add(v);
  }
  return [...out];
}

/** Escapes LIKE wildcards so a search for "50%" means the text "50%". Use with `ESCAPE '\'`. */
export function likePattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** Opaque paging cursor: the sort key and the row's seq of the last item on a page. */
export function encodeCursor(key: string | number, seq: number): string {
  return Buffer.from(JSON.stringify([key, seq])).toString("base64url");
}

export function decodeCursor(text: string | null): [string | number, number] | null {
  if (!text) return null;
  try {
    const v: unknown = JSON.parse(Buffer.from(text, "base64url").toString("utf8"));
    if (Array.isArray(v) && v.length === 2 && (typeof v[0] === "string" || typeof v[0] === "number") && Number.isInteger(v[1])) {
      return [v[0], v[1] as number];
    }
  } catch {
    /* fall through */
  }
  throw badRequest("That page link is out of date. Reload the list.");
}
