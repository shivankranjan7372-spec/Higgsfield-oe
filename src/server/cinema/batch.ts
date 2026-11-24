import "server-only";

import { formatCredits, planOf } from "@/config/economy";
import { userById, type User } from "@/server/auth";
import { balance } from "@/server/credits";
import { all, get, newId, run, tx } from "@/server/db";
import { ApiError, notFound } from "@/server/errors";
import { ownedProject, scenesOf, shotsOfProject, type ShotRow } from "./store";
import { generateTakes, planTake, quotePlan, takesOfShot, toTake } from "./takes";
import { stillModel } from "./validate";

/**
 * "Make every missing still". The foundation refuses more jobs than the member's plan runs
 * at once, so the batch keeps its own queue (cinema_batch_items) and feeds items in as
 * slots free up. A small timer drives it while any batch is running; reads of a batch
 * also nudge it, so it carries on after a restart.
 */

interface BatchRow {
  id: string;
  user_id: string;
  project_id: string;
  model_id: string;
  status: "running" | "done" | "canceled";
  quoted: number;
  created_at: number;
  updated_at: number;
}

interface ItemRow {
  id: string;
  batch_id: string;
  user_id: string;
  shot_id: string;
  position: number;
  status: "waiting" | "submitted" | "skipped" | "failed" | "canceled";
  take_id: string | null;
  error: string | null;
  updated_at: number;
}

/** Shots in storyboard order that have no finished still and none on the way. */
function missingStills(projectId: string): ShotRow[] {
  const sceneOrder = new Map(scenesOf(projectId).map((s, i) => [s.id, i]));
  const shots = shotsOfProject(projectId).sort((a, b) => sceneOrder.get(a.scene_id)! - sceneOrder.get(b.scene_id)! || a.position - b.position);
  return shots.filter((s) => {
    const stills = takesOfShot(s.id).filter((t) => t.mode === "still").map((t) => toTake(t));
    return !stills.some((t) => t.status === "succeeded" || t.status === "queued" || t.status === "running");
  });
}

function batchModel(projectModel: string, override: unknown): string {
  return override === undefined || override === null ? projectModel : stillModel(override).id;
}

/** The price of making every missing still, before anything is spent. */
export function quoteBatch(user: User, projectId: string, modelId?: unknown) {
  const project = ownedProject(user.id, projectId);
  const model = batchModel(project.image_model_id, modelId);
  const shots = missingStills(projectId).map((s) => {
    const q = quotePlan(planTake(user.id, s.id, { mode: "still", modelId: model }));
    return { shotId: s.id, millicredits: q.millicredits };
  });
  const total = shots.reduce((n, s) => n + s.millicredits, 0);
  const have = balance(user.id);
  return {
    modelId: model,
    shots,
    count: shots.length,
    total,
    balance: have,
    affordable: have >= total,
    concurrency: planOf(user.plan).concurrency,
  };
}

export function startBatch(user: User, projectId: string, body: Record<string, unknown>) {
  const quote = quoteBatch(user, projectId, body.modelId);
  if (quote.count === 0) throw new ApiError(409, "nothing_to_do", "Every shot already has a still.");
  if (get("SELECT 1 FROM cinema_batches WHERE project_id = ? AND user_id = ? AND status = 'running'", projectId, user.id)) {
    throw new ApiError(409, "batch_running", "Stills are already being made for this project. Wait for them, or stop that run first.");
  }
  // The screen shows the total first and sends it back, so the member never pays more than they saw.
  if (typeof body.expectedTotal === "number" && body.expectedTotal < quote.total) {
    throw new ApiError(409, "price_changed", `The price is now ${formatCredits(quote.total)} credits. Check it and try again.`);
  }
  if (!quote.affordable) {
    throw new ApiError(402, "insufficient_credits", `This needs ${formatCredits(quote.total)} credits and you have ${formatCredits(Math.max(0, quote.balance))}.`);
  }
  const id = newId("cbt");
  const now = Date.now();
  tx(() => {
    run(
      "INSERT INTO cinema_batches (id, user_id, project_id, model_id, status, quoted, created_at, updated_at) VALUES (?, ?, ?, ?, 'running', ?, ?, ?)",
      id, user.id, projectId, quote.modelId, quote.total, now, now,
    );
    quote.shots.forEach((s, i) => {
      run(
        "INSERT INTO cinema_batch_items (id, batch_id, user_id, shot_id, position, status, updated_at) VALUES (?, ?, ?, ?, ?, 'waiting', ?)",
        newId("cbi"), id, user.id, s.shotId, i, now,
      );
    });
  });
  pump();
  return batchView(user.id, id);
}

export function batchView(userId: string, id: string) {
  pump();
  const b = get<BatchRow>("SELECT * FROM cinema_batches WHERE id = ? AND user_id = ?", id, userId);
  if (!b) throw notFound("That batch does not exist.");
  const items = all<ItemRow>("SELECT * FROM cinema_batch_items WHERE batch_id = ? ORDER BY position", id).map((it) => {
    const takeRow = it.take_id ? get<Parameters<typeof toTake>[0]>("SELECT * FROM cinema_takes WHERE id = ?", it.take_id) : undefined;
    const take = takeRow ? toTake(takeRow) : null;
    return { shotId: it.shot_id, status: it.status, error: it.error, takeId: it.take_id, takeStatus: take?.status ?? null };
  });
  const count = (pred: (i: (typeof items)[number]) => boolean) => items.filter(pred).length;
  return {
    id: b.id,
    projectId: b.project_id,
    modelId: b.model_id,
    status: b.status,
    quoted: b.quoted,
    counts: {
      total: items.length,
      waiting: count((i) => i.status === "waiting"),
      submitted: count((i) => i.status === "submitted"),
      finished: count((i) => i.takeStatus === "succeeded"),
      failed: count((i) => i.status === "failed" || i.takeStatus === "failed"),
      canceled: count((i) => i.status === "canceled" || i.status === "skipped"),
    },
    items,
    createdAt: b.created_at,
    updatedAt: b.updated_at,
  };
}

export function latestBatch(userId: string, projectId: string) {
  ownedProject(userId, projectId);
  const b = get<{ id: string }>("SELECT id FROM cinema_batches WHERE project_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1", projectId, userId);
  return b ? batchView(userId, b.id) : null;
}

/** Stops feeding new items. Jobs already started keep running; cancel them in the job list. */
export function cancelBatch(userId: string, id: string) {
  const b = get<BatchRow>("SELECT * FROM cinema_batches WHERE id = ? AND user_id = ?", id, userId);
  if (!b) throw notFound("That batch does not exist.");
  tx(() => {
    run("UPDATE cinema_batch_items SET status = 'canceled', updated_at = ? WHERE batch_id = ? AND status = 'waiting'", Date.now(), id);
    if (b.status === "running") run("UPDATE cinema_batches SET status = 'canceled', updated_at = ? WHERE id = ?", Date.now(), id);
  });
  return batchView(userId, id);
}

/* ---------------------------------- pump ----------------------------------- */

function activeJobs(userId: string): number {
  return get<{ n: number }>("SELECT COUNT(*) AS n FROM jobs WHERE user_id = ? AND status IN ('queued', 'running')", userId)!.n;
}

function setItem(id: string, status: ItemRow["status"], error: string | null, takeId: string | null = null) {
  run("UPDATE cinema_batch_items SET status = ?, error = ?, take_id = COALESCE(?, take_id), updated_at = ? WHERE id = ?", status, error, takeId, Date.now(), id);
}

function pumpBatch(b: BatchRow) {
  const user = userById(b.user_id);
  const waiting = all<ItemRow>("SELECT * FROM cinema_batch_items WHERE batch_id = ? AND status = 'waiting' ORDER BY position", b.id);
  if (!user || !get("SELECT 1 FROM cinema_projects WHERE id = ?", b.project_id)) {
    for (const it of waiting) setItem(it.id, "canceled", null);
  } else {
    let free = planOf(user.plan).concurrency - activeJobs(user.id);
    for (const it of waiting) {
      if (free <= 0) break;
      const shot = get<ShotRow>("SELECT * FROM cinema_shots WHERE id = ? AND user_id = ?", it.shot_id, user.id);
      if (!shot) {
        setItem(it.id, "canceled", "The shot was deleted.");
        continue;
      }
      // The member may have made this still by hand while the item waited.
      const stills = takesOfShot(shot.id).filter((t) => t.mode === "still").map((t) => toTake(t));
      if (stills.some((t) => t.status === "succeeded" || t.status === "queued" || t.status === "running")) {
        setItem(it.id, "skipped", null);
        continue;
      }
      try {
        const [take] = generateTakes(user, shot.id, { mode: "still", modelId: b.model_id }, b.id);
        setItem(it.id, "submitted", null, take.id);
        free -= 1;
      } catch (err) {
        if (err instanceof ApiError && err.code === "too_many_jobs") break; // Try again on the next tick.
        setItem(it.id, "failed", err instanceof ApiError ? err.message : "Something went wrong on our side.");
        if (err instanceof ApiError && err.code === "insufficient_credits") {
          for (const rest of all<ItemRow>("SELECT * FROM cinema_batch_items WHERE batch_id = ? AND status = 'waiting'", b.id)) setItem(rest.id, "failed", err.message);
          break;
        }
      }
    }
  }
  if (!get("SELECT 1 FROM cinema_batch_items WHERE batch_id = ? AND status = 'waiting'", b.id)) {
    run("UPDATE cinema_batches SET status = 'done', updated_at = ? WHERE id = ? AND status = 'running'", Date.now(), b.id);
  }
}

interface PumpState {
  timer: ReturnType<typeof setInterval> | null;
  busy: boolean;
}
const pumpState: PumpState = ((globalThis as unknown as { __parallaxCinemaPump?: PumpState }).__parallaxCinemaPump ??= { timer: null, busy: false });

/** Feeds waiting items into free slots, and keeps a timer going while any batch runs. */
export function pump() {
  if (process.env.NEXT_PHASE === "phase-production-build" || pumpState.busy) return;
  pumpState.busy = true;
  let running = 0;
  try {
    const batches = all<BatchRow>("SELECT * FROM cinema_batches WHERE status = 'running' ORDER BY created_at");
    for (const b of batches) {
      try {
        pumpBatch(b);
      } catch (err) {
        console.error("[cinema] batch pump failed:", err instanceof Error ? err.message : err);
      }
    }
    running = get<{ n: number }>("SELECT COUNT(*) AS n FROM cinema_batches WHERE status = 'running'")!.n;
  } finally {
    pumpState.busy = false;
  }
  if (running > 0 && !pumpState.timer) {
    pumpState.timer = setInterval(pump, 1000);
    pumpState.timer.unref?.();
  } else if (running === 0 && pumpState.timer) {
    clearInterval(pumpState.timer);
    pumpState.timer = null;
  }
}
