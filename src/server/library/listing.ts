import "server-only";

import { toAsset, type Asset, type AssetRow } from "@/server/assets";
import { all, get, type Param } from "@/server/db";
import { badRequest } from "@/server/errors";
import { getModel } from "@/registry";
import { decodeCursor, encodeCursor, KINDS, likePattern, SOURCES } from "./common";
import { expireTrash } from "./trash";

type Kind = (typeof KINDS)[number];

export const SORTS = ["newest", "oldest", "largest", "smallest", "title"] as const;
export type Sort = (typeof SORTS)[number];

export interface LibraryQuery {
  kind?: Kind;
  source?: (typeof SOURCES)[number];
  favorite?: boolean;
  /** A folder id, or null for "no folder". */
  folderId?: string | null;
  modelIds?: string[];
  /** Created at or after (ms). */
  from?: number;
  /** Created before (ms). */
  to?: number;
  q?: string;
  sort: Sort;
  limit: number;
  cursor: string | null;
}

/** Turns URL search params into a query. Unknown values are refused, not ignored, so the screen learns of its bugs. */
export function parseLibraryQuery(sp: URLSearchParams): LibraryQuery {
  const pick = <T extends string>(name: string, allowed: readonly T[]): T | undefined => {
    const v = sp.get(name);
    if (v === null || v === "" || v === "all") return undefined;
    const hit = allowed.find((a) => a === v);
    if (!hit) throw badRequest(`Unknown ${name} "${v.slice(0, 40)}".`);
    return hit;
  };
  const time = (name: string): number | undefined => {
    const v = sp.get(name);
    if (v === null || v === "") return undefined;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) throw badRequest(`"${name}" must be a time in milliseconds.`);
    return Math.floor(n);
  };
  const folder = sp.get("folder");
  const models = (sp.get("model") ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  if (models.length > 50 || models.some((m) => m.length > 80)) throw badRequest("Too many models in the filter.");
  const q = (sp.get("q") ?? "").trim();
  if (q.length > 200) throw badRequest("Keep the search under 200 characters.");
  const limitRaw = Number(sp.get("limit") ?? 60);
  const fav = sp.get("favorite");
  return {
    kind: pick("kind", KINDS),
    source: pick("source", SOURCES),
    favorite: fav === "1" || fav === "true",
    folderId: folder === null || folder === "" ? undefined : folder === "none" ? null : folder,
    modelIds: models.length ? models : undefined,
    from: time("from"),
    to: time("to"),
    q: q || undefined,
    sort: pick("sort", SORTS) ?? "newest",
    limit: Number.isFinite(limitRaw) ? Math.min(200, Math.max(1, Math.floor(limitRaw))) : 60,
    cursor: sp.get("cursor") || null,
  };
}

/** The WHERE clause for everything but kind and paging, so tab counts can share it. */
function baseWhere(userId: string, f: LibraryQuery): { where: string[]; params: Param[] } {
  const where = ["user_id = ?", "deleted_at IS NULL"];
  const params: Param[] = [userId];
  if (f.source) (where.push("source = ?"), params.push(f.source));
  if (f.favorite) where.push("favorite = 1");
  if (f.folderId === null) where.push("folder_id IS NULL");
  else if (f.folderId) (where.push("folder_id = ?"), params.push(f.folderId));
  if (f.modelIds) (where.push(`model_id IN (${f.modelIds.map(() => "?").join(",")})`), params.push(...f.modelIds));
  if (f.from !== undefined) (where.push("created_at >= ?"), params.push(f.from));
  if (f.to !== undefined) (where.push("created_at < ?"), params.push(f.to));
  if (f.q) {
    const p = likePattern(f.q);
    where.push("(title LIKE ? ESCAPE '\\' OR prompt LIKE ? ESCAPE '\\')");
    params.push(p, p);
  }
  return { where, params };
}

/* Each sort is keyset paged on (key, seq), so pages never repeat or skip a file. */
const ORDER: Record<Sort, { key: string; dir: "ASC" | "DESC"; text?: boolean }> = {
  newest: { key: "seq", dir: "DESC" },
  oldest: { key: "seq", dir: "ASC" },
  largest: { key: "bytes", dir: "DESC" },
  smallest: { key: "bytes", dir: "ASC" },
  title: { key: "lower(title)", dir: "ASC", text: true },
};

export interface KindCounts {
  all: number;
  image: number;
  video: number;
  audio: number;
}

export interface LibraryPage {
  assets: Asset[];
  nextCursor: string | null;
  /** Matches for each kind tab, under every other filter in the query. */
  counts: KindCounts;
}

export function listLibrary(userId: string, f: LibraryQuery): LibraryPage {
  const { where, params } = baseWhere(userId, f);

  const counts: KindCounts = { all: 0, image: 0, video: 0, audio: 0 };
  for (const r of all<{ kind: Kind; n: number }>(`SELECT kind, COUNT(*) AS n FROM assets WHERE ${where.join(" AND ")} GROUP BY kind`, ...params)) {
    if (r.kind in counts) counts[r.kind] = r.n;
    counts.all += r.n;
  }

  if (f.kind) (where.push("kind = ?"), params.push(f.kind));
  const o = ORDER[f.sort];
  const at = decodeCursor(f.cursor);
  if (at) {
    const cmp = o.dir === "DESC" ? "<" : ">";
    const key = o.text ? String(at[0]) : Number(at[0]);
    if (o.key === "seq") (where.push(`seq ${cmp} ?`), params.push(at[1]));
    else (where.push(`(${o.key} ${cmp} ? OR (${o.key} = ? AND seq ${cmp} ?))`), params.push(key, key, at[1]));
  }
  const order = o.key === "seq" ? `seq ${o.dir}` : `${o.key} ${o.dir}, seq ${o.dir}`;
  const rows = all<AssetRow>(`SELECT * FROM assets WHERE ${where.join(" AND ")} ORDER BY ${order} LIMIT ?`, ...params, f.limit + 1);
  const page = rows.slice(0, f.limit);
  const last = page[page.length - 1];
  let nextCursor: string | null = null;
  if (rows.length > f.limit && last) {
    const key = f.sort === "title" ? last.title.replace(/[A-Z]/g, (c) => c.toLowerCase()) /* SQLite lower() is ASCII only */ : f.sort === "largest" || f.sort === "smallest" ? last.bytes : last.seq;
    nextCursor = encodeCursor(key, last.seq);
  }
  return { assets: page.map(toAsset), nextCursor, counts };
}

export interface LibrarySummary {
  counts: KindCounts & { favorites: number; generated: number; uploads: number; unfiled: number; trash: number; folders: number; elements: number };
  storage: { totalBytes: number; byKind: Record<Kind, number>; trashBytes: number };
  /** Models that made at least one of the member's files, for the model filter. */
  models: { id: string; name: string; count: number }[];
  trashRetentionDays: number;
}

export function librarySummary(userId: string): LibrarySummary {
  expireTrash(userId);
  const byKind: Record<Kind, number> = { image: 0, video: 0, audio: 0 };
  const counts = { all: 0, image: 0, video: 0, audio: 0, favorites: 0, generated: 0, uploads: 0, unfiled: 0, trash: 0, folders: 0, elements: 0 };
  let totalBytes = 0;
  for (const r of all<{ kind: Kind; n: number; bytes: number }>(
    "SELECT kind, COUNT(*) AS n, COALESCE(SUM(bytes), 0) AS bytes FROM assets WHERE user_id = ? AND deleted_at IS NULL GROUP BY kind",
    userId,
  )) {
    if (!(r.kind in byKind)) continue;
    counts[r.kind] = r.n;
    counts.all += r.n;
    byKind[r.kind] = r.bytes;
    totalBytes += r.bytes;
  }
  const extra = get<{ fav: number; gen: number; up: number; unfiled: number }>(
    `SELECT COALESCE(SUM(favorite = 1), 0) AS fav, COALESCE(SUM(source = 'generated'), 0) AS gen,
            COALESCE(SUM(source = 'upload'), 0) AS up, COALESCE(SUM(folder_id IS NULL), 0) AS unfiled
       FROM assets WHERE user_id = ? AND deleted_at IS NULL`,
    userId,
  )!;
  counts.favorites = extra.fav;
  counts.generated = extra.gen;
  counts.uploads = extra.up;
  counts.unfiled = extra.unfiled;
  const trash = get<{ n: number; bytes: number }>(
    "SELECT COUNT(*) AS n, COALESCE(SUM(a.bytes), 0) AS bytes FROM library_trash t JOIN assets a ON a.id = t.asset_id WHERE t.user_id = ?",
    userId,
  )!;
  counts.trash = trash.n;
  counts.folders = get<{ n: number }>("SELECT COUNT(*) AS n FROM folders WHERE user_id = ?", userId)!.n;
  counts.elements = get<{ n: number }>("SELECT COUNT(*) AS n FROM elements WHERE user_id = ?", userId)!.n;
  const models = all<{ model_id: string; n: number }>(
    "SELECT model_id, COUNT(*) AS n FROM assets WHERE user_id = ? AND deleted_at IS NULL AND model_id IS NOT NULL GROUP BY model_id ORDER BY n DESC",
    userId,
  ).map((r) => ({ id: r.model_id, name: getModel(r.model_id)?.name ?? r.model_id, count: r.n }));
  return { counts, storage: { totalBytes, byKind, trashBytes: trash.bytes }, models, trashRetentionDays: 30 };
}
