import "server-only";

import { all, run, tx } from "@/server/db";
import { badRequest } from "@/server/errors";

/** A small, fixed set of per-member settings. Unknown keys are refused, so the store stays small. */

export const LANGUAGES = ["en", "es", "fr", "de", "it", "pt", "nl", "pl", "tr", "ja", "ko", "zh"] as const;
export const NOTICES = ["jobFinished", "jobFailed", "lowCredits", "billing", "productNews", "tips"] as const;

export interface Preferences {
  defaultPrivacy: "private" | "public";
  language: (typeof LANGUAGES)[number];
  theme: "system" | "dark" | "light";
  notices: Record<(typeof NOTICES)[number], boolean>;
}

export const DEFAULTS: Preferences = {
  defaultPrivacy: "private",
  language: "en",
  theme: "system",
  notices: { jobFinished: true, jobFailed: true, lowCredits: true, billing: true, productNews: false, tips: true },
};

type Key = keyof Preferences;

function check(key: string, value: unknown): unknown {
  switch (key as Key) {
    case "defaultPrivacy":
      if (value !== "private" && value !== "public") throw badRequest("Default privacy is private or public.");
      return value;
    case "language":
      if (typeof value !== "string" || !(LANGUAGES as readonly string[]).includes(value)) throw badRequest("That language is not available.");
      return value;
    case "theme":
      if (value !== "system" && value !== "dark" && value !== "light") throw badRequest("Theme is system, dark or light.");
      return value;
    case "notices": {
      if (!value || typeof value !== "object" || Array.isArray(value)) throw badRequest("Send notices as an object of on/off switches.");
      const out: Record<string, boolean> = {};
      for (const [k, v] of Object.entries(value)) {
        if (!(NOTICES as readonly string[]).includes(k)) throw badRequest(`There is no notice called "${k.slice(0, 40)}".`);
        if (typeof v !== "boolean") throw badRequest("Each notice is true or false.");
        out[k] = v;
      }
      return out;
    }
    default:
      throw badRequest(`There is no setting called "${key.slice(0, 40)}".`);
  }
}

export function getPreferences(userId: string): Preferences {
  const out: Preferences = { ...DEFAULTS, notices: { ...DEFAULTS.notices } };
  for (const row of all<{ key: string; value: string }>("SELECT key, value FROM account_prefs WHERE user_id = ?", userId)) {
    let value: unknown;
    try {
      value = JSON.parse(row.value);
      value = check(row.key, value);
    } catch {
      continue; // a stale or unknown value falls back to the default
    }
    if (row.key === "notices") Object.assign(out.notices, value);
    else (out as unknown as Record<string, unknown>)[row.key] = value;
  }
  return out;
}

/** Applies a partial update. `notices` merges, so one switch can be flipped alone. */
export function setPreferences(userId: string, patch: Record<string, unknown>): Preferences {
  const keys = Object.keys(patch);
  if (!keys.length) throw badRequest("Send at least one setting.");
  const clean = keys.map((k) => [k, check(k, patch[k])] as const);
  tx(() => {
    const current = getPreferences(userId);
    for (const [k, v] of clean) {
      const value = k === "notices" ? { ...current.notices, ...(v as object) } : v;
      run(
        "INSERT INTO account_prefs (user_id, key, value, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
        userId,
        k,
        JSON.stringify(value),
        Date.now(),
      );
    }
  });
  return getPreferences(userId);
}
