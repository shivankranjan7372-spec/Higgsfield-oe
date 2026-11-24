import "server-only";

import { getModel, quoteJob, resolveValues, type Filled, type ModelDef } from "@/registry";
import type { Asset } from "@/server/assets";
import type { User } from "@/server/auth";
import { all, get, newId, run, tx } from "@/server/db";
import { ApiError, badRequest, notFound } from "@/server/errors";
import { getJob, submitJobs, type Job } from "@/server/jobs";
import { EMPTY_PROMPT, baseValues, composeShot, modelFor, type Composed, type Mode } from "./compose";
import { ASPECTS } from "./presets";
import { DEFAULT_STILL_MODEL, DEFAULT_VIDEO_MODEL, elementsOf, ownedProject, ownedShot, toShotFields, type ShotRow } from "./store";
import { canAnimate, canTextToVideo, isStillModel } from "./validate";

/**
 * Takes: every generation started for a shot. A take is a pointer to one job; its
 * status, files and error always come from that job, so they can never drift apart.
 */

export const SURFACE = "cinema";
export const MODES: Mode[] = ["still", "animate", "text"];

export interface TakeRow {
  id: string;
  user_id: string;
  project_id: string;
  shot_id: string;
  job_id: string;
  mode: Mode;
  source_take_id: string | null;
  created_at: number;
}

export type TakeStatus = "queued" | "running" | "succeeded" | "failed" | "canceled" | "removed";

export interface Take {
  id: string;
  shotId: string;
  mode: Mode;
  /** "image" for stills, "video" for animate and text. */
  output: "image" | "video";
  sourceTakeId: string | null;
  jobId: string;
  status: TakeStatus;
  modelId: string | null;
  prompt: string;
  cost: number;
  error: { code: string; message: string } | null;
  /** The finished file, or null until the job succeeds. */
  asset: Asset | null;
  createdAt: number;
}

function readJob(userId: string, jobId: string): Job | null {
  try {
    return getJob(userId, jobId);
  } catch {
    return null; // The member removed the job from their history.
  }
}

export function toTake(row: TakeRow, job: Job | null = readJob(row.user_id, row.job_id)): Take {
  return {
    id: row.id,
    shotId: row.shot_id,
    mode: row.mode,
    output: row.mode === "still" ? "image" : "video",
    sourceTakeId: row.source_take_id,
    jobId: row.job_id,
    status: job ? job.status : "removed",
    modelId: job?.modelId ?? null,
    prompt: job?.prompt ?? "",
    cost: job?.cost ?? 0,
    error: job?.error ?? null,
    asset: job?.assets[0] ?? null,
    createdAt: row.created_at,
  };
}

export function takesOfShot(shotId: string): TakeRow[] {
  return all<TakeRow>("SELECT * FROM cinema_takes WHERE shot_id = ? ORDER BY created_at, id", shotId);
}

export function ownedTake(userId: string, id: string): TakeRow {
  const row = get<TakeRow>("SELECT * FROM cinema_takes WHERE id = ? AND user_id = ?", id, userId);
  if (!row) throw notFound("That take does not exist.");
  return row;
}

export type ShotStatus = "empty" | "generating" | "ready" | "failed";

/** A shot's state, derived from its takes' jobs. */
export function shotState(row: ShotRow, takes: Take[]) {
  const live = takes.filter((t) => t.status !== "removed" && t.status !== "canceled");
  const done = live.filter((t) => t.status === "succeeded" && t.asset);
  const generating = live.some((t) => t.status === "queued" || t.status === "running");
  const last = live[live.length - 1];
  const status: ShotStatus = generating ? "generating" : done.length ? "ready" : last?.status === "failed" ? "failed" : "empty";

  // The member's pick wins. Otherwise the newest finished video, then the newest finished still.
  const chosen = done.find((t) => t.id === row.selected_take_id);
  const newest = (out: "image" | "video") => [...done].reverse().find((t) => t.output === out);
  const selected = chosen ?? newest("video") ?? newest("image") ?? null;
  return {
    status,
    hasStill: done.some((t) => t.output === "image"),
    hasVideo: done.some((t) => t.output === "video"),
    selectedTake: selected,
    selectedBy: selected ? (chosen ? "member" : "auto") : null,
  };
}

export function shotWithTakes(row: ShotRow) {
  const takes = takesOfShot(row.id).map((t) => toTake(t));
  return { ...toShotFields(row), ...shotState(row, takes), takes };
}

/* ------------------------------- generating -------------------------------- */

function readMode(v: unknown): Mode {
  if (v === undefined) return "still";
  if (typeof v !== "string" || !MODES.includes(v as Mode)) throw badRequest("Mode must be still, animate or text.");
  return v as Mode;
}

/** The still an animate take starts from: the one asked for, else the selected still, else the newest still. */
function startStill(userId: string, shot: ShotRow, fromTakeId: unknown): { takeId: string; assetId: string } {
  if (fromTakeId !== undefined && fromTakeId !== null) {
    if (typeof fromTakeId !== "string") throw badRequest("fromTakeId must be an id.");
    const row = ownedTake(userId, fromTakeId);
    if (row.shot_id !== shot.id) throw notFound("That take does not belong to this shot.");
    const t = toTake(row);
    if (t.output !== "image" || t.status !== "succeeded" || !t.asset) throw badRequest("Pick a finished still to animate.");
    return { takeId: t.id, assetId: t.asset.id };
  }
  const stills = takesOfShot(shot.id).map((t) => toTake(t)).filter((t) => t.output === "image" && t.status === "succeeded" && t.asset);
  const pick = stills.find((t) => t.id === shot.selected_take_id) ?? stills[stills.length - 1];
  if (!pick) throw new ApiError(409, "no_still", "This shot has no finished still yet. Make a still first, or generate video from text.");
  return { takeId: pick.id, assetId: pick.asset!.id };
}

function checkModel(model: ModelDef | undefined, mode: Mode): ModelDef {
  if (mode === "still" && !isStillModel(model)) throw badRequest("Pick an image model for stills.");
  if (mode === "animate" && !canAnimate(model)) throw badRequest("That model cannot start from a still. Pick a video model with a start frame.");
  if (mode === "text" && !canTextToVideo(model)) throw badRequest("That model cannot make video from text alone.");
  return model!;
}

export interface Plan {
  composed: Composed;
  model: ModelDef;
  sourceTakeId: string | null;
}

/** Everything one take would send, without sending it. */
export function planTake(userId: string, shotId: string, body: Record<string, unknown>): Plan & { shot: ShotRow } {
  const shot = ownedShot(userId, shotId);
  const project = ownedProject(userId, shot.project_id);
  const mode = readMode(body.mode);
  const model = checkModel(modelFor(project, mode, body.modelId), mode);
  const start = mode === "animate" ? startStill(userId, shot, body.fromTakeId) : null;
  const overrides = body.values && typeof body.values === "object" && !Array.isArray(body.values) ? (body.values as Record<string, unknown>) : undefined;
  const composed = composeShot({ userId, project, shot, elements: elementsOf(project.id), mode, model, startAssetId: start?.assetId, values: overrides });
  return { composed, model, sourceTakeId: start?.takeId ?? null, shot };
}

/** The price of a plan, using the same maths `submitJobs` will use. */
export function quotePlan(plan: Plan, count = 1) {
  const filled: Filled = Object.fromEntries(Object.entries(plan.composed.inputs).map(([k, v]) => [k, v.length]));
  const values = resolveValues(plan.model, plan.composed.values, filled);
  const q = quoteJob(plan.model, { prompt: plan.composed.prompt, values, filled, count });
  return { millicredits: q.millicredits, perJob: q.perJob, jobs: q.jobs, values };
}

/**
 * The price of a first take, before any project or shot exists. A new shot has no cast and
 * no still yet, so only the model, the ratio and the length matter. Same maths as `quotePlan`.
 */
export function quoteDraft(q: { mode?: unknown; modelId?: unknown; aspect?: unknown; duration?: unknown }, count = 1) {
  const mode = readMode(q.mode);
  if (mode === "animate") throw badRequest("A new shot has no still to animate. Ask for still or text.");
  const id = typeof q.modelId === "string" && q.modelId ? q.modelId : mode === "still" ? DEFAULT_STILL_MODEL : DEFAULT_VIDEO_MODEL;
  const model = checkModel(getModel(id), mode);
  const aspect = q.aspect === undefined ? "16:9" : q.aspect;
  if (typeof aspect !== "string" || !(ASPECTS as readonly string[]).includes(aspect)) throw badRequest(`Pick an aspect ratio: ${ASPECTS.join(", ")}.`);
  const seconds = q.duration === undefined ? 5 : Number(q.duration);
  if (!Number.isFinite(seconds) || seconds < 1 || seconds > 60) throw badRequest("Duration must be between 1 and 60 seconds.");
  const values = resolveValues(model, baseValues(model, mode, aspect, seconds), {});
  const price = quoteJob(model, { prompt: EMPTY_PROMPT, values, filled: {}, count });
  return { modelId: model.id, mode, values, price: { total: price.millicredits, perTake: price.perJob, takes: price.jobs } };
}

function readCount(v: unknown): number {
  if (v === undefined) return 1;
  const n = Number(v);
  if (typeof v !== "number" || !Number.isInteger(n) || n < 1 || n > 4) throw badRequest("Takes must be a whole number from 1 to 4.");
  return n;
}

/** Starts one or more takes for a shot. Each job becomes one take. */
export function generateTakes(user: User, shotId: string, body: Record<string, unknown>, batchId: string | null = null): Take[] {
  const plan = planTake(user.id, shotId, body);
  const count = readCount(body.count);
  const jobs = submitJobs(user, {
    modelId: plan.composed.modelId,
    prompt: plan.composed.prompt,
    values: plan.composed.values,
    inputs: plan.composed.inputs,
    count,
    surface: SURFACE,
    meta: { projectId: plan.shot.project_id, shotId: plan.shot.id, mode: plan.composed.mode, ...(batchId ? { batchId } : {}) },
  });
  const rows: TakeRow[] = [];
  tx(() => {
    const now = Date.now();
    jobs.forEach((job, i) => {
      const row: TakeRow = {
        id: newId("ctk"),
        user_id: user.id,
        project_id: plan.shot.project_id,
        shot_id: plan.shot.id,
        job_id: job.id,
        mode: plan.composed.mode,
        source_take_id: plan.sourceTakeId,
        created_at: now + i,
      };
      run(
        "INSERT INTO cinema_takes (id, user_id, project_id, shot_id, job_id, mode, source_take_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        row.id, row.user_id, row.project_id, row.shot_id, row.job_id, row.mode, row.source_take_id, row.created_at,
      );
      rows.push(row);
    });
    run("UPDATE cinema_projects SET updated_at = ? WHERE id = ?", Date.now(), plan.shot.project_id);
  });
  return rows.map((r, i) => toTake(r, jobs[i]));
}

/** Forgets a take. The job and its file stay in the member's history and library. */
export function deleteTake(userId: string, id: string) {
  const row = ownedTake(userId, id);
  tx(() => {
    run("UPDATE cinema_shots SET selected_take_id = NULL WHERE id = ? AND selected_take_id = ?", row.shot_id, id);
    run("DELETE FROM cinema_takes WHERE id = ?", id);
  });
}
