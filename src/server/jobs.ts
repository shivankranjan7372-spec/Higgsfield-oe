import "server-only";

import { MAX_BATCH, formatCredits, planOf } from "@/config/economy";
import { assetRef, catalogEndpoint, getModel, quoteJob, resolveValues, visibleSlots, type Filled, type Kind, type MediaRef, type MediaType, type ModelDef, type Values } from "@/registry";
import { assetsOfJobs, ownedAsset, removeAsset, toAsset, type Asset, type AssetRow } from "./assets";
import type { User } from "./auth";
import { balance, hold, release } from "./credits";
import { all, get, newId, parseJson, run, tx, type Param } from "./db";
import { ApiError, badRequest, notFound } from "./errors";
import { tregMode } from "./treg";
import { kick, outputOf } from "./worker";

/**
 * Jobs: one row per provider call. Every studio and tool submits through `submitJobs`,
 * so validation, pricing, credits and limits live in exactly one place.
 *
 *   queued -> running -> succeeded | failed
 *   queued -> canceled
 *
 * Credits are held when a job is queued. The hold becomes a charge when the job
 * succeeds, and is given back when it fails or is canceled.
 */

export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "canceled";

export interface JobRow {
  seq: number;
  id: string;
  user_id: string;
  kind: Kind;
  surface: string;
  model_id: string;
  status: JobStatus;
  prompt: string;
  params: string;
  inputs: string;
  endpoint: string;
  request: string;
  expect_count: number;
  cost: number;
  est_usd: number;
  treg_call_id: string | null;
  provider_cost_micro: number | null;
  error_code: string | null;
  error_message: string | null;
  batch_id: string | null;
  meta: string;
  attempts: number;
  next_poll_at: number;
  created_at: number;
  started_at: number | null;
  finished_at: number | null;
  deleted_at: number | null;
}

/** What the API returns. Provider details (endpoint, request, call ids, cost) stay on the server. */
export interface Job {
  id: string;
  kind: Kind;
  surface: string;
  modelId: string;
  modelName: string;
  status: JobStatus;
  prompt: string;
  params: Values;
  /** `{ slotId: [assetId] }`, so a result can be recreated or edited. */
  inputs: Record<string, string[]>;
  /** Results this job should return. */
  count: number;
  /** Millicredits. */
  cost: number;
  error: { code: string; message: string } | null;
  /** Jobs queued by one press of Generate share this. */
  batchId: string | null;
  meta: Record<string, unknown>;
  output: MediaType;
  /** Typical seconds from start to result, for the progress bar. */
  eta: number;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  assets: Asset[];
  /** Pass as `before` to read the next page. */
  cursor: number;
}

export function toJob(row: JobRow, assets: AssetRow[] = []): Job {
  const model = getModel(row.model_id);
  return {
    id: row.id,
    kind: row.kind,
    surface: row.surface,
    modelId: row.model_id,
    modelName: model?.name ?? row.model_id,
    status: row.status,
    prompt: row.prompt,
    params: parseJson<Values>(row.params, {}),
    inputs: parseJson<Record<string, string[]>>(row.inputs, {}),
    count: row.expect_count,
    cost: row.cost,
    error: row.status === "failed" ? { code: row.error_code ?? "failed", message: row.error_message ?? "This one did not work." } : null,
    batchId: row.batch_id,
    meta: parseJson<Record<string, unknown>>(row.meta, {}),
    output: outputOf(row),
    eta: model?.eta ?? 30,
    createdAt: row.created_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    assets: assets.map(toAsset),
    cursor: row.seq,
  };
}

function withAssets(rows: JobRow[]): Job[] {
  const assets = assetsOfJobs(rows.filter((r) => r.status === "succeeded").map((r) => r.id));
  return rows.map((r) => toJob(r, assets.get(r.id) ?? []));
}

/* --------------------------------- submit --------------------------------- */

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

const article = (kind: MediaType) => (kind === "image" ? "an image" : kind === "video" ? "a video" : "an audio file");

/** Reads `{ slotId: [assetId] }` and loads each file, refusing anything the member does not own. */
function loadInputs(model: ModelDef, userId: string, raw: unknown): Record<string, AssetRow[]> {
  const given = isRecord(raw) ? raw : {};
  const out: Record<string, AssetRow[]> = {};
  for (const slot of model.slots) {
    const ids = given[slot.id];
    if (ids == null) continue;
    if (!Array.isArray(ids) || ids.length > 20 || ids.some((id) => typeof id !== "string")) throw badRequest(`"${slot.label}" must be a list of file ids.`);
    if (ids.length > 0) out[slot.id] = (ids as string[]).map((id) => ownedAsset(userId, id));
  }
  return out;
}

const countOf = (rows: Record<string, AssetRow[]>): Filled => Object.fromEntries(Object.entries(rows).map(([slot, list]) => [slot, list.length]));

function activeCount(userId: string): number {
  return get<{ n: number }>("SELECT COUNT(*) AS n FROM jobs WHERE user_id = ? AND status IN ('queued', 'running')", userId)!.n;
}

/** Provider spend we have committed to in the last 24 hours, in dollars. Mock jobs cost nothing. */
function spentToday(): number {
  return get<{ usd: number }>(
    // A job that failed after the provider ran still cost what the provider charged.
    `SELECT COALESCE(SUM(CASE WHEN status IN ('failed', 'canceled') THEN COALESCE(provider_cost_micro, 0) / 1e6
                              ELSE MAX(est_usd, COALESCE(provider_cost_micro, 0) / 1e6) END), 0) AS usd
       FROM jobs
      WHERE created_at > ? AND (treg_call_id IS NULL OR treg_call_id != 'mock')`,
    Date.now() - 86_400_000,
  )!.usd;
}

/** Default for TREG_DAILY_BUDGET_USD: low, so a forgotten setting cannot run up a large bill. */
export const DEFAULT_DAILY_BUDGET_USD = 5;

/**
 * The most provider spend allowed in 24 hours, in dollars. A missing or unreadable value
 * falls back to the default rather than to "no limit"; 0 stops paid requests.
 */
export function dailyBudgetUsd(): number {
  const raw = process.env.TREG_DAILY_BUDGET_USD?.trim();
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_DAILY_BUDGET_USD;
}

export interface SubmitInput {
  modelId?: unknown;
  prompt?: unknown;
  /** Control values by control id. Anything missing or illegal falls back to the model's default. */
  values?: unknown;
  /** `{ slotId: [assetId] }`. */
  inputs?: unknown;
  count?: unknown;
  /** Which studio or tool is asking. Defaults to the model's first surface. */
  surface?: unknown;
  /** Free-form data the surface wants back with the job (a preset id, a project id...). */
  meta?: unknown;
}

/**
 * Validates, prices and queues one press of Generate. Returns the queued jobs:
 * one per result, or a single job when the model returns several results per call.
 */
export function submitJobs(user: User, input: SubmitInput): Job[] {
  const model = getModel(typeof input.modelId === "string" ? input.modelId : null);
  if (!model) throw badRequest("Pick a model first.");
  if (model.status !== "available") throw new ApiError(409, "model_unavailable", model.statusNote ?? `${model.name} is not available right now.`);

  let prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
  if (!model.prompt) prompt = "";
  else {
    if (model.prompt.required && !prompt) throw badRequest("Write a prompt first.");
    if (prompt.length > model.prompt.maxLength) throw badRequest(`Keep the prompt under ${model.prompt.maxLength.toLocaleString("en-US")} characters.`);
  }

  // Slots can depend on values and values on slots, so settle them in two passes:
  // drop files in slots that do not apply, then resolve the values once more.
  const files = loadInputs(model, user.id, input.inputs);
  const rawValues = isRecord(input.values) ? input.values : null;
  let filled = countOf(files);
  let values = resolveValues(model, rawValues, filled);
  const showing = new Set(visibleSlots(model, values, filled).map((s) => s.id));
  for (const slot of Object.keys(files)) if (!showing.has(slot)) delete files[slot];
  filled = countOf(files);
  values = resolveValues(model, rawValues, filled);

  for (const slot of visibleSlots(model, values, filled)) {
    const list = files[slot.id] ?? [];
    if (list.length < slot.min) throw badRequest(slot.min === 1 ? `Add ${slot.label.toLowerCase()} first.` : `"${slot.label}" needs at least ${slot.min} files.`);
    if (list.length > slot.max) throw badRequest(`"${slot.label}" takes at most ${slot.max} ${slot.max === 1 ? "file" : "files"}.`);
    const wrong = list.find((a) => !slot.accept.includes(a.kind));
    if (wrong) throw badRequest(`"${slot.label}" takes ${slot.accept.map(article).join(" or ")}, not ${article(wrong.kind)}.`);
  }

  const media: Record<string, MediaRef[]> = {};
  for (const [slot, list] of Object.entries(files)) media[slot] = list.map((a) => assetRef(a.id, a.mime));

  const asked = Math.floor(Number(input.count)) || 1;
  const quote = quoteJob(model, { prompt, values, media, filled, count: model.batch.native ? asked : Math.min(asked, MAX_BATCH) });
  if (!catalogEndpoint(quote.request.endpoint)) throw new ApiError(409, "model_unavailable", `${model.name} is not available right now.`);

  const surface = typeof input.surface === "string" && /^[a-z0-9-]{1,40}$/.test(input.surface) ? input.surface : (model.surfaces[0] ?? model.kind);
  const metaText = isRecord(input.meta) ? JSON.stringify(input.meta) : "{}";
  const inputIds = JSON.stringify(Object.fromEntries(Object.entries(files).map(([slot, list]) => [slot, list.map((a) => a.id)])));
  const request = JSON.stringify({ body: quote.request.body, query: quote.request.query ?? {}, headers: quote.request.headers ?? {} });
  const batchId = quote.jobs > 1 ? newId("bat") : null;
  const now = Date.now();
  const ids: string[] = [];

  tx(() => {
    // Checked inside the write transaction, so two requests cannot both spend the same credits.
    const have = balance(user.id);
    if (have < quote.millicredits) {
      throw new ApiError(402, "insufficient_credits", `This needs ${formatCredits(quote.millicredits)} credits and you have ${formatCredits(Math.max(0, have))}.`);
    }

    const plan = planOf(user.plan);
    if (activeCount(user.id) + quote.jobs > plan.concurrency) {
      throw new ApiError(429, "too_many_jobs", `You can run ${plan.concurrency} at once on the ${plan.name} plan. Wait for one to finish.`);
    }

    if (tregMode() === "live" && spentToday() + quote.usdPerJob * quote.jobs > dailyBudgetUsd()) {
      throw new ApiError(503, "model_unavailable", "Generation is paused for today. Try again tomorrow.");
    }

    for (let i = 0; i < quote.jobs; i++) {
      const id = newId("job");
      ids.push(id);
      run(
        `INSERT INTO jobs (id, user_id, kind, surface, model_id, status, prompt, params, inputs, endpoint, request,
                           expect_count, cost, est_usd, batch_id, meta, created_at)
         VALUES (?, ?, ?, ?, ?, 'queued', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        user.id,
        model.kind,
        surface,
        model.id,
        prompt,
        JSON.stringify(values),
        inputIds,
        quote.request.endpoint,
        request,
        quote.perJobCount,
        quote.perJob,
        quote.usdPerJob,
        batchId,
        metaText.length <= 4000 ? metaText : "{}",
        now + i, // keeps a batch in a stable order
      );
      hold(user.id, id, quote.perJob, model.name);
    }
  });

  kick();
  return ids.map((id) => toJob(get<JobRow>("SELECT * FROM jobs WHERE id = ?", id)!));
}

/* --------------------------------- reading -------------------------------- */

export interface JobFilter {
  /** `active` is queued and running only. */
  status?: "active" | "all";
  kind?: Kind;
  surface?: string;
  limit: number;
  /** A `cursor` from the previous page. */
  before?: number;
}

/** A member's jobs, newest first. Canceled jobs are not listed. */
export function listJobs(userId: string, f: JobFilter): Job[] {
  const where = ["user_id = ?", "deleted_at IS NULL", "status != 'canceled'"];
  const params: Param[] = [userId];
  if (f.status === "active") where.push("status IN ('queued', 'running')");
  if (f.kind) {
    where.push("kind = ?");
    params.push(f.kind);
  }
  if (f.surface) {
    where.push("surface = ?");
    params.push(f.surface);
  }
  if (f.before) {
    where.push("seq < ?");
    params.push(f.before);
  }
  return withAssets(all<JobRow>(`SELECT * FROM jobs WHERE ${where.join(" AND ")} ORDER BY seq DESC LIMIT ?`, ...params, f.limit));
}

function ownedJob(userId: string, id: string): JobRow {
  const row = get<JobRow>("SELECT * FROM jobs WHERE id = ? AND user_id = ? AND deleted_at IS NULL", id, userId);
  if (!row) throw notFound("That generation does not exist.");
  return row;
}

export function getJob(userId: string, id: string): Job {
  return withAssets([ownedJob(userId, id)])[0];
}

/**
 * Removes a job from the member's history. A queued job is canceled and its credits
 * returned. A finished job goes away together with its results.
 */
export function removeJob(userId: string, id: string) {
  const row = ownedJob(userId, id);
  const now = Date.now();
  if (row.status === "queued") {
    const canceled = run("UPDATE jobs SET status = 'canceled', finished_at = ?, deleted_at = ? WHERE id = ? AND status = 'queued'", now, now, id).changes === 1;
    if (canceled) {
      release(id, "Canceled");
      return;
    }
  }
  const current = get<JobRow>("SELECT * FROM jobs WHERE id = ?", id)!;
  if (current.status === "queued" || current.status === "running") {
    throw new ApiError(409, "invalid_request", "This one is already running. You can remove it when it finishes.");
  }
  for (const asset of assetsOfJobs([id]).get(id) ?? []) removeAsset(userId, asset.id);
  run("UPDATE jobs SET deleted_at = ? WHERE id = ?", now, id);
}
