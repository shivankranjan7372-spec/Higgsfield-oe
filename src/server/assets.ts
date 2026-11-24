import "server-only";

import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import type { MediaType } from "@/registry/types";
import { all, dataDir, get, newId, parseJson, run, type Param } from "./db";
import { ApiError, badRequest, notFound } from "./errors";
import { ffprobe, imageSize, mp4Probe, sniff, wavDuration, writePoster } from "./media";

/**
 * The asset store: every picture, clip and sound a member uploads or generates.
 * Files live on disk under `data/assets/<userId>/`, rows in the `assets` table.
 * An asset is private to its owner unless `is_public` is set.
 */

export interface AssetRow {
  seq: number;
  id: string;
  user_id: string;
  job_id: string | null;
  kind: MediaType;
  source: "generated" | "upload";
  mime: string;
  bytes: number;
  width: number | null;
  height: number | null;
  duration: number | null;
  path: string;
  poster_path: string | null;
  title: string;
  prompt: string;
  model_id: string | null;
  params: string;
  favorite: number;
  folder_id: string | null;
  is_public: number;
  published_at: number | null;
  remote_url: string | null;
  remote_expires_at: number | null;
  created_at: number;
  deleted_at: number | null;
}

/** What the browser gets. No disk paths, no provider URLs. */
export interface Asset {
  id: string;
  kind: MediaType;
  source: "generated" | "upload";
  mime: string;
  bytes: number;
  width: number | null;
  height: number | null;
  duration: number | null;
  url: string;
  posterUrl: string | null;
  title: string;
  prompt: string;
  modelId: string | null;
  params: Record<string, unknown>;
  favorite: boolean;
  folderId: string | null;
  isPublic: boolean;
  jobId: string | null;
  createdAt: number;
  /** Pass as `before` to page further back. */
  cursor: number;
}

export function toAsset(r: AssetRow): Asset {
  const url = `/api/assets/${r.id}/file`;
  return {
    id: r.id,
    kind: r.kind,
    source: r.source,
    mime: r.mime,
    bytes: r.bytes,
    width: r.width,
    height: r.height,
    duration: r.duration,
    url,
    posterUrl: r.poster_path ? `${url}?poster=1` : null,
    title: r.title,
    prompt: r.prompt,
    modelId: r.model_id,
    params: parseJson<Record<string, unknown>>(r.params, {}),
    favorite: r.favorite === 1,
    folderId: r.folder_id,
    isPublic: r.is_public === 1,
    jobId: r.job_id,
    createdAt: r.created_at,
    cursor: r.seq,
  };
}

/* --------------------------------- writing -------------------------------- */

const MB = 1_000_000;

/** Upload limits. Video stays under the 30 MB the provider gateway accepts as reference media. */
export const UPLOAD_LIMIT: Record<MediaType, number> = { image: 20 * MB, video: 30 * MB, audio: 20 * MB };
const GENERATED_LIMIT = 400 * MB;

export interface NewAsset {
  userId: string;
  bytes: Buffer;
  source: "generated" | "upload";
  /** Kinds the caller will take. Anything else is refused. */
  accept?: MediaType[];
  jobId?: string | null;
  title?: string;
  prompt?: string;
  modelId?: string | null;
  params?: Record<string, unknown>;
}

export async function saveAsset(input: NewAsset): Promise<AssetRow> {
  const found = sniff(input.bytes);
  if (!found) throw badRequest("That file type is not supported. Use PNG, JPEG, WebP, GIF, MP4, MOV, WebM, MP3, WAV, M4A or OGG.");
  if (input.accept && !input.accept.includes(found.kind)) {
    throw badRequest(`Expected ${input.accept.join(" or ")}, but that file is ${found.kind === "image" ? "an image" : found.kind === "audio" ? "audio" : "a video"}.`);
  }
  if (input.source === "upload" && found.mime === "image/heic") throw badRequest("HEIC photos are not supported yet. Convert the photo to JPEG or PNG first.");
  const limit = input.source === "upload" ? UPLOAD_LIMIT[found.kind] : GENERATED_LIMIT;
  if (input.bytes.length > limit) throw new ApiError(413, "invalid_request", `That file is too large. The limit for ${found.kind} is ${Math.round(limit / MB)} MB.`);

  const id = newId("ast");
  const rel = path.join("assets", input.userId, `${id}.${found.ext}`);
  const abs = path.join(dataDir(), rel);
  await fs.promises.mkdir(path.dirname(abs), { recursive: true });
  await fs.promises.writeFile(abs, input.bytes);

  let width: number | null = null;
  let height: number | null = null;
  let duration: number | null = null;
  let poster: string | null = null;

  if (found.kind === "image") {
    const size = imageSize(input.bytes, found.mime);
    width = size?.width ?? null;
    height = size?.height ?? null;
  } else {
    if (found.mime === "audio/wav") duration = wavDuration(input.bytes);
    let probe = found.ext === "mp4" || found.ext === "mov" || found.ext === "m4a" ? mp4Probe(abs) : { width: null, height: null, duration: null };
    if (duration === null && probe.duration === null) probe = await ffprobe(abs);
    width = probe.width;
    height = probe.height;
    duration ??= probe.duration;
    if (found.kind === "video") {
      const posterRel = path.join("assets", input.userId, `${id}.poster.jpg`);
      if (await writePoster(abs, path.join(dataDir(), posterRel))) poster = posterRel;
    }
  }

  run(
    `INSERT INTO assets (id, user_id, job_id, kind, source, mime, bytes, width, height, duration, path, poster_path, title, prompt, model_id, params, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.userId,
    input.jobId ?? null,
    found.kind,
    input.source,
    found.mime,
    input.bytes.length,
    width,
    height,
    duration,
    rel,
    poster,
    (input.title ?? "").slice(0, 200),
    (input.prompt ?? "").slice(0, 20_000),
    input.modelId ?? null,
    JSON.stringify(input.params ?? {}),
    Date.now(),
  );
  return assetById(id)!;
}

/* --------------------------------- reading -------------------------------- */

export function assetById(id: string): AssetRow | undefined {
  return get<AssetRow>("SELECT * FROM assets WHERE id = ? AND deleted_at IS NULL", id);
}

/** The member's own asset, or a 404. Never says whether someone else owns that id. */
export function ownedAsset(userId: string, id: string): AssetRow {
  const row = assetById(id);
  if (!row || row.user_id !== userId) throw notFound("That file does not exist.");
  return row;
}

/** An asset this viewer may see: their own, one that was published, or a member's profile picture. */
export function visibleAsset(viewerId: string | null, id: string): AssetRow {
  const row = assetById(id);
  if (row && (row.user_id === viewerId || row.is_public === 1)) return row;
  // A profile picture is shown to everyone, for as long as its owner keeps it as their picture.
  if (row?.kind === "image" && get("SELECT 1 FROM users WHERE id = ? AND avatar_asset_id = ?", row.user_id, id)) return row;
  throw notFound("That file does not exist.");
}

export interface AssetFilter {
  kind?: MediaType;
  source?: "generated" | "upload";
  favorite?: boolean;
  folderId?: string | null;
  jobId?: string;
  limit: number;
  /** A `cursor` from an earlier page. */
  before?: number;
}

export function listAssets(userId: string, f: AssetFilter): AssetRow[] {
  const where = ["user_id = ?", "deleted_at IS NULL"];
  const params: Param[] = [userId];
  if (f.kind) (where.push("kind = ?"), params.push(f.kind));
  if (f.source) (where.push("source = ?"), params.push(f.source));
  if (f.favorite) where.push("favorite = 1");
  if (f.folderId === null) where.push("folder_id IS NULL");
  else if (f.folderId) (where.push("folder_id = ?"), params.push(f.folderId));
  if (f.jobId) (where.push("job_id = ?"), params.push(f.jobId));
  if (f.before) (where.push("seq < ?"), params.push(f.before));
  return all<AssetRow>(`SELECT * FROM assets WHERE ${where.join(" AND ")} ORDER BY seq DESC LIMIT ?`, ...params, f.limit);
}

export function assetsOfJobs(jobIds: string[]): Map<string, AssetRow[]> {
  const out = new Map<string, AssetRow[]>();
  if (jobIds.length === 0) return out;
  const marks = jobIds.map(() => "?").join(",");
  for (const row of all<AssetRow>(`SELECT * FROM assets WHERE job_id IN (${marks}) AND deleted_at IS NULL ORDER BY seq`, ...jobIds)) {
    const list = out.get(row.job_id!) ?? [];
    list.push(row);
    out.set(row.job_id!, list);
  }
  return out;
}

/* -------------------------------- changing -------------------------------- */

export interface AssetPatch {
  title?: string;
  favorite?: boolean;
  folderId?: string | null;
  isPublic?: boolean;
}

export function patchAsset(userId: string, id: string, patch: AssetPatch): AssetRow {
  const row = ownedAsset(userId, id);
  if (patch.title !== undefined) run("UPDATE assets SET title = ? WHERE id = ?", patch.title.trim().slice(0, 200), id);
  if (patch.favorite !== undefined) run("UPDATE assets SET favorite = ? WHERE id = ?", patch.favorite ? 1 : 0, id);
  if (patch.folderId !== undefined) {
    if (patch.folderId !== null && !get("SELECT 1 FROM folders WHERE id = ? AND user_id = ?", patch.folderId, userId)) {
      throw notFound("That folder does not exist.");
    }
    run("UPDATE assets SET folder_id = ? WHERE id = ?", patch.folderId, id);
  }
  if (patch.isPublic !== undefined && (row.is_public === 1) !== patch.isPublic) {
    run("UPDATE assets SET is_public = ?, published_at = ? WHERE id = ?", patch.isPublic ? 1 : 0, patch.isPublic ? Date.now() : null, id);
  }
  return assetById(id)!;
}

/** Removes the asset and its files. The row stays, marked deleted, so job history still reads right. */
export function removeAsset(userId: string, id: string) {
  const row = ownedAsset(userId, id);
  run("UPDATE assets SET deleted_at = ?, is_public = 0, remote_url = NULL WHERE id = ?", Date.now(), id);
  for (const rel of [row.path, row.poster_path]) {
    if (rel) fs.rm(resolveInData(rel), { force: true }, () => {});
  }
}

/* ---------------------------------- files --------------------------------- */

/** Maps a stored relative path to disk, refusing anything that would leave the data directory. */
function resolveInData(rel: string): string {
  const root = path.resolve(dataDir());
  const abs = path.resolve(root, rel);
  if (!abs.startsWith(root + path.sep)) throw notFound();
  return abs;
}

export function assetFile(row: AssetRow): string {
  return resolveInData(row.path);
}

export function readAsset(row: AssetRow): Promise<Buffer> {
  return fs.promises.readFile(assetFile(row));
}

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/heic": "heic",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "audio/wav": "wav",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/ogg": "ogg",
  "audio/flac": "flac",
  "audio/aac": "aac",
};

/**
 * Streams an asset, honouring `Range` so video can seek. The headers stop a browser from
 * ever treating stored bytes as a page: a fixed media type, no sniffing, and a sandbox.
 */
export function fileResponse(req: Request, row: AssetRow, opts: { poster?: boolean; download?: boolean } = {}): Response {
  const rel = opts.poster ? row.poster_path : row.path;
  if (!rel) throw notFound();
  const file = resolveInData(rel);
  let size: number;
  try {
    size = fs.statSync(file).size;
  } catch {
    throw notFound("That file is gone.");
  }

  const mime = opts.poster ? "image/jpeg" : row.mime;
  const name = `parallax-${row.id.slice(4, 14)}.${opts.poster ? "jpg" : (EXT[row.mime] ?? "bin")}`;
  const headers = new Headers({
    "Content-Type": mime,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=31536000, immutable",
    "Content-Disposition": `${opts.download ? "attachment" : "inline"}; filename="${name}"`,
    "Content-Security-Policy": "sandbox; default-src 'none'",
    "X-Content-Type-Options": "nosniff",
  });

  let start = 0;
  let end = size - 1;
  let status = 200;
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    if (range[1]) {
      start = Number(range[1]);
      if (range[2]) end = Math.min(Number(range[2]), size - 1);
    } else {
      start = Math.max(0, size - Number(range[2]));
    }
    if (start > end || start >= size) {
      headers.set("Content-Range", `bytes */${size}`);
      return new Response(null, { status: 416, headers });
    }
    status = 206;
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  }
  headers.set("Content-Length", String(end - start + 1));

  if (req.method === "HEAD" || size === 0) return new Response(null, { status, headers });
  const stream = Readable.toWeb(fs.createReadStream(file, { start, end })) as ReadableStream<Uint8Array>;
  return new Response(stream, { status, headers });
}
