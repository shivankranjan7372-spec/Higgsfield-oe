import "server-only";

import { formatCredits, planOf } from "@/config/economy";
import { getModel, quoteJob, resolveValues, type Filled } from "@/registry";
import { assetsOfJobs } from "@/server/assets";
import { userById, type User } from "@/server/auth";
import { balance } from "@/server/credits";
import { all, get, newId, parseJson, run, tx } from "@/server/db";
import { ApiError, badRequest, notFound } from "@/server/errors";
import { getJob, removeJob, submitJobs, type Job } from "@/server/jobs";
import { copyWriter, type AdCopy } from "./copy";
import { has, longText, ownImage, text } from "./fields";
import { FORMATS, formatUsable, getFormat, type AdFormat } from "./formats";
import { kitData, ownedKit, ownedProduct, productData, productImages } from "./library";
import type { BrandData, ProductData } from "./types";

/**
 * Campaigns: a product, an optional brand kit, chosen formats and a number of variations.
 *
 * Running a campaign plans one ad item per format and variation, all `waiting`. The feeder
 * (`pump`) submits waiting items one job at a time while the member has free job slots,
 * so a large campaign never trips the plan's limit on jobs at once. Items move
 * waiting -> running -> succeeded | failed | canceled, following their jobs.
 */

export const SURFACE = "ads";
export const MAX_VARIATIONS = 4;
const MAX_CAMPAIGNS = 300;

type ItemStatus = "waiting" | "running" | "succeeded" | "failed" | "canceled";

interface CampaignRow {
  id: string;
  user_id: string;
  name: string;
  product_id: string | null;
  brand_kit_id: string | null;
  formats: string;
  variations: number;
  script: string;
  presenter_asset_id: string | null;
  copied_from: string | null;
  created_at: number;
  updated_at: number;
}

interface ItemRow {
  seq: number;
  id: string;
  user_id: string;
  campaign_id: string;
  format_id: string;
  round: number;
  variation: number;
  status: ItemStatus;
  prompt: string;
  script: string;
  copy: string;
  inputs: string;
  cost: number;
  speech_job_id: string | null;
  job_id: string | null;
  winner: number;
  error_code: string | null;
  error_message: string | null;
  created_at: number;
  finished_at: number | null;
}

/* --------------------------------- editing --------------------------------- */

export function ownedCampaign(userId: string, id: string): CampaignRow {
  const row = get<CampaignRow>("SELECT * FROM ad_campaigns WHERE id = ? AND user_id = ?", id, userId);
  if (!row) throw notFound("That campaign does not exist.");
  return row;
}

function readFormats(raw: unknown): string[] {
  if (!Array.isArray(raw) || raw.length === 0) throw badRequest("Pick at least one ad format.");
  if (raw.length > FORMATS.length) throw badRequest("That is more formats than there are.");
  const ids = [...new Set(raw)];
  for (const id of ids) if (!getFormat(id)) throw badRequest(`There is no ad format called "${String(id).slice(0, 40)}".`);
  return ids as string[];
}

function readVariations(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > MAX_VARIATIONS) throw badRequest(`Ask for between 1 and ${MAX_VARIATIONS} variations.`);
  return n;
}

/** Creates a draft, or (with `id`) changes only the fields present in the body. */
export function saveCampaign(userId: string, body: Record<string, unknown>, id?: string) {
  const old = id ? ownedCampaign(userId, id) : null;
  if (!old && get<{ n: number }>("SELECT COUNT(*) AS n FROM ad_campaigns WHERE user_id = ?", userId)!.n >= MAX_CAMPAIGNS) {
    throw badRequest(`You can keep up to ${MAX_CAMPAIGNS} campaigns. Delete one first.`);
  }
  const pick = <T,>(key: string, read: () => T, fallback: T): T => (!old || has(body, key) ? read() : fallback);
  const productId = pick("productId", () => {
    if (body.productId == null && old) return null;
    if (typeof body.productId !== "string") throw badRequest("Pick a product for this campaign.");
    return ownedProduct(userId, body.productId.slice(0, 80)).id;
  }, old?.product_id ?? null);
  const kitId = pick("brandKitId", () => (body.brandKitId == null ? null : ownedKit(userId, String(body.brandKitId).slice(0, 80)).id), old?.brand_kit_id ?? null);
  const formats = pick("formats", () => JSON.stringify(readFormats(body.formats)), old?.formats ?? "[]");
  const variations = pick("variations", () => (body.variations == null && !old ? 1 : readVariations(body.variations)), old?.variations ?? 1);
  const script = pick("script", () => longText(body, "script", "the script", 1200), old?.script ?? "");
  const presenter = pick("presenterAssetId", () => (body.presenterAssetId == null ? null : ownImage(userId, body.presenterAssetId, "the presenter photo")), old?.presenter_asset_id ?? null);
  let name = pick("name", () => text(body, "name", "a campaign name", 80), old?.name ?? "");
  if (!name) name = `Campaign ${new Date().toISOString().slice(0, 10)}`;
  const now = Date.now();
  if (old) {
    run("UPDATE ad_campaigns SET name = ?, product_id = ?, brand_kit_id = ?, formats = ?, variations = ?, script = ?, presenter_asset_id = ?, updated_at = ? WHERE id = ? AND user_id = ?",
      name, productId, kitId, formats, variations, script, presenter, now, old.id, userId);
    return campaignView(userId, old.id);
  }
  const cid = newId("acm");
  run(`INSERT INTO ad_campaigns (id, user_id, name, product_id, brand_kit_id, formats, variations, script, presenter_asset_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, cid, userId, name, productId, kitId, formats, variations, script, presenter, now, now);
  return campaignView(userId, cid);
}

/** A new draft with the same settings and no results. */
export function duplicateCampaign(userId: string, id: string) {
  const c = ownedCampaign(userId, id);
  const cid = newId("acm");
  const now = Date.now();
  const name = `${c.name.slice(0, 73)} (copy)`;
  run(`INSERT INTO ad_campaigns (id, user_id, name, product_id, brand_kit_id, formats, variations, script, presenter_asset_id, copied_from, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, cid, userId, name, c.product_id, c.brand_kit_id, c.formats, c.variations, c.script, c.presenter_asset_id, c.id, now, now);
  return campaignView(userId, cid);
}

/** Deletes a campaign. Ads not started yet are dropped; queued jobs are canceled and refunded. Finished results stay in the library. */
export function deleteCampaign(userId: string, id: string) {
  ownedCampaign(userId, id);
  const items = all<ItemRow>("SELECT * FROM ad_items WHERE campaign_id = ? AND user_id = ? AND status = 'running'", id, userId);
  for (const it of items) {
    for (const jobId of [it.speech_job_id, it.job_id]) {
      if (!jobId) continue;
      const st = get<{ status: string }>("SELECT status FROM jobs WHERE id = ? AND user_id = ?", jobId, userId);
      if (st?.status === "queued") {
        try {
          removeJob(userId, jobId);
        } catch {
          /* it started meanwhile; let it finish */
        }
      }
    }
  }
  run("DELETE FROM ad_campaigns WHERE id = ? AND user_id = ?", id, userId);
}

export function setWinner(userId: string, itemId: string, winner: boolean) {
  const row = get<ItemRow>("SELECT * FROM ad_items WHERE id = ? AND user_id = ?", itemId, userId);
  if (!row) throw notFound("That ad does not exist.");
  if (winner && row.status !== "succeeded") throw new ApiError(409, "invalid_request", "Only a finished ad can be a winner.");
  run("UPDATE ad_items SET winner = ? WHERE id = ? AND user_id = ?", winner ? 1 : 0, itemId, userId);
  return itemView(userId, { ...row, winner: winner ? 1 : 0 });
}

/* --------------------------------- planning -------------------------------- */

interface PlannedItem {
  format: AdFormat;
  variation: number;
  round: number;
  prompt: string;
  script: string;
  copy: AdCopy;
  inputs: Record<string, string[]>;
  cost: number;
}

interface Plan {
  items: PlannedItem[];
  total: number;
}

function context(userId: string, c: CampaignRow): { product: ProductData; images: string[]; brand: BrandData | null } {
  if (!c.product_id) throw new ApiError(409, "invalid_request", "Pick a product for this campaign first.");
  const p = ownedProduct(userId, c.product_id);
  const brand = c.brand_kit_id ? kitData(ownedKit(userId, c.brand_kit_id)) : null;
  return { product: productData(p), images: productImages(p), brand };
}

function stepPrice(modelId: string, prompt: string, values: Record<string, unknown>, filled: Filled): number {
  const model = getModel(modelId)!;
  const resolved = resolveValues(model, values, filled);
  return quoteJob(model, { prompt, values: resolved, filled, count: 1 }).millicredits;
}

/** Prompts, copy, inputs and exact price for every ad a run would make. Pure: writes nothing. */
function plan(userId: string, c: CampaignRow, formatIds: string[], nextRound: (formatId: string) => number): Plan {
  const { product, images, brand } = context(userId, c);
  if (c.presenter_asset_id) ownImage(userId, c.presenter_asset_id, "the presenter photo");
  const writer = copyWriter();
  const items: PlannedItem[] = [];
  for (const fid of formatIds) {
    const format = getFormat(fid);
    if (!format) continue;
    if (!formatUsable(format)) throw new ApiError(409, "model_unavailable", `${format.name} is not available right now.`);
    const round = nextRound(fid);
    for (let v = 1; v <= c.variations; v++) {
      // Later rounds move on to fresh angles instead of repeating round one.
      const seed = (round - 1) * c.variations + v;
      const req = { product, brand, seed };
      const script = format.spoken ? c.script || writer.script(req, format.platform.seconds ?? 20) : "";
      const benefits = product.benefits.length ? product.benefits : [product.description || "everyday quality"];
      const prompt = format.recipe({ product, brand, benefit: benefits[(seed - 1) % benefits.length], scene: format.scenes[(seed - 1) % format.scenes.length], script });
      const maxPrompt = getModel(format.modelId)?.prompt?.maxLength ?? 2000;
      if (prompt.length > maxPrompt) throw badRequest(`The script is too long for ${format.name}. Keep it under ${maxPrompt} characters.`);
      const inputs: Record<string, string[]> = {};
      const filled: Filled = {};
      for (const s of format.slots) {
        const files = s.from === "product-images" ? images.slice(0, s.max) : s.from === "presenter" && c.presenter_asset_id ? [c.presenter_asset_id] : [];
        if (s.from === "speech") {
          filled[s.slot] = 1; // filled later by the speech job's result
          continue;
        }
        if (s.required && files.length === 0) {
          throw badRequest(s.from === "presenter" ? `Add a presenter photo for the ${format.name} format.` : `Add a product image for the ${format.name} format.`);
        }
        if (files.length) {
          inputs[s.slot] = files;
          filled[s.slot] = files.length;
        }
      }
      let cost = stepPrice(format.modelId, prompt, format.values, filled);
      if (format.speech) cost += stepPrice(format.speech.modelId, script, format.speech.values, {});
      items.push({ format, variation: v, round, prompt, script, copy: writer.write(req), inputs, cost });
    }
  }
  return { items, total: items.reduce((s, i) => s + i.cost, 0) };
}

function roundCounter(campaignId: string) {
  const rounds = new Map(all<{ format_id: string; r: number }>("SELECT format_id, MAX(round) AS r FROM ad_items WHERE campaign_id = ? GROUP BY format_id", campaignId).map((x) => [x.format_id, x.r]));
  return (fid: string) => (rounds.get(fid) ?? 0) + 1;
}

function hasItems(campaignId: string): boolean {
  return !!get("SELECT 1 FROM ad_items WHERE campaign_id = ?", campaignId);
}

function formatsOf(c: CampaignRow): string[] {
  return parseJson<string[]>(c.formats, []).filter((f) => getFormat(f));
}

function quoteView(userId: string, p: Plan) {
  const perFormat = new Map<string, { formatId: string; formatName: string; ads: number; subtotal: number }>();
  for (const it of p.items) {
    const e = perFormat.get(it.format.id) ?? { formatId: it.format.id, formatName: it.format.name, ads: 0, subtotal: 0 };
    e.ads++;
    e.subtotal += it.cost;
    perFormat.set(it.format.id, e);
  }
  const have = balance(userId);
  return { total: p.total, ads: p.items.length, formats: [...perFormat.values()], balance: have, enough: have >= p.total };
}

/** Price of running the whole campaign (or, with `formatId`, of re-running that one format). */
export function quoteCampaign(userId: string, id: string, formatId?: string) {
  const c = ownedCampaign(userId, id);
  const ids = formatId ? [checkFormatOf(c, formatId)] : formatsOf(c);
  return quoteView(userId, plan(userId, c, ids, roundCounter(c.id)));
}

function checkFormatOf(c: CampaignRow, formatId: string): string {
  if (!getFormat(formatId)) throw notFound("That ad format does not exist.");
  if (!formatsOf(c).includes(formatId) && !get("SELECT 1 FROM ad_items WHERE campaign_id = ? AND format_id = ?", c.id, formatId)) {
    throw badRequest("That format is not part of this campaign.");
  }
  return formatId;
}

function launch(user: User, c: CampaignRow, ids: string[], expected: unknown) {
  const p = plan(user.id, c, ids, roundCounter(c.id));
  if (expected != null && Number(expected) !== p.total) {
    throw new ApiError(409, "price_changed", `The price is now ${formatCredits(p.total)} credits. Check it and try again.`);
  }
  const have = balance(user.id);
  if (have < p.total) {
    throw new ApiError(402, "insufficient_credits", `This needs ${formatCredits(p.total)} credits and you have ${formatCredits(Math.max(0, have))}.`);
  }
  const now = Date.now();
  tx(() => {
    for (const it of p.items) {
      run(`INSERT INTO ad_items (id, user_id, campaign_id, format_id, round, variation, status, prompt, script, copy, inputs, cost, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 'waiting', ?, ?, ?, ?, ?, ?)`,
        newId("adi"), user.id, c.id, it.format.id, it.round, it.variation, it.prompt, it.script, JSON.stringify(it.copy), JSON.stringify(it.inputs), it.cost, now);
    }
    run("UPDATE ad_campaigns SET updated_at = ? WHERE id = ?", now, c.id);
  });
  pump(user);
  return campaignView(user.id, c.id);
}

/** Runs a campaign once. Use `rerunFormat` or `duplicateCampaign` after that. */
export function runCampaign(user: User, id: string, expected: unknown) {
  const c = ownedCampaign(user.id, id);
  if (hasItems(c.id)) throw new ApiError(409, "already_ran", "This campaign already ran. Re-run a format, or duplicate the campaign.");
  return launch(user, c, formatsOf(c), expected);
}

/** Makes a fresh round of variations for one format. Earlier results stay. */
export function rerunFormat(user: User, id: string, formatId: string, expected: unknown) {
  const c = ownedCampaign(user.id, id);
  return launch(user, c, [checkFormatOf(c, formatId)], expected);
}

/* --------------------------------- feeding --------------------------------- */

function activeJobs(userId: string): number {
  return get<{ n: number }>("SELECT COUNT(*) AS n FROM jobs WHERE user_id = ? AND status IN ('queued', 'running')", userId)!.n;
}

function jobState(userId: string, jobId: string) {
  const j = get<{ status: string; error_code: string | null; error_message: string | null; deleted_at: number | null }>(
    "SELECT status, error_code, error_message, deleted_at FROM jobs WHERE id = ? AND user_id = ?", jobId, userId);
  if (!j) return { status: "canceled", code: "canceled", message: "This ad was removed." };
  return { status: j.status, code: j.error_code ?? j.status, message: j.error_message ?? "This one did not work." };
}

function finish(it: ItemRow, status: ItemStatus, code: string | null = null, message: string | null = null) {
  run("UPDATE ad_items SET status = ?, error_code = ?, error_message = ?, finished_at = ? WHERE id = ?", status, code, message, Date.now(), it.id);
}

/** Submits one job for an item. Returns false when the member has no free job slot. */
function submit(user: User, it: ItemRow, format: AdFormat, step: "speech" | "main", inputs: Record<string, string[]>): boolean {
  const meta = { campaignId: it.campaign_id, itemId: it.id, formatId: it.format_id, variation: it.variation, round: it.round, step };
  try {
    const modelId = step === "speech" ? format.speech!.modelId : format.modelId;
    const values = step === "speech" ? format.speech!.values : format.values;
    const prompt = step === "speech" ? it.script : it.prompt;
    const [job] = submitJobs(user, { modelId, prompt, values, inputs, count: 1, surface: SURFACE, meta });
    if (step === "speech") run("UPDATE ad_items SET status = 'running', speech_job_id = ? WHERE id = ?", job.id, it.id);
    else run("UPDATE ad_items SET status = 'running', job_id = ? WHERE id = ?", job.id, it.id);
    return true;
  } catch (err) {
    if (err instanceof ApiError && err.code === "too_many_jobs") return false;
    const e = err instanceof ApiError ? err : new ApiError(500, "server_error", "Something went wrong on our side.");
    if (!(err instanceof ApiError)) console.error("[ads] submit failed:", err);
    finish(it, "failed", e.code, e.message);
    return true;
  }
}

/**
 * Moves one member's ads along: settles items whose jobs finished, then feeds waiting
 * items in while job slots are free. Synchronous, so two calls never interleave.
 */
export function pump(user: User) {
  const limit = planOf(user.plan).concurrency;
  const live = all<ItemRow>("SELECT * FROM ad_items WHERE user_id = ? AND status IN ('waiting', 'running') ORDER BY seq", user.id);
  for (const it of live) {
    const format = getFormat(it.format_id);
    if (!format) {
      finish(it, "failed", "format_removed", "This ad format is no longer offered.");
      continue;
    }
    if (it.status === "running" && it.job_id) {
      const s = jobState(user.id, it.job_id);
      if (s.status === "succeeded") finish(it, "succeeded");
      else if (s.status === "failed") finish(it, "failed", s.code, s.message);
      else if (s.status === "canceled") finish(it, "canceled", "canceled", "This ad was canceled.");
      continue;
    }
    if (it.status === "running" && it.speech_job_id) {
      const s = jobState(user.id, it.speech_job_id);
      if (s.status === "failed") finish(it, "failed", s.code, s.message);
      else if (s.status === "canceled") finish(it, "canceled", "canceled", "This ad was canceled.");
      else if (s.status === "succeeded") {
        // The speech is ready: lip-sync it.
        const audio = (assetsOfJobs([it.speech_job_id]).get(it.speech_job_id) ?? []).find((a) => a.kind === "audio");
        if (!audio) {
          finish(it, "failed", "failed", "The voice track was removed before the video could start.");
          continue;
        }
        const voiceSlot = format.slots.find((s2) => s2.from === "speech")!.slot;
        if (activeJobs(user.id) >= limit) continue;
        if (!submit(user, it, format, "main", { ...parseJson<Record<string, string[]>>(it.inputs, {}), [voiceSlot]: [audio.id] })) continue;
      }
      continue;
    }
    // waiting
    if (activeJobs(user.id) >= limit) continue;
    const step = format.speech ? "speech" : "main";
    submit(user, it, format, step, step === "speech" ? {} : parseJson<Record<string, string[]>>(it.inputs, {}));
  }
}

const holder = (globalThis as unknown as { __parallaxAdsPump?: { timer?: ReturnType<typeof setInterval> } }).__parallaxAdsPump ??= {};

/** Starts the background feeder once per process. Routes call this; it is cheap after the first time. */
export function ensurePump() {
  if (holder.timer) return;
  holder.timer = setInterval(() => {
    try {
      const users = all<{ user_id: string }>("SELECT DISTINCT user_id FROM ad_items WHERE status IN ('waiting', 'running')");
      for (const { user_id } of users) {
        const u = userById(user_id);
        if (u) pump(u);
      }
    } catch (err) {
      console.error("[ads] feeder:", err instanceof Error ? err.message : err);
    }
  }, 1500);
  holder.timer.unref?.();
}

/* --------------------------------- reading --------------------------------- */

function safeJob(userId: string, id: string | null): Job | null {
  if (!id) return null;
  try {
    return getJob(userId, id);
  } catch {
    return null;
  }
}

function itemView(userId: string, r: ItemRow) {
  const job = safeJob(userId, r.job_id);
  return {
    id: r.id,
    campaignId: r.campaign_id,
    formatId: r.format_id,
    round: r.round,
    variation: r.variation,
    status: r.status,
    winner: r.winner === 1,
    prompt: r.prompt,
    script: r.script,
    copy: parseJson<AdCopy>(r.copy, { headline: "", caption: "", cta: "" }),
    cost: r.cost,
    error: r.status === "failed" ? { code: r.error_code ?? "failed", message: r.error_message ?? "This one did not work." } : null,
    job,
    speechJob: safeJob(userId, r.speech_job_id),
    assets: job?.assets ?? [],
    createdAt: r.created_at,
    finishedAt: r.finished_at,
  };
}

function counts(rows: { status: ItemStatus; winner: number }[]) {
  const c = { waiting: 0, running: 0, succeeded: 0, failed: 0, canceled: 0, winners: 0 };
  for (const r of rows) {
    c[r.status]++;
    if (r.winner) c.winners++;
  }
  return c;
}

function statusOf(c: ReturnType<typeof counts>, total: number): "draft" | "running" | "done" {
  if (total === 0) return "draft";
  return c.waiting + c.running > 0 ? "running" : "done";
}

function formatSummary(f: AdFormat) {
  return { id: f.id, name: f.name, output: f.output, group: f.group, platform: f.platform };
}

function header(userId: string, c: CampaignRow) {
  const product = c.product_id ? get<{ id: string; name: string }>("SELECT id, name FROM ad_products WHERE id = ? AND user_id = ?", c.product_id, userId) : null;
  const kit = c.brand_kit_id ? get<{ id: string; name: string }>("SELECT id, name FROM ad_brand_kits WHERE id = ? AND user_id = ?", c.brand_kit_id, userId) : null;
  return {
    id: c.id,
    name: c.name,
    product: product ?? null,
    brandKit: kit ?? null,
    formats: formatsOf(c),
    variations: c.variations,
    script: c.script,
    presenter: c.presenter_asset_id ? { assetId: c.presenter_asset_id, url: `/api/assets/${c.presenter_asset_id}/file` } : null,
    copiedFrom: c.copied_from,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  };
}

/** A campaign with every ad, grouped by format (campaign order first, then newest round first). */
export function campaignView(userId: string, id: string) {
  const c = ownedCampaign(userId, id);
  const rows = all<ItemRow>("SELECT * FROM ad_items WHERE campaign_id = ? AND user_id = ? ORDER BY round DESC, variation", c.id, userId);
  const order = [...formatsOf(c), ...rows.map((r) => r.format_id)].filter((f, i, a) => a.indexOf(f) === i);
  const n = counts(rows);
  return {
    ...header(userId, c),
    status: statusOf(n, rows.length),
    counts: n,
    groups: order
      .map((fid) => ({ fid, items: rows.filter((r) => r.format_id === fid) }))
      .filter((g) => getFormat(g.fid))
      .map((g) => ({ format: formatSummary(getFormat(g.fid)!), items: g.items.map((r) => itemView(userId, r)) })),
  };
}

export function listCampaigns(userId: string) {
  const list = all<CampaignRow>("SELECT * FROM ad_campaigns WHERE user_id = ? ORDER BY created_at DESC", userId);
  return list.map((c) => {
    const rows = all<{ status: ItemStatus; winner: number; job_id: string | null }>("SELECT status, winner, job_id FROM ad_items WHERE campaign_id = ? ORDER BY winner DESC, seq", c.id);
    const n = counts(rows);
    const done = rows.find((r) => r.status === "succeeded" && r.job_id);
    const cover = done?.job_id ? (assetsOfJobs([done.job_id]).get(done.job_id) ?? [])[0] : undefined;
    return { ...header(userId, c), status: statusOf(n, rows.length), counts: n, cover: cover ? { assetId: cover.id, kind: cover.kind, url: `/api/assets/${cover.id}/file` } : null };
  });
}
