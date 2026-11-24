import "server-only";

import { MAX_BATCH, formatCredits } from "@/config/economy";
import { getModel, quoteJob, resolveValues, type Control, type Filled, type ModelDef, type Values } from "@/registry";
import type { User } from "../auth";
import { all, get, newId, parseJson, run, tx } from "../db";
import { ApiError, badRequest, notFound } from "../errors";
import { getJob, submitJobs, type Job } from "../jobs";
import { apps } from "./catalog";
import { checkCatalog, filledFor } from "./check";
import { FieldError, checkFields, render, type FieldValues } from "./template";
import { CATEGORIES, type AppCategory, type AppDef } from "./types";

/**
 * The apps service: lists the catalog, prices a filled form, and turns one press of Run into
 * jobs through `submitJobs`. The catalog is code; the database only holds runs and pins.
 */

/** Jobs from an app carry this surface. The foundation only accepts [a-z0-9-] here, so not `app:<id>`. */
export const surfaceOf = (appId: string) => `app-${appId}`;

/* ------------------------------ the catalog ------------------------------ */

const byId = new Map(apps.map((a) => [a.id, a]));

/** Checked once per process. An app with a problem is shown as `soon` and cannot run. */
const problems = checkCatalog(apps);
const broken = new Set(problems.map((p) => p.split(":")[0]));
if (problems.length) console.error(`[apps] ${problems.length} catalog problems:\n  ${problems.join("\n  ")}`);

export function catalogReport() {
  return { ok: problems.length === 0, apps: apps.length, available: apps.filter(runnable).length, problems };
}

function runnable(app: AppDef): boolean {
  return app.status === "available" && !broken.has(app.id) && getModel(app.modelId)?.status === "available";
}

function findApp(id: string): AppDef {
  const app = byId.get(id);
  if (!app) throw notFound("That app does not exist.");
  return app;
}

function runnableApp(id: string): { app: AppDef; model: ModelDef } {
  const app = findApp(id);
  const model = getModel(app.modelId);
  if (!runnable(app) || !model) throw new ApiError(409, "app_unavailable", app.note ?? `${app.name} is not available yet.`);
  return { app, model };
}

/* -------------------------------- pricing -------------------------------- */

export interface Price {
  /** Total for this run, in millicredits. */
  millicredits: number;
  /** The same, formatted for display: "5.4". */
  credits: string;
  /** Price of one result, in millicredits. */
  perResult: number;
  count: number;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** The member's control values, limited to the controls the app leaves open. */
function openValues(app: AppDef, raw: unknown): Values {
  const given = isRecord(raw) ? raw : {};
  const out: Values = {};
  for (const id of app.open) {
    const v = given[id];
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") out[id] = v;
  }
  return out;
}

function maxCount(app: AppDef, model: ModelDef): number {
  return Math.max(1, Math.min(model.batch.max, MAX_BATCH));
}

function countOf(app: AppDef, model: ModelDef, raw: unknown): number {
  if (raw == null) return 1;
  const n = Number(raw);
  const most = maxCount(app, model);
  if (!Number.isInteger(n) || n < 1 || n > most) throw badRequest(most === 1 ? "This app makes one result at a time." : `Ask for 1 to ${most} results.`);
  return n;
}

function quote(app: AppDef, model: ModelDef, prompt: string, member: Values, filled: Filled, count: number) {
  const values = resolveValues(model, { ...app.values, ...member }, filled);
  const q = quoteJob(model, { prompt, values, filled, count });
  const price: Price = { millicredits: q.millicredits, credits: formatCredits(q.millicredits), perResult: Math.round(q.perJob / q.perJobCount), count: q.jobs * q.perJobCount };
  return { values, price };
}

function fieldsOrThrow(app: AppDef, raw: unknown): FieldValues {
  try {
    return checkFields(app, raw);
  } catch (err) {
    if (err instanceof FieldError) throw badRequest(err.message);
    throw err;
  }
}

/** Defaults with "sample" in required text fields that have no default, so a price can be shown before typing. */
function sampleFields(app: AppDef): FieldValues {
  const sample = Object.fromEntries(app.fields.filter((f) => f.type === "text" && f.required && !f.default).map((f) => [f.id, "sample"]));
  return checkFields(app, sample);
}

const defaultPrices = new Map<string, Price | null>();

/** The price of a run with the form's defaults and the fewest files. Null for apps that cannot run. */
function defaultPrice(app: AppDef): Price | null {
  if (defaultPrices.has(app.id)) return defaultPrices.get(app.id)!;
  const model = getModel(app.modelId);
  const price = runnable(app) && model ? quote(app, model, render(app, sampleFields(app)), {}, filledFor(app, (i) => i.min), 1).price : null;
  defaultPrices.set(app.id, price);
  return price;
}

/**
 * Prices a form as filled so far. `inputs` may hold file ids or just a count per input,
 * so the price can follow the form before uploads finish. Fields are checked loosely:
 * an empty required field does not stop a price.
 */
export function priceForm(id: string, body: Record<string, unknown>) {
  const { app, model } = runnableApp(id);
  const given = isRecord(body.fields) ? { ...body.fields } : {};
  for (const f of app.fields) if (f.type === "text" && f.required && (given[f.id] == null || given[f.id] === "")) given[f.id] = f.default || "sample";
  const fields = fieldsOrThrow(app, given);
  const rawInputs = isRecord(body.inputs) ? body.inputs : {};
  const counts = Object.fromEntries(
    app.inputs.map((i) => {
      const v = rawInputs[i.id];
      const n = Array.isArray(v) ? v.length : typeof v === "number" && Number.isFinite(v) ? Math.floor(v) : i.min;
      return [i.id, Math.min(i.max, Math.max(0, n))];
    }),
  );
  const filled = filledFor(app, (i) => counts[i.id]);
  const { values, price } = quote(app, model, render(app, fields), openValues(app, body.values), filled, countOf(app, model, body.count));
  return { price, values: pickOpen(app, values) };
}

/** Only the values the member can see on the form. */
function pickOpen(app: AppDef, values: Values): Values {
  return Object.fromEntries(app.open.filter((id) => id in values).map((id) => [id, values[id]]));
}

/* ------------------------------- listing --------------------------------- */

const categoryLabel = (c: AppCategory) => CATEGORIES.find((x) => x.id === c)?.label ?? c;

function runCounts(): Map<string, number> {
  return new Map(all<{ app_id: string; n: number }>("SELECT app_id, COUNT(*) AS n FROM app_runs GROUP BY app_id").map((r) => [r.app_id, r.n]));
}

function pinSet(userId: string | null): Set<string> | null {
  if (!userId) return null;
  return new Set(all<{ app_id: string }>("SELECT app_id FROM app_pins WHERE user_id = ?", userId).map((r) => r.app_id));
}

export interface AppSummary {
  id: string;
  name: string;
  category: AppCategory;
  categoryLabel: string;
  pitch: string;
  tags: string[];
  status: "available" | "soon";
  note: string | null;
  badge: "new" | "trending" | null;
  result: "image" | "video" | "audio";
  modelId: string | null;
  modelName: string | null;
  added: string;
  /** Runs by all members, for "popular". */
  runs: number;
  /** Price of a run with the default form, or null when the app cannot run. */
  price: Price | null;
  /** Null when signed out. */
  pinned: boolean | null;
}

function summary(app: AppDef, counts: Map<string, number>, pins: Set<string> | null): AppSummary {
  const model = getModel(app.modelId);
  const ok = runnable(app);
  return {
    id: app.id,
    name: app.name,
    category: app.category,
    categoryLabel: categoryLabel(app.category),
    pitch: app.pitch,
    tags: app.tags,
    status: ok ? "available" : "soon",
    note: ok ? null : (app.note ?? "Not available yet."),
    badge: app.badge ?? null,
    result: app.result,
    modelId: app.modelId,
    modelName: model?.name ?? null,
    added: app.added,
    runs: counts.get(app.id) ?? 0,
    price: defaultPrice(app),
    pinned: pins ? pins.has(app.id) : null,
  };
}

export interface ListQuery {
  category?: string | null;
  tag?: string | null;
  q?: string | null;
  sort?: string | null;
  status?: string | null;
}

export function listApps(userId: string | null, query: ListQuery) {
  const category = query.category ? CATEGORIES.find((c) => c.id === query.category)?.id : undefined;
  if (query.category && !category) throw badRequest("Unknown category.");
  const sort = query.sort ?? "featured";
  if (!["featured", "popular", "new", "name"].includes(sort)) throw badRequest("Sort by featured, popular, new or name.");
  const status = query.status ?? "all";
  if (!["all", "available", "soon"].includes(status)) throw badRequest("Status is all, available or soon.");
  const tag = query.tag?.trim().toLowerCase() || null;
  const words = (query.q ?? "").toLowerCase().slice(0, 100).split(/\s+/).filter(Boolean);

  const counts = runCounts();
  const pins = pinSet(userId);
  let list = apps.map((a) => summary(a, counts, pins));
  // Facets come from everything that matches the category, before tag and search narrow it.
  const inCategory = list.filter((a) => !category || a.category === category);
  list = inCategory.filter((a) => {
    if (status !== "all" && a.status !== status) return false;
    if (tag && !a.tags.includes(tag)) return false;
    const hay = `${a.name} ${a.pitch} ${a.tags.join(" ")} ${a.categoryLabel}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
  const order = new Map(apps.map((a, i) => [a.id, i]));
  const soonLast = (a: AppSummary, b: AppSummary) => Number(a.status === "soon") - Number(b.status === "soon");
  list.sort((a, b) => {
    if (sort === "popular") return soonLast(a, b) || b.runs - a.runs || order.get(a.id)! - order.get(b.id)!;
    if (sort === "new") return b.added.localeCompare(a.added) || order.get(a.id)! - order.get(b.id)!;
    if (sort === "name") return a.name.localeCompare(b.name);
    return soonLast(a, b) || order.get(a.id)! - order.get(b.id)!;
  });

  const tagCounts = new Map<string, number>();
  for (const a of inCategory) for (const t of a.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  return {
    apps: list,
    categories: CATEGORIES.map((c) => ({ ...c, count: apps.filter((a) => a.category === c.id).length })),
    tags: [...tagCounts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([id, count]) => ({ id, count })),
  };
}

/* ------------------------------- one app --------------------------------- */

/** The form a screen draws. Prompt fragments stay on the server. */
function form(app: AppDef, model: ModelDef | undefined) {
  const slots = new Map((model?.slots ?? []).map((s) => [s.id, s]));
  const controls = new Map((model?.controls ?? []).map((c) => [c.id, c]));
  return {
    fields: app.fields.map((f) => (f.type === "choice" ? { ...f, options: f.options.map(({ value, label }) => ({ value, label })) } : f)),
    inputs: app.inputs.map((i) => ({ id: i.id, label: i.label, hint: i.hint ?? null, accept: slots.get(i.slot)?.accept ?? [app.result], min: i.min, max: i.max })),
    controls: app.open
      .map((id) => controls.get(id))
      .filter((c): c is Control => Boolean(c))
      .map((c) => ({ ...c, default: app.values[c.id] ?? c.default }) as Control),
    maxCount: model ? maxCount(app, model) : 1,
  };
}

export function readApp(userId: string | null, id: string) {
  const app = findApp(id);
  const model = getModel(app.modelId);
  const counts = runCounts();
  return { app: { ...summary(app, counts, pinSet(userId)), eta: model?.eta ?? null, form: form(app, model) } };
}

/* --------------------------------- run ----------------------------------- */

interface RunRow {
  seq: number;
  id: string;
  user_id: string;
  app_id: string;
  fields: string;
  vals: string;
  inputs: string;
  job_ids: string;
  created_at: number;
}

export interface AppRun {
  id: string;
  appId: string;
  fields: FieldValues;
  values: Values;
  inputs: Record<string, string[]>;
  /** Jobs this run queued, with their results. Removed jobs are left out. */
  jobs: Job[];
  createdAt: number;
  /** Pass as `before` for the next page. */
  cursor: number;
}

function toRun(userId: string, r: RunRow): AppRun {
  const jobs: Job[] = [];
  for (const jobId of parseJson<string[]>(r.job_ids, [])) {
    try {
      jobs.push(getJob(userId, jobId));
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 404)) throw err;
    }
  }
  return {
    id: r.id,
    appId: r.app_id,
    fields: parseJson(r.fields, {}),
    values: parseJson(r.vals, {}),
    inputs: parseJson(r.inputs, {}),
    jobs,
    createdAt: r.created_at,
    cursor: r.seq,
  };
}

/** Reads `{ inputId: [assetId] }`, enforces each input's limits and joins them into model slots. */
function mapInputs(app: AppDef, raw: unknown): { byInput: Record<string, string[]>; bySlot: Record<string, string[]> } {
  const given = isRecord(raw) ? raw : {};
  const byInput: Record<string, string[]> = {};
  const bySlot: Record<string, string[]> = {};
  for (const i of app.inputs) {
    const v = given[i.id] ?? [];
    if (!Array.isArray(v) || v.some((x) => typeof x !== "string" || x.length > 64)) throw badRequest(`"${i.label}" must be a list of file ids.`);
    const ids = v as string[];
    if (ids.length < i.min) throw badRequest(i.min === 1 ? `Add ${i.label.toLowerCase()} first.` : `"${i.label}" needs at least ${i.min} files.`);
    if (ids.length > i.max) throw badRequest(`"${i.label}" takes at most ${i.max} ${i.max === 1 ? "file" : "files"}.`);
    if (ids.length) {
      byInput[i.id] = ids;
      (bySlot[i.slot] ??= []).push(...ids);
    }
  }
  return { byInput, bySlot };
}

export function runApp(user: User, id: string, body: Record<string, unknown>) {
  const { app, model } = runnableApp(id);
  const fields = fieldsOrThrow(app, body.fields);
  const prompt = render(app, fields);
  const member = openValues(app, body.values);
  const { byInput, bySlot } = mapInputs(app, body.inputs);
  const count = countOf(app, model, body.count);
  const runId = newId("arun");

  // One transaction: the jobs and the run row land together or not at all.
  return tx(() => {
  const jobs = submitJobs(user, {
    modelId: model.id,
    prompt,
    values: { ...app.values, ...member },
    inputs: bySlot,
    count,
    surface: surfaceOf(app.id),
    meta: { appId: app.id, appRunId: runId },
  });

  const now = Date.now();
  run(
    "INSERT INTO app_runs (id, user_id, app_id, fields, vals, inputs, job_ids, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    runId,
    user.id,
    app.id,
    JSON.stringify(fields),
    JSON.stringify(pickOpen(app, jobs[0]?.params ?? member)),
    JSON.stringify(byInput),
    JSON.stringify(jobs.map((j) => j.id)),
    now,
  );
  return toRun(user.id, get<RunRow>("SELECT * FROM app_runs WHERE id = ?", runId)!);
  });
}

export function listRuns(userId: string, appId: string, limit: number, before?: number): AppRun[] {
  findApp(appId);
  const rows = all<RunRow>(
    "SELECT * FROM app_runs WHERE user_id = ? AND app_id = ? AND seq < ? ORDER BY seq DESC LIMIT ?",
    userId,
    appId,
    before ?? Number.MAX_SAFE_INTEGER,
    limit,
  );
  return rows.map((r) => toRun(userId, r));
}

/* ----------------------------- pins and recent ---------------------------- */

export function setPin(userId: string, appId: string, pinned: boolean) {
  findApp(appId);
  if (pinned) run("INSERT OR IGNORE INTO app_pins (user_id, app_id, created_at) VALUES (?, ?, ?)", userId, appId, Date.now());
  else run("DELETE FROM app_pins WHERE user_id = ? AND app_id = ?", userId, appId);
  return { appId, pinned };
}

/** Pinned apps, most recently pinned first. Apps since removed from the catalog are skipped. */
export function pinnedApps(userId: string) {
  const counts = runCounts();
  const pins = pinSet(userId);
  const rows = all<{ app_id: string }>("SELECT app_id FROM app_pins WHERE user_id = ? ORDER BY created_at DESC, rowid DESC", userId);
  return rows.map((r) => byId.get(r.app_id)).filter((a): a is AppDef => Boolean(a)).map((a) => summary(a, counts, pins));
}

/** Apps the member ran, most recent first, with when they last ran each. */
export function recentApps(userId: string, limit: number) {
  const counts = runCounts();
  const pins = pinSet(userId);
  const rows = all<{ app_id: string; last: number }>(
    "SELECT app_id, MAX(created_at) AS last, MAX(seq) AS s FROM app_runs WHERE user_id = ? GROUP BY app_id ORDER BY s DESC LIMIT ?",
    userId,
    limit,
  );
  return rows.filter((r) => byId.has(r.app_id)).map((r) => ({ ...summary(byId.get(r.app_id)!, counts, pins), lastRunAt: r.last }));
}
