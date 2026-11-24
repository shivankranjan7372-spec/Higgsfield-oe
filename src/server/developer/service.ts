import "server-only";

import { createHash } from "node:crypto";
import { formatCredits, planOf } from "@/config/economy";
import { getModel, models, quoteJob, resolveValues, visibleControls, visibleSlots, type Filled, type Kind, type ModelDef } from "@/registry";
import { listAssets, ownedAsset, saveAsset, UPLOAD_LIMIT, type AssetRow } from "../assets";
import type { User } from "../auth";
import { balance } from "../credits";
import { get, parseJson, run } from "../db";
import { ApiError, badRequest, notFound } from "../errors";
import { getJob, listJobs, removeJob, submitJobs, type Job } from "../jobs";

/**
 * What the public API and the MCP tools do. Both call these, so the two stay the same.
 * Shapes here are the public contract: no provider endpoints, request bodies or costs.
 */

export const KINDS = ["image", "video", "audio", "music"] as const;
export const FILE_KINDS = ["image", "video", "audio"] as const;
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/* --------------------------------- models --------------------------------- */

export function modelSummary(m: ModelDef) {
  return {
    id: m.id,
    kind: m.kind,
    name: m.name,
    vendor: m.vendor,
    tagline: m.tagline,
    status: m.status,
    statusNote: m.statusNote ?? null,
    output: m.output,
    surfaces: m.surfaces,
    eta: m.eta,
  };
}

/** Everything needed to fill a draft. `build` stays on the server. */
export function modelDetail(m: ModelDef) {
  return {
    ...modelSummary(m),
    badges: m.badges ?? [],
    prompt: m.prompt,
    slots: m.slots,
    controls: m.controls,
    batch: m.batch,
  };
}

export function listModels(f: { kind?: string | null; available?: boolean }) {
  const kind = f.kind ? KINDS.find((k) => k === f.kind) : undefined;
  if (f.kind && !kind) throw badRequest("Unknown kind. Use image, video, audio or music.");
  return models.filter((m) => (!kind || m.kind === kind) && (!f.available || m.status === "available")).map(modelSummary);
}

export function findModel(id: unknown): ModelDef {
  const m = typeof id === "string" ? getModel(id) : undefined;
  if (!m) throw notFound("That model does not exist.");
  return m;
}

/* ---------------------------------- quote --------------------------------- */

/** Prices a draft with the same registry code the server uses at submit. Nothing is queued. */
export function quoteDraft(user: User, body: Record<string, unknown>) {
  const model = getModel(typeof body.modelId === "string" ? body.modelId : null);
  if (!model) throw badRequest("Pick a model first.");
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (model.prompt && prompt.length > model.prompt.maxLength) throw badRequest(`Keep the prompt under ${model.prompt.maxLength.toLocaleString("en-US")} characters.`);
  const filled: Filled = {};
  if (body.inputs !== undefined) {
    if (!isRecord(body.inputs)) throw badRequest("inputs must be an object of file id lists.");
    for (const slot of model.slots) {
      const ids = body.inputs[slot.id];
      if (ids == null) continue;
      if (!Array.isArray(ids) || ids.length > 20) throw badRequest(`"${slot.label}" must be a list of file ids.`);
      if (ids.length) filled[slot.id] = ids.length;
    }
  }
  const raw = isRecord(body.values) ? body.values : null;
  const values = resolveValues(model, raw, filled);
  const q = quoteJob(model, { prompt, values, filled, count: Math.floor(Number(body.count)) || 1 });
  const have = balance(user.id);
  const missing = visibleSlots(model, values, filled)
    .filter((s) => (filled[s.id] ?? 0) < s.min)
    .map((s) => s.id);
  return {
    modelId: model.id,
    available: model.status === "available",
    credits: q.millicredits,
    perGeneration: q.perJob,
    generations: q.jobs,
    resultsPerGeneration: q.perJobCount,
    exact: q.exact,
    metered: q.metered,
    values,
    controls: visibleControls(model, values, filled).map((c) => c.id),
    missingInputs: missing,
    promptMissing: Boolean(model.prompt?.required && !prompt),
    balance: have,
    affordable: have >= q.millicredits,
  };
}

/* ---------------------------------- files --------------------------------- */

export function fileOut(r: AssetRow) {
  return {
    id: r.id,
    kind: r.kind,
    source: r.source,
    mime: r.mime,
    bytes: r.bytes,
    width: r.width,
    height: r.height,
    duration: r.duration,
    title: r.title,
    generationId: r.job_id,
    url: `/api/v1/files/${r.id}/content`,
    createdAt: r.created_at,
    cursor: r.seq,
  };
}

export function listFiles(userId: string, f: { kind?: string | null; source?: string | null; limit: number; before?: number }) {
  const kind = f.kind ? FILE_KINDS.find((k) => k === f.kind) : undefined;
  if (f.kind && !kind) throw badRequest("Unknown kind. Use image, video or audio.");
  const source = f.source === "generated" || f.source === "upload" ? f.source : undefined;
  if (f.source && !source) throw badRequest("Unknown source. Use generated or upload.");
  return listAssets(userId, { kind, source, limit: f.limit, before: f.before }).map(fileOut);
}

export const getFile = (userId: string, id: string) => fileOut(ownedAsset(userId, id));

export const LARGEST_UPLOAD = Math.max(...Object.values(UPLOAD_LIMIT));

export async function uploadFile(userId: string, file: File) {
  if (file.size > LARGEST_UPLOAD) throw new ApiError(413, "invalid_request", "That file is too large.");
  const row = await saveAsset({ userId, bytes: Buffer.from(await file.arrayBuffer()), source: "upload", title: file.name.slice(0, 200) });
  return fileOut(row);
}

/* ------------------------------- generations ------------------------------ */

export function generationOut(j: Job) {
  return {
    id: j.id,
    status: j.status,
    kind: j.kind,
    output: j.output,
    modelId: j.modelId,
    modelName: j.modelName,
    surface: j.surface,
    prompt: j.prompt,
    values: j.params,
    inputs: j.inputs,
    count: j.count,
    cost: j.cost,
    error: j.error,
    batchId: j.batchId,
    eta: j.eta,
    createdAt: j.createdAt,
    startedAt: j.startedAt,
    finishedAt: j.finishedAt,
    files: j.assets.map((a) => ({
      id: a.id,
      kind: a.kind,
      source: a.source,
      mime: a.mime,
      bytes: a.bytes,
      width: a.width,
      height: a.height,
      duration: a.duration,
      title: a.title,
      generationId: j.id,
      url: `/api/v1/files/${a.id}/content`,
      createdAt: a.createdAt,
      cursor: a.cursor,
    })),
    cursor: j.cursor,
  };
}
export type Generation = ReturnType<typeof generationOut>;

const IDEM_TTL = 86_400_000;

/**
 * Queues a generation for a key. With an idempotency key, a repeat of the same request
 * within 24 hours answers with the first result; a different body under the same key is refused.
 * Everything from the lookup to the insert runs without awaiting, so two requests cannot both pass.
 */
export function createGeneration(
  user: User,
  keyId: string,
  body: Record<string, unknown>,
  opts: { surface: "api" | "mcp"; idempotencyKey?: string | null },
): { generations: Generation[]; replayed: boolean; held: number } {
  const input = { modelId: body.modelId, prompt: body.prompt, values: body.values, inputs: body.inputs, count: body.count };
  const idem = opts.idempotencyKey?.trim();
  if (idem !== undefined && idem !== null && (idem.length === 0 || idem.length > 200)) throw badRequest("Idempotency-Key must be 1 to 200 characters.");
  const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  if (idem) {
    run("DELETE FROM dev_idempotency WHERE created_at < ?", Date.now() - IDEM_TTL);
    const seen = get<{ request_hash: string; job_ids: string }>("SELECT request_hash, job_ids FROM dev_idempotency WHERE key_id = ? AND idem_key = ?", keyId, idem);
    if (seen) {
      if (seen.request_hash !== hash) throw new ApiError(422, "idempotency_mismatch", "That Idempotency-Key was already used with a different request.");
      const ids = parseJson<string[]>(seen.job_ids, []);
      return { generations: ids.map((id) => generationOut(getJob(user.id, id))), replayed: true, held: 0 };
    }
  }
  const jobs = submitJobs(user, { ...input, surface: opts.surface, meta: { apiKeyId: keyId } });
  if (idem) {
    run(
      "INSERT INTO dev_idempotency (key_id, idem_key, user_id, request_hash, job_ids, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      keyId,
      idem,
      user.id,
      hash,
      JSON.stringify(jobs.map((j) => j.id)),
      Date.now(),
    );
  }
  return { generations: jobs.map(generationOut), replayed: false, held: jobs.reduce((n, j) => n + j.cost, 0) };
}

export function listGenerations(userId: string, f: { status?: string | null; kind?: string | null; limit: number; before?: number }) {
  const kind = f.kind ? KINDS.find((k) => k === f.kind) : undefined;
  if (f.kind && !kind) throw badRequest("Unknown kind. Use image, video, audio or music.");
  return listJobs(userId, { status: f.status === "active" ? "active" : "all", kind: kind as Kind | undefined, limit: f.limit, before: f.before }).map(generationOut);
}

export const getGeneration = (userId: string, id: string) => generationOut(getJob(userId, id));

/** Cancels a queued generation. Running or finished ones answer 409 and are left alone. */
export function cancelGeneration(userId: string, id: string) {
  const job = getJob(userId, id);
  if (job.status !== "queued") {
    throw new ApiError(409, "not_cancelable", job.status === "running" ? "This one is already running and cannot be canceled." : "This one has already finished.");
  }
  // removeJob cancels a queued job and returns its credits; a job that started meanwhile answers 409.
  removeJob(userId, id);
  const row = get<{ status: string }>("SELECT status FROM jobs WHERE id = ? AND user_id = ?", id, userId);
  return { generation: { ...generationOut(job), status: row?.status ?? "canceled", files: [] }, balance: balance(userId) };
}

/* --------------------------------- balance -------------------------------- */

export function balanceOut(user: User) {
  const b = balance(user.id);
  const plan = planOf(user.plan);
  return { balance: b, credits: formatCredits(Math.max(0, b)), plan: { id: plan.id, name: plan.name, concurrency: plan.concurrency } };
}
