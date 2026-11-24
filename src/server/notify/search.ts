import "server-only";

import { models, type ModelDef } from "@/registry";
import { assetsOfJobs, toAsset, type AssetRow } from "@/server/assets";
import { all, db, get, run, type Param } from "@/server/db";

/**
 * One search box over models, the member's files, generations and folders, and public posts.
 * Ranking inside a group: the title starts with the query, then a word in the title does,
 * then the title contains it, then only the prompt or description does. Ties go to the newest.
 *
 * Files and public posts can be large, so they use an FTS5 trigram index when this SQLite
 * build has FTS5 (checked once per process). Everything else, and queries under three
 * characters, use LIKE with escaped wildcards. Every hit is re-checked against the live row,
 * so the index can only ever be late, never leak or show something deleted.
 */

export const SEARCH_TYPES = ["models", "files", "generations", "folders", "posts"] as const;
export type SearchType = (typeof SEARCH_TYPES)[number];
const MEMBER_ONLY: SearchType[] = ["files", "generations", "folders"];

const LABELS: Record<SearchType, string> = {
  models: "Models",
  files: "Your files",
  generations: "Your generations",
  folders: "Folders",
  posts: "Public posts",
};

export type Match = "prefix" | "word" | "contains" | "detail";

export interface SearchItem {
  type: SearchType;
  id: string;
  title: string;
  subtitle: string;
  href: string;
  thumbUrl: string | null;
  createdAt: number | null;
  match: Match;
  /** Type-specific extras; see docs/api/notify.md. */
  extra: Record<string, unknown>;
}

export interface SearchGroup {
  type: SearchType;
  label: string;
  items: SearchItem[];
  /** True when more matches exist than the cap. */
  more: boolean;
}

/* --------------------------------- ranking -------------------------------- */

const RANK: Record<Match, number> = { prefix: 0, word: 1, contains: 2, detail: 3 };

export function matchOf(q: string, title: string, details: string[] = []): Match | null {
  const t = title.toLowerCase();
  if (t.startsWith(q)) return "prefix";
  if (t.split(/[^\p{L}\p{N}]+/u).some((w) => w.startsWith(q))) return "word";
  if (t.includes(q)) return "contains";
  if (details.some((d) => d.toLowerCase().includes(q))) return "detail";
  return null;
}

function rankAndCap(items: SearchItem[], cap: number, order?: Map<string, number>): { items: SearchItem[]; more: boolean } {
  items.sort(
    (a, b) =>
      RANK[a.match] - RANK[b.match] ||
      (b.createdAt ?? 0) - (a.createdAt ?? 0) ||
      (order ? (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0) : 0),
  );
  return { items: items.slice(0, cap), more: items.length > cap };
}

export const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/* ---------------------------------- models -------------------------------- */

const STUDIO: Record<string, string> = { image: "/image", video: "/video", audio: "/audio", music: "/audio" };

/** Plain words for what a model does, from its registry entry: "text to video", "image to video"... */
export function capabilities(m: ModelDef): string[] {
  const inputs = new Set<string>();
  if (m.prompt) inputs.add("text");
  for (const slot of m.slots) for (const a of slot.accept) inputs.add(a);
  const out = m.surfaces.includes("speech") ? "speech" : m.kind === "music" ? "music" : m.output;
  const caps = [...inputs].map((i) => `${i} to ${out}`);
  for (const s of m.surfaces) if (!["image", "video", "speech", "music"].includes(s)) caps.push(s);
  return caps;
}

export function modelItem(m: ModelDef, match: Match): SearchItem {
  return {
    type: "models",
    id: m.id,
    title: m.name,
    subtitle: m.status === "available" ? m.tagline : (m.statusNote ?? m.tagline),
    href: `${STUDIO[m.kind] ?? "/image"}?model=${encodeURIComponent(m.id)}`,
    thumbUrl: null,
    createdAt: null,
    match,
    extra: { maker: m.vendor, kind: m.kind, status: m.status, badges: m.badges ?? [], featured: !!m.featured, capabilities: capabilities(m) },
  };
}

const modelOrder = new Map(models.map((m, i) => [m.id, m.featured ? i - models.length : i]));

function searchModels(q: string) {
  const out: SearchItem[] = [];
  for (const m of models) {
    const match = matchOf(q, m.name, [m.id, m.vendor, m.tagline, ...capabilities(m), ...(m.badges ?? [])]);
    if (match) out.push(modelItem(m, match));
  }
  return out;
}

/* ------------------------------- FTS5 index -------------------------------- */

const REBUILD_MS = 60_000;
const holder = globalThis as unknown as { __parallaxNotifyFts?: { ok: boolean; rebuiltAt: number } };

/** Creates the trigram index on first use. False when this SQLite has no FTS5 or no trigram tokenizer. */
function ftsReady(): boolean {
  if (!holder.__parallaxNotifyFts) {
    let ok = false;
    try {
      db().exec(
        "CREATE VIRTUAL TABLE IF NOT EXISTS notify_assets_fts USING fts5(title, prompt, content='assets', content_rowid='seq', tokenize='trigram')",
      );
      ok = true;
    } catch {
      ok = false;
    }
    holder.__parallaxNotifyFts = { ok, rebuiltAt: 0 };
  }
  const state = holder.__parallaxNotifyFts;
  if (!state.ok) return false;
  try {
    const now = Date.now();
    if (now - state.rebuiltAt > REBUILD_MS) {
      // A full rebuild picks up renamed and removed files; it runs at most once a minute.
      run("INSERT INTO notify_assets_fts(notify_assets_fts) VALUES ('rebuild')");
      state.rebuiltAt = now;
      run("INSERT OR REPLACE INTO notify_search_state (key, value) VALUES ('assets_seq', (SELECT COALESCE(MAX(seq), 0) FROM assets))");
    } else {
      const last = get<{ value: number }>("SELECT value FROM notify_search_state WHERE key = 'assets_seq'")?.value ?? 0;
      const max = get<{ m: number }>("SELECT COALESCE(MAX(seq), 0) AS m FROM assets")!.m;
      if (max > last) {
        run("INSERT INTO notify_assets_fts (rowid, title, prompt) SELECT seq, title, prompt FROM assets WHERE seq > ? AND seq <= ?", last, max);
        run("INSERT OR REPLACE INTO notify_search_state (key, value) VALUES ('assets_seq', ?)", max);
      }
    }
    return true;
  } catch (err) {
    console.error("[search] index unavailable, using LIKE:", (err as Error).message);
    state.ok = false;
    return false;
  }
}

export function searchEngine(): "fts5" | "like" {
  return ftsReady() ? "fts5" : "like";
}

type Hit = AssetRow & { owner_handle?: string; post_id?: string | null };

/** Asset rows matching `q` in title or prompt, newest first, under an extra filter. */
function assetCandidates(q: string, filter: string, params: Param[]): Hit[] {
  // A public file has at most one community post; its id is what the post page is opened by.
  const cols = "a.*, u.handle AS owner_handle, (SELECT p.id FROM community_posts p WHERE p.asset_id = a.id) AS post_id";
  if (q.length >= 3 && ftsReady()) {
    return all(
      `SELECT ${cols} FROM notify_assets_fts f JOIN assets a ON a.seq = f.rowid JOIN users u ON u.id = a.user_id
        WHERE notify_assets_fts MATCH ? AND a.deleted_at IS NULL AND ${filter} ORDER BY a.seq DESC LIMIT 200`,
      `"${q.replace(/"/g, '""')}"`, ...params,
    );
  }
  const like = `%${escapeLike(q)}%`;
  return all(
    `SELECT ${cols} FROM assets a JOIN users u ON u.id = a.user_id
      WHERE a.deleted_at IS NULL AND ${filter} AND (a.title LIKE ? ESCAPE '\\' OR a.prompt LIKE ? ESCAPE '\\')
      ORDER BY a.seq DESC LIMIT 200`,
    ...params, like, like,
  );
}

function assetItem(type: "files" | "posts", r: Hit, match: Match): SearchItem {
  const a = toAsset(r);
  const title = r.title || r.prompt.slice(0, 80) || "Untitled";
  return {
    type,
    id: r.id,
    title,
    subtitle: r.title ? r.prompt.slice(0, 120) : r.kind,
    href: type === "files" ? `/library?asset=${r.id}` : r.post_id ? `/community/post/${r.post_id}` : "/explore",
    thumbUrl: a.posterUrl ?? (a.kind === "image" ? a.url : null),
    createdAt: type === "posts" ? (r.published_at ?? r.created_at) : r.created_at,
    match,
    extra:
      type === "files"
        ? { kind: r.kind, source: r.source, folderId: r.folder_id, modelId: r.model_id, url: a.url, isPublic: a.isPublic }
        : { kind: r.kind, modelId: r.model_id, url: a.url, ownerHandle: r.owner_handle ?? null },
  };
}

function searchAssets(type: "files" | "posts", q: string, userId: string | null) {
  const rows = type === "files" ? assetCandidates(q, "a.user_id = ?", [userId!]) : assetCandidates(q, "a.is_public = 1", []);
  const out: SearchItem[] = [];
  for (const r of rows) {
    const match = matchOf(q, r.title, [r.prompt]);
    if (match) out.push(assetItem(type, r, match));
  }
  return out;
}

/* ------------------------------ jobs, folders ------------------------------ */

interface JobHit {
  id: string;
  kind: string;
  model_id: string;
  status: string;
  prompt: string;
  created_at: number;
}

function searchGenerations(q: string, userId: string) {
  const like = `%${escapeLike(q)}%`;
  const rows = all<JobHit>(
    `SELECT id, kind, model_id, status, prompt, created_at FROM jobs
      WHERE user_id = ? AND deleted_at IS NULL AND status != 'canceled' AND prompt LIKE ? ESCAPE '\\'
      ORDER BY seq DESC LIMIT 200`,
    userId, like,
  );
  const thumbs = assetsOfJobs(rows.filter((r) => r.status === "succeeded").slice(0, 40).map((r) => r.id));
  const out: SearchItem[] = [];
  for (const r of rows) {
    const match = matchOf(q, r.prompt);
    if (!match) continue;
    const first = thumbs.get(r.id)?.[0];
    const a = first ? toAsset(first) : null;
    out.push({
      type: "generations",
      id: r.id,
      title: r.prompt.slice(0, 120),
      subtitle: `${models.find((m) => m.id === r.model_id)?.name ?? r.model_id} · ${r.status}`,
      href: `/library?job=${r.id}`,
      thumbUrl: a ? (a.posterUrl ?? (a.kind === "image" ? a.url : null)) : null,
      createdAt: r.created_at,
      match,
      extra: { kind: r.kind, modelId: r.model_id, status: r.status },
    });
  }
  return out;
}

function searchFolders(q: string, userId: string) {
  const rows = all<{ id: string; name: string; created_at: number; n: number }>(
    `SELECT f.id, f.name, f.created_at,
            (SELECT COUNT(*) FROM assets a WHERE a.folder_id = f.id AND a.user_id = f.user_id AND a.deleted_at IS NULL) AS n
       FROM folders f WHERE f.user_id = ? AND f.name LIKE ? ESCAPE '\\' ORDER BY f.created_at DESC LIMIT 200`,
    userId, `%${escapeLike(q)}%`,
  );
  const out: SearchItem[] = [];
  for (const r of rows) {
    const match = matchOf(q, r.name);
    if (match) {
      out.push({
        type: "folders", id: r.id, title: r.name, subtitle: `${r.n} ${r.n === 1 ? "file" : "files"}`,
        href: `/library?folder=${r.id}`, thumbUrl: null, createdAt: r.created_at, match, extra: { fileCount: r.n },
      });
    }
  }
  return out;
}

/* ---------------------------------- entry ---------------------------------- */

export function search(userId: string | null, rawQuery: string, types: SearchType[], cap: number): SearchGroup[] {
  const q = rawQuery.trim().replace(/\s+/g, " ").toLowerCase();
  const groups: SearchGroup[] = [];
  for (const type of SEARCH_TYPES) {
    if (!types.includes(type)) continue;
    if (MEMBER_ONLY.includes(type) && !userId) continue;
    const found =
      type === "models" ? rankAndCap(searchModels(q), cap, modelOrder)
      : type === "files" ? rankAndCap(searchAssets("files", q, userId), cap)
      : type === "posts" ? rankAndCap(searchAssets("posts", q, userId), cap)
      : type === "generations" ? rankAndCap(searchGenerations(q, userId!), cap)
      : rankAndCap(searchFolders(q, userId!), cap);
    groups.push({ type, label: LABELS[type], ...found });
  }
  return groups;
}
