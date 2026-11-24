/** Every kind of notice. Preferences are per kind. */
export const NOTICE_KINDS = [
  "generation_done",
  "generation_failed",
  "credits_low",
  "plan",
  "like",
  "comment",
  "follow",
  "announcement",
  "system",
] as const;

export type NoticeKind = (typeof NOTICE_KINDS)[number];

/** Labels and groups for the preferences screen. */
export const KIND_INFO: Record<NoticeKind, { label: string; group: "activity" | "account" | "social" | "news"; canMute: boolean }> = {
  generation_done: { label: "A generation is ready", group: "activity", canMute: true },
  generation_failed: { label: "A generation did not finish", group: "activity", canMute: true },
  credits_low: { label: "Credits are running low", group: "account", canMute: true },
  plan: { label: "Plan and billing changes", group: "account", canMute: false },
  like: { label: "Someone liked your post", group: "social", canMute: true },
  comment: { label: "Someone commented on your post", group: "social", canMute: true },
  follow: { label: "Someone followed you", group: "social", canMute: true },
  announcement: { label: "Product news", group: "news", canMute: true },
  system: { label: "Account and safety messages", group: "account", canMute: false },
};

export const isKind = (k: unknown): k is NoticeKind => typeof k === "string" && (NOTICE_KINDS as readonly string[]).includes(k);
