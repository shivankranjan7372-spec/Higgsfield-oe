import "server-only";

import { MILLI, formatCredits } from "@/config/economy";
import { getModel } from "@/registry";
import { balance } from "@/server/credits";
import { all, get, run, tx } from "@/server/db";
import { notify } from "./notices";

/**
 * The foundation has no hooks yet, so notices about jobs and credits are made lazily:
 * every time a member's notices are read (list, count, stream), we look at what changed.
 * Dedupe keys make each notice appear exactly once, however often this runs.
 */

/** Below these balances (millicredits) a "credits low" notice goes out. Index + 1 is the level. */
export const CREDIT_THRESHOLDS = [20 * MILLI, 5 * MILLI];

/** Do not rescan more often than this per member. */
const MIN_GAP_MS = 1500;

interface DoneJob {
  id: string;
  kind: string;
  surface: string;
  model_id: string;
  status: "succeeded" | "failed";
  prompt: string;
  error_message: string | null;
  batch_id: string | null;
  finished_at: number;
}

const NOUN: Record<string, string> = { image: "image", video: "video", audio: "audio clip", music: "track" };
const STUDIO: Record<string, string> = { image: "/image", video: "/video", audio: "/audio", music: "/audio" };

const snippet = (s: string) => (s.length > 90 ? `${s.slice(0, 87).trimEnd()}...` : s);

function jobNotices(userId: string, after: number): number {
  const jobs = all<DoneJob>(
    `SELECT id, kind, surface, model_id, status, prompt, error_message, batch_id, finished_at FROM jobs
      WHERE user_id = ? AND status IN ('succeeded', 'failed') AND deleted_at IS NULL AND finished_at >= ?
      ORDER BY finished_at LIMIT 200`,
    userId, after,
  );
  let newest = after;
  for (const j of jobs) {
    newest = Math.max(newest, j.finished_at);
    const noun = NOUN[j.kind] ?? "result";
    const modelName = getModel(j.model_id)?.name ?? j.model_id;
    const data = { jobId: j.id, batchId: j.batch_id, kind: j.kind, surface: j.surface, modelId: j.model_id, modelName };
    if (j.status === "succeeded") {
      notify(userId, "generation_done", {
        title: `Your ${noun} is ready`,
        body: j.prompt ? snippet(j.prompt) : `Made with ${modelName}.`,
        link: `/library?job=${j.id}`,
        data,
        dedupeKey: `job:${j.id}:done`,
      });
    } else {
      notify(userId, "generation_failed", {
        title: `Your ${noun} did not finish`,
        body: `${j.error_message ? snippet(j.error_message) + " " : ""}The credits for it were returned.`,
        link: `${STUDIO[j.kind] ?? "/library"}?job=${j.id}`,
        data,
        dedupeKey: `job:${j.id}:failed`,
      });
    }
  }
  return newest;
}

function creditNotice(userId: string, state: { credit_level: number; credit_armed: number }) {
  const bal = balance(userId);
  const level = CREDIT_THRESHOLDS.filter((t) => bal < t).length;
  if (level === state.credit_level) return state;
  // Balance went back up: re-arm, so the next drop announces itself again.
  if (level < state.credit_level) return { credit_level: level, credit_armed: level === 0 ? state.credit_armed + 1 : state.credit_armed };
  notify(userId, "credits_low", {
    title: level >= 2 ? "You are almost out of credits" : "Your credits are running low",
    body: `You have ${formatCredits(Math.max(0, bal))} credits left. Top up to keep generating.`,
    link: "/wallet",
    data: { balance: bal, threshold: CREDIT_THRESHOLDS[level - 1], level },
    dedupeKey: `credits:${state.credit_armed}:${level}`,
  });
  return { credit_level: level, credit_armed: state.credit_armed };
}

/** Brings a member's notices up to date with their jobs and balance. Cheap to call often. */
export function syncNotices(userId: string, force = false) {
  const now = Date.now();
  const state = get<{ jobs_after: number; credit_level: number; credit_armed: number; synced_at: number }>(
    "SELECT jobs_after, credit_level, credit_armed, synced_at FROM notify_state WHERE user_id = ?",
    userId,
  );
  if (state && !force && now - state.synced_at < MIN_GAP_MS) return;
  tx(() => {
    const s = state ?? { jobs_after: 0, credit_level: 0, credit_armed: 0, synced_at: 0 };
    const jobsAfter = jobNotices(userId, s.jobs_after);
    const credit = creditNotice(userId, s);
    run(
      `INSERT INTO notify_state (user_id, jobs_after, credit_level, credit_armed, synced_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (user_id) DO UPDATE SET jobs_after = excluded.jobs_after, credit_level = excluded.credit_level,
         credit_armed = excluded.credit_armed, synced_at = excluded.synced_at`,
      userId, jobsAfter, credit.credit_level, credit.credit_armed, now,
    );
  });
}
