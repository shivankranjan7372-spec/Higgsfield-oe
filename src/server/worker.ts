import "server-only";

import { usdToMillicredits } from "@/config/economy";
import { catalogEndpoint, getModel, type MediaType } from "@/registry";
import { assetsOfJobs, ownedAsset, readAsset, removeAsset, saveAsset, type AssetRow } from "./assets";
import { grant, release, settle } from "./credits";
import { all, get, parseJson, run, tx } from "./db";
import { ApiError } from "./errors";
import { ResultError, mediaFromReply, mediaFromTask } from "./extract";
import type { JobRow } from "./jobs";
import { mockDelayMs, mockMedia, mockShouldFail } from "./mock";
import { TregUnreachable, classify, redact, taskFailure, taskOutcome, tregCall, tregMode, tregTask, tregUploadMedia, type TregTask } from "./treg";

/**
 * The worker: one loop inside the server process that moves jobs along.
 *
 *   queued  -> send the request to the provider gateway
 *   running -> ask the gateway how the job is doing, and collect the files when done
 *
 * The loop itself never waits on the network. Each job's step runs on its own and is
 * tracked in `inflight`, so a slow download cannot hold up the queue.
 *
 * Everything that matters is in the `jobs` table. After a restart the loop simply
 * carries on: jobs with a call id are polled again, and jobs caught mid-submit are
 * sent again under the same idempotency key, which the gateway answers from its
 * stored copy without charging twice.
 */

const MAX_BUSY = 12; // steps in flight at once
const MAX_ATTEMPTS = 6; // submits per job before it gives up
const MB = 1_000_000;

interface State {
  /** The module instance that runs the loop. Hot reload makes new instances; only the newest runs. */
  owner: symbol | null;
  timer: ReturnType<typeof setTimeout> | null;
  /** Jobs with a step in flight. Shared by every instance, so a job is never worked twice. */
  inflight: Set<string>;
  recovered: boolean;
}

const shared = globalThis as typeof globalThis & { __parallaxWorker?: State };
const state: State = (shared.__parallaxWorker ??= { owner: null, timer: null, inflight: new Set(), recovered: false });
const me = Symbol("worker");

/** Starts the loop if this process is not running it yet. Cheap; called on every request. */
export function ensureWorker() {
  if (state.owner === me) return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  state.owner = me;
  if (!state.recovered) {
    state.recovered = true;
    guard("recover", () => sweep(0));
  }
  schedule(50);
}

/** Wakes the loop now. Call after queueing work. */
export function kick() {
  if (state.owner === me) schedule(20);
  else ensureWorker();
}

export function outputOf(job: Pick<JobRow, "model_id" | "kind">): MediaType {
  return getModel(job.model_id)?.output ?? (job.kind === "music" ? "audio" : job.kind);
}

/* ---------------------------------- loop ---------------------------------- */

function schedule(ms: number) {
  if (state.owner !== me) return;
  if (state.timer) clearTimeout(state.timer);
  state.timer = setTimeout(tick, ms);
  state.timer.unref?.();
}

function guard(what: string, fn: () => void) {
  try {
    fn();
  } catch (err) {
    console.error(`[worker] ${what}: ${describe(err)}`);
  }
}

const describe = (err: unknown) => redact(err instanceof Error ? (err.stack ?? err.message) : String(err));

function tick() {
  state.timer = null;
  if (state.owner !== me) return;
  let active = 0;
  guard("tick", () => {
    const now = Date.now();
    const due = [
      ...all<JobRow>("SELECT * FROM jobs WHERE status = 'queued' AND next_poll_at <= ? ORDER BY seq LIMIT 40", now),
      ...all<JobRow>("SELECT * FROM jobs WHERE status = 'running' AND treg_call_id IS NOT NULL AND next_poll_at <= ? ORDER BY next_poll_at LIMIT 100", now),
    ];
    for (const job of due) {
      if (state.inflight.size >= MAX_BUSY) break;
      if (state.inflight.has(job.id)) continue;
      state.inflight.add(job.id);
      void step(job).finally(() => state.inflight.delete(job.id));
    }
    sweep(15 * 60_000);
    active = get<{ n: number }>("SELECT COUNT(*) AS n FROM jobs WHERE status IN ('queued', 'running')")!.n;
  });
  schedule(active > 0 ? 1000 : 15_000);
}

/** One step for one job. Never throws: every failure ends up on the job. */
async function step(job: JobRow) {
  try {
    if (job.status === "queued") await start(job);
    else await poll(job);
  } catch (err) {
    if (err instanceof ResultError) fail(job.id, "provider_error", err.message);
    else if (err instanceof ApiError) fail(job.id, "provider_error", "The model returned a file we could not read.");
    else {
      console.error(`[worker] ${job.id} ${job.endpoint}: ${describe(err)}`);
      fail(job.id, "server_error", "Something went wrong on our side. Try again.");
    }
  }
}

/**
 * A job marked running with no call id was caught mid-submit by a crash or a restart.
 * Send it again, unless the provider cannot replay a call safely.
 */
function sweep(minAgeMs: number) {
  const cutoff = Date.now() - minAgeMs;
  const stuck = all<JobRow>("SELECT * FROM jobs WHERE status = 'running' AND treg_call_id IS NULL AND COALESCE(started_at, created_at) <= ?", cutoff);
  for (const job of stuck) {
    if (state.inflight.has(job.id)) continue;
    if (!replayable(job.endpoint) || job.attempts >= MAX_ATTEMPTS) fail(job.id, "interrupted", "This one was interrupted. Try again.");
    else run("UPDATE jobs SET status = 'queued', next_poll_at = 0 WHERE id = ? AND status = 'running'", job.id);
  }
}

/** Google's routes are never answered from a stored copy, so sending twice could charge twice. */
const replayable = (endpoint: string) => !endpoint.startsWith("google-ai.");

/* --------------------------------- submit --------------------------------- */

async function start(job: JobRow) {
  const now = Date.now();
  const claimed = run("UPDATE jobs SET status = 'running', started_at = COALESCE(started_at, ?), attempts = attempts + 1 WHERE id = ? AND status = 'queued'", now, job.id).changes === 1;
  if (!claimed) return;
  const attempts = job.attempts + 1;
  const output = outputOf(job);

  if (tregMode() === "mock") {
    run("UPDATE jobs SET treg_call_id = 'mock', next_poll_at = ? WHERE id = ?", now + mockDelayMs(output), job.id);
    return;
  }

  const stored = parseJson<{ body?: unknown; query?: Record<string, string | number | boolean>; headers?: Record<string, string> }>(job.request, {});
  let body: unknown;
  try {
    body = await fillAssets(job.user_id, stored.body ?? {});
  } catch (err) {
    if (err instanceof ApiError) return fail(job.id, "invalid_request", "A file this generation uses was removed.");
    if (err instanceof TregUnreachable) return retryOrFail(job, attempts); // nothing was sent yet
    throw err;
  }

  const rule = catalogEndpoint(job.endpoint);
  let reply;
  try {
    reply = await tregCall(job.endpoint, {
      body,
      query: stored.query,
      headers: stored.headers,
      idempotencyKey: job.id,
      customer: job.user_id,
      // A guard against a mispriced request, not a budget: generous, but never open-ended.
      maxCostUsd: Math.max(job.est_usd * 2, rule?.cost?.ceiling ?? 0, 0.02),
    });
  } catch (err) {
    if (!(err instanceof TregUnreachable)) throw err;
    console.warn(`[worker] ${job.id} ${job.endpoint}: ${err.message}`);
    // No answer. The call may have run, so only send it again where a replay is free.
    if (replayable(job.endpoint)) return retryOrFail(job, attempts);
    return fail(job.id, "interrupted", "The connection to the model dropped. Try again.");
  }

  if (!reply.ok) {
    const f = classify(reply);
    console.warn(`[worker] ${job.id} ${job.endpoint} refused (${f.kind}): ${f.detail}`);
    if (f.kind === "retry") return retryOrFail(job, attempts, f.message);
    return fail(job.id, f.code, f.message);
  }

  if (reply.isAsync || rule?.async) {
    if (!reply.callId) return fail(job.id, "provider_error", "The model did not accept this one. Try again.");
    run("UPDATE jobs SET treg_call_id = ?, provider_cost_micro = ?, next_poll_at = ? WHERE id = ?", reply.callId, reply.costMicro, Date.now() + pause(rule?.async?.interval), job.id);
    return;
  }

  // The provider has run and charged. Note the cost now, so it is on record even if the
  // result turns out to be unreadable. The call id stays empty until the files are saved:
  // a crash before then sends the job again, and the gateway replays the answer for free.
  if (reply.costMicro != null) run("UPDATE jobs SET provider_cost_micro = ? WHERE id = ?", reply.costMicro, job.id);
  const files = await mediaFromReply(reply, output, job.expect_count);
  await finish(job, files, reply.callId, reply.costMicro);
}

function retryOrFail(job: JobRow, attempts: number, message = "The model is busy or unavailable. Try again shortly.") {
  if (attempts >= MAX_ATTEMPTS) return fail(job.id, "model_unavailable", message);
  const wait = Math.min(60_000, 3000 * 2 ** (attempts - 1));
  run("UPDATE jobs SET status = 'queued', next_poll_at = ? WHERE id = ? AND status = 'running'", Date.now() + wait, job.id);
}

/** Seconds between polls, as milliseconds: what the gateway suggests, kept between 2 and 15. */
const pause = (seconds: number | null | undefined) => Math.min(15, Math.max(2, Number(seconds) || 5)) * 1000;

/* ------------------------------ reference media ----------------------------- */

const PLACEHOLDER = /asset(-b64)?:(ast_[A-Za-z0-9]{16})/g;

/**
 * The stored request names the member's files by id (`asset:<id>`, `asset-b64:<id>`).
 * Just before sending, each one becomes a short-lived public URL or its bytes in base64.
 */
async function fillAssets(userId: string, body: unknown): Promise<unknown> {
  const text = JSON.stringify(body);
  const urls = new Map<string, string>();
  const datas = new Map<string, string>();
  for (const [, b64, id] of text.matchAll(PLACEHOLDER)) {
    const into = b64 ? datas : urls;
    if (into.has(id)) continue;
    const row = ownedAsset(userId, id); // refuses anything the member does not own
    into.set(id, b64 ? (await readAsset(row)).toString("base64") : await publicUrl(row));
  }
  if (urls.size + datas.size === 0) return body;
  const quoted = (s: string) => JSON.stringify(s).slice(1, -1);
  return JSON.parse(text.replace(PLACEHOLDER, (_all, b64: string | undefined, id: string) => quoted((b64 ? datas : urls).get(id)!)));
}

/** A URL the provider can fetch the file from. Kept on the asset and reused until it is close to expiring. */
async function publicUrl(row: AssetRow): Promise<string> {
  const now = Date.now();
  if (row.remote_url && (row.remote_expires_at ?? 0) > now + 3_600_000) return row.remote_url;
  if (row.bytes > 30 * MB) throw new ResultError("That reference file is too large for this model. Use one under 30 MB.");
  const url = await tregUploadMedia(await readAsset(row), row.mime);
  run("UPDATE assets SET remote_url = ?, remote_expires_at = ? WHERE id = ?", url, now + 6 * 86_400_000, row.id);
  return url;
}

/* ---------------------------------- poll ---------------------------------- */

const expired = (job: JobRow, output: MediaType) => Date.now() - (job.started_at ?? job.created_at) > (output === "video" ? 30 : 10) * 60_000;
const TOO_SLOW = "This took too long and was stopped. Try again.";
const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

async function poll(job: JobRow) {
  const output = outputOf(job);

  if (job.treg_call_id === "mock") {
    if (mockShouldFail(job.prompt)) return fail(job.id, "provider_error", "The mock model fails on purpose when the prompt contains [fail].");
    const files = await mockMedia({ output, prompt: job.prompt, params: parseJson(job.params, {}), count: job.expect_count, seed: job.id });
    return finish(job, files);
  }

  const later = (ms: number) => void run("UPDATE jobs SET next_poll_at = ? WHERE id = ? AND status = 'running'", Date.now() + ms, job.id);

  let task: TregTask;
  try {
    task = await tregTask(job.treg_call_id!);
  } catch (err) {
    if (!(err instanceof TregUnreachable)) throw err;
    if (err.status === 404 || err.status === 410) return fail(job.id, "provider_error", "The model lost track of this one. Try again.");
    if (expired(job, output)) return fail(job.id, "timeout", TOO_SLOW);
    return later(5000);
  }

  const outcome = taskOutcome(job.endpoint, task);
  if (outcome === "failed") return fail(job.id, "provider_error", taskFailure(task));
  if (outcome === "running") {
    if (expired(job, output)) return fail(job.id, "timeout", TOO_SLOW);
    return later(pause(task.retry_after ?? catalogEndpoint(job.endpoint)?.async?.interval));
  }

  // Result links are short-lived, so collect now. One more try covers a dropped download.
  let files: Buffer[];
  try {
    files = await mediaFromTask(job.endpoint, task, output, job.expect_count);
  } catch (err) {
    if (!(err instanceof ResultError)) throw err;
    await sleep(3000);
    files = await mediaFromTask(job.endpoint, task, output, job.expect_count);
  }
  await finish(job, files);
}

/* ---------------------------------- ending --------------------------------- */

/** Saves the files, marks the job done and turns the credit hold into the charge. */
async function finish(job: JobRow, files: Buffer[], callId: string | null = null, costMicro: number | null = null) {
  // The job may have been cancelled, or removed with its owner, while the provider was working.
  if (!get("SELECT 1 FROM jobs WHERE id = ? AND status = 'running'", job.id)) return;
  const output = outputOf(job);
  const want = Math.max(1, job.expect_count);
  // A crash between saving and marking done can leave files from an earlier try. Start clean.
  for (const old of assetsOfJobs([job.id]).get(job.id) ?? []) removeAsset(job.user_id, old.id);

  const saved: AssetRow[] = [];
  const drop = () => saved.forEach((a) => removeAsset(job.user_id, a.id));
  try {
    for (const bytes of files.slice(0, want)) {
      saved.push(
        await saveAsset({
          userId: job.user_id,
          bytes,
          source: "generated",
          accept: [output],
          jobId: job.id,
          prompt: job.prompt,
          modelId: job.model_id,
          params: parseJson<Record<string, unknown>>(job.params, {}),
        }),
      );
    }
  } catch (err) {
    drop();
    throw err;
  }

  const done = tx(() => {
    const changed =
      run(
        `UPDATE jobs SET status = 'succeeded', finished_at = ?, error_code = NULL, error_message = NULL,
                         treg_call_id = COALESCE(?, treg_call_id), provider_cost_micro = COALESCE(?, provider_cost_micro)
          WHERE id = ? AND status = 'running'`,
        Date.now(),
        callId,
        costMicro,
        job.id,
      ).changes === 1;
    if (!changed) return false;
    settle(job.id);
    let cost = job.cost;
    // A provider that bills by usage reports the real price with the result. The quote was
    // the most it could be, so charge the real price and give back the rest.
    if (costMicro != null && costMicro > 0 && catalogEndpoint(job.endpoint)?.cost?.settle === "usage") {
      const real = usdToMillicredits(costMicro / 1e6);
      if (real < cost) {
        grant(job.user_id, "refund", cost - real, "Refund: the model used less than quoted", job.id);
        run("UPDATE jobs SET cost = ? WHERE id = ?", real, job.id);
        cost = real;
      }
    }
    // Fewer results than paid for: give back the difference.
    if (saved.length < want) grant(job.user_id, "refund", Math.floor((cost * (want - saved.length)) / want), `Refund: ${saved.length} of ${want} results`, job.id);
    return true;
  });
  if (!done) drop(); // the job was ended some other way while we were saving
}

/** Marks the job failed and gives the credits back. Does nothing if the job already ended. */
function fail(jobId: string, code: string, message: string) {
  tx(() => {
    const changed =
      run(
        "UPDATE jobs SET status = 'failed', finished_at = ?, error_code = ?, error_message = ? WHERE id = ? AND status IN ('queued', 'running')",
        Date.now(),
        code,
        message.slice(0, 500),
        jobId,
      ).changes === 1;
    if (changed) release(jobId, "Returned: generation failed");
  });
}
