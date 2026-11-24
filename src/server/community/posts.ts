import "server-only";

import { ownedAsset } from "@/server/assets";
import type { User } from "@/server/auth";
import { all, get, newId, parseJson, run, tx, type Param } from "@/server/db";
import { ApiError, badRequest, notFound } from "@/server/errors";
import { getJob } from "@/server/jobs";
import { getModel, type MediaType, type Values } from "@/registry";
import { DAY, HOUR, cleanTags, decodeCursor, encodeCursor, optionalText, requireAccount } from "./shared";

/**
 * Posts: a member's generated file, shown in public with a title, description and tags.
 * A post is visible while its row exists AND the asset is still public and not deleted,
 * so removing or un-publicising the file in the library also hides the post.
 */

export const TITLE_MAX = 120;
export const DESCRIPTION_MAX = 2000;

export interface PostRow {
  seq: number;
  id: string;
  asset_id: string;
  user_id: string;
  kind: MediaType;
  model_id: string | null;
  title: string;
  description: string;
  allow_recreate: number;
  like_count: number;
  save_count: number;
  comment_count: number;
  view_count: number;
  published_at: number;
  updated_at: number;
  // joined from assets
  mime: string;
  width: number | null;
  height: number | null;
  duration: number | null;
  poster_path: string | null;
  prompt: string;
  params: string;
  job_id: string | null;
  // joined from users
  handle: string;
  name: string;
  avatar_asset_id: string | null;
}

/** Every read of posts goes through this, so the visibility rule lives in one place. */
export const POST_SELECT = `
  SELECT p.*, a.mime, a.width, a.height, a.duration, a.poster_path, a.prompt, a.params, a.job_id,
         u.handle, u.name, u.avatar_asset_id
    FROM community_posts p
    JOIN assets a ON a.id = p.asset_id AND a.deleted_at IS NULL AND a.is_public = 1
    JOIN users u ON u.id = p.user_id`;

export interface Author {
  id: string;
  handle: string;
  name: string;
  avatarUrl: string | null;
}

export interface Post {
  id: string;
  kind: MediaType;
  media: { assetId: string; url: string; posterUrl: string | null; mime: string; width: number | null; height: number | null; duration: number | null };
  title: string;
  description: string;
  tags: string[];
  author: Author;
  model: { id: string; name: string } | null;
  allowRecreate: boolean;
  /** Only when the author allowed recreate, or the viewer is the author. */
  prompt: string | null;
  counts: { likes: number; saves: number; comments: number; views: number };
  /** Null when signed out. */
  viewer: { liked: boolean; saved: boolean; followingAuthor: boolean; isAuthor: boolean } | null;
  publishedAt: number;
  updatedAt: number;
}

export function authorOf(r: { user_id: string; handle: string; name: string; avatar_asset_id: string | null }): Author {
  return { id: r.user_id, handle: r.handle, name: r.name, avatarUrl: r.avatar_asset_id ? `/api/assets/${r.avatar_asset_id}/file` : null };
}

const marks = (n: number) => Array.from({ length: n }, () => "?").join(",");

/** Turns rows into API posts with tags and the viewer's own state, in three queries total. */
export function decorate(rows: PostRow[], viewer: User | null): Post[] {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const tags = new Map<string, string[]>();
  for (const t of all<{ post_id: string; tag: string }>(`SELECT post_id, tag FROM community_post_tags WHERE post_id IN (${marks(ids.length)}) ORDER BY tag`, ...ids)) {
    tags.set(t.post_id, [...(tags.get(t.post_id) ?? []), t.tag]);
  }
  let liked = new Set<string>();
  let saved = new Set<string>();
  let following = new Set<string>();
  if (viewer) {
    liked = new Set(all<{ post_id: string }>(`SELECT post_id FROM community_likes WHERE user_id = ? AND post_id IN (${marks(ids.length)})`, viewer.id, ...ids).map((r) => r.post_id));
    saved = new Set(all<{ post_id: string }>(`SELECT post_id FROM community_saves WHERE user_id = ? AND post_id IN (${marks(ids.length)})`, viewer.id, ...ids).map((r) => r.post_id));
    const authors = [...new Set(rows.map((r) => r.user_id))];
    following = new Set(
      all<{ followee_id: string }>(`SELECT followee_id FROM community_follows WHERE follower_id = ? AND followee_id IN (${marks(authors.length)})`, viewer.id, ...authors).map((r) => r.followee_id),
    );
  }
  return rows.map((r) => {
    const url = `/api/assets/${r.asset_id}/file`;
    const isAuthor = viewer?.id === r.user_id;
    const model = getModel(r.model_id);
    return {
      id: r.id,
      kind: r.kind,
      media: { assetId: r.asset_id, url, posterUrl: r.poster_path ? `${url}?poster=1` : null, mime: r.mime, width: r.width, height: r.height, duration: r.duration },
      title: r.title,
      description: r.description,
      tags: tags.get(r.id) ?? [],
      author: authorOf(r),
      model: r.model_id ? { id: r.model_id, name: model?.name ?? r.model_id } : null,
      allowRecreate: r.allow_recreate === 1,
      prompt: r.allow_recreate === 1 || isAuthor ? r.prompt : null,
      counts: { likes: r.like_count, saves: r.save_count, comments: r.comment_count, views: r.view_count },
      viewer: viewer ? { liked: liked.has(r.id), saved: saved.has(r.id), followingAuthor: following.has(r.user_id), isAuthor } : null,
      publishedAt: r.published_at,
      updatedAt: r.updated_at,
    };
  });
}

/** A post anyone may see, or a 404. */
export function livePost(id: string): PostRow {
  const row = get<PostRow>(`${POST_SELECT} WHERE p.id = ?`, id);
  if (!row) throw notFound("That post does not exist.");
  return row;
}

function ownedPost(userId: string, id: string): PostRow {
  const row = livePost(id);
  if (row.user_id !== userId) throw notFound("That post does not exist.");
  return row;
}

function setTags(postId: string, tags: string[]) {
  run("DELETE FROM community_post_tags WHERE post_id = ?", postId);
  for (const tag of tags) run("INSERT INTO community_post_tags (post_id, tag) VALUES (?, ?)", postId, tag);
}

/* --------------------------------- writing -------------------------------- */

export interface PublishInput {
  assetId?: unknown;
  title?: unknown;
  description?: unknown;
  tags?: unknown;
  allowRecreate?: unknown;
}

export function publish(user: User, input: PublishInput): Post {
  requireAccount(user, "publish");
  if (typeof input.assetId !== "string" || input.assetId.length > 80) throw badRequest("Pick a file to publish.");
  const title = optionalText(input.title, "title", TITLE_MAX) ?? "";
  const description = optionalText(input.description, "description", DESCRIPTION_MAX) ?? "";
  const tags = cleanTags(input.tags) ?? [];
  if (input.allowRecreate !== undefined && typeof input.allowRecreate !== "boolean") throw badRequest("Allow recreate must be true or false.");
  const asset = ownedAsset(user.id, input.assetId);
  if (asset.source !== "generated") throw badRequest("Only files you generated on Parallax can be published.");

  const id = newId("pst");
  tx(() => {
    if (get("SELECT 1 FROM community_posts WHERE asset_id = ?", asset.id)) throw new ApiError(409, "already_published", "That file is already published.");
    const now = Date.now();
    run(
      `INSERT INTO community_posts (id, asset_id, user_id, kind, model_id, title, description, allow_recreate, published_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      asset.id,
      user.id,
      asset.kind,
      asset.model_id,
      title || asset.title.slice(0, TITLE_MAX),
      description,
      input.allowRecreate === true ? 1 : 0,
      now,
      now,
    );
    setTags(id, tags);
    run("UPDATE assets SET is_public = 1, published_at = ? WHERE id = ?", now, asset.id);
  });
  return decorate([livePost(id)], user)[0];
}

export function editPost(user: User, id: string, input: PublishInput): Post {
  const row = ownedPost(user.id, id);
  const title = optionalText(input.title, "title", TITLE_MAX);
  const description = optionalText(input.description, "description", DESCRIPTION_MAX);
  const tags = cleanTags(input.tags);
  if (input.allowRecreate !== undefined && typeof input.allowRecreate !== "boolean") throw badRequest("Allow recreate must be true or false.");
  tx(() => {
    if (title !== undefined) run("UPDATE community_posts SET title = ? WHERE id = ?", title, row.id);
    if (description !== undefined) run("UPDATE community_posts SET description = ? WHERE id = ?", description, row.id);
    if (input.allowRecreate !== undefined) run("UPDATE community_posts SET allow_recreate = ? WHERE id = ?", input.allowRecreate ? 1 : 0, row.id);
    if (tags !== undefined) setTags(row.id, tags);
    run("UPDATE community_posts SET updated_at = ? WHERE id = ?", Date.now(), row.id);
  });
  return decorate([livePost(row.id)], user)[0];
}

/** Takes the post down and makes the file private again. Likes, comments and entries go with it. */
export function unpublish(user: User, id: string) {
  // Look the row up directly: a post whose file was already made private must still be removable.
  const row = get<{ id: string; asset_id: string }>("SELECT id, asset_id FROM community_posts WHERE id = ? AND user_id = ?", id, user.id);
  if (!row) throw notFound("That post does not exist.");
  tx(() => {
    run("DELETE FROM community_posts WHERE id = ?", row.id);
    run("UPDATE assets SET is_public = 0, published_at = NULL WHERE id = ? AND user_id = ?", row.asset_id, user.id);
  });
}

/* --------------------------------- reading -------------------------------- */

export type Tab = "trending" | "new" | "top" | "following";
export type Period = "day" | "week" | "month" | "all";
export const TABS: Tab[] = ["trending", "new", "top", "following"];
export const PERIODS: Period[] = ["day", "week", "month", "all"];
const PERIOD_MS: Record<Period, number> = { day: DAY, week: 7 * DAY, month: 30 * DAY, all: 0 };

/**
 * Trending score. Engagement over age, so a post rises with activity and sinks with time:
 *
 *   score = (1 + likes + 2*saves + 3*comments + views/20) / (ageHours + 2) ^ 1.5
 *
 * Saves and comments weigh more than likes because they take more intent. The +2 hours
 * keeps a brand-new post from dividing by almost nothing.
 */
export const TRENDING_SQL = `(1.0 + p.like_count + 2.0 * p.save_count + 3.0 * p.comment_count + p.view_count / 20.0)
  / pow(MAX(0, ? - p.published_at) / ${HOUR}.0 + 2.0, 1.5)`;

export interface FeedQuery {
  tab: Tab;
  period: Period;
  kind?: MediaType;
  modelId?: string;
  tag?: string;
  /** Only this member's posts (profile grid). */
  authorId?: string;
  limit: number;
  cursor: string | null;
}

export function listFeed(viewer: User | null, q: FeedQuery): { posts: Post[]; nextCursor: string | null } {
  const c = decodeCursor(q.cursor);
  const where: string[] = [];
  const params: Param[] = [];
  if (viewer && !q.authorId) {
    // The viewer's own filters: members they hid, and posts they reported.
    where.push("p.user_id NOT IN (SELECT hidden_user_id FROM community_hides WHERE user_id = ?)");
    where.push("p.id NOT IN (SELECT post_id FROM community_reports WHERE reporter_id = ?)");
    params.push(viewer.id, viewer.id);
  }
  if (q.tab === "following") {
    if (!viewer) throw new ApiError(401, "unauthorized", "Sign in to see posts from people you follow.");
    where.push("p.user_id IN (SELECT followee_id FROM community_follows WHERE follower_id = ?)");
    params.push(viewer.id);
  }
  if (q.authorId) (where.push("p.user_id = ?"), params.push(q.authorId));
  if (q.kind) (where.push("p.kind = ?"), params.push(q.kind));
  if (q.modelId) (where.push("p.model_id = ?"), params.push(q.modelId));
  if (q.tag) (where.push("p.id IN (SELECT post_id FROM community_post_tags WHERE tag = ?)"), params.push(q.tag));

  let rows: PostRow[];
  let next: string | null = null;
  if (q.tab === "new" || q.tab === "following") {
    if (c.s) (where.push("p.seq < ?"), params.push(c.s));
    rows = all<PostRow>(`${POST_SELECT} ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY p.seq DESC LIMIT ?`, ...params, q.limit + 1);
    if (rows.length > q.limit) {
      rows = rows.slice(0, q.limit);
      next = encodeCursor({ s: rows[rows.length - 1].seq });
    }
  } else {
    const now = c.t ?? Date.now();
    const offset = c.o ?? 0;
    let order: string;
    const orderParams: Param[] = [];
    if (q.tab === "top") {
      if (q.period !== "all") (where.push("p.published_at >= ?"), params.push(now - PERIOD_MS[q.period]));
      order = "p.like_count DESC, p.seq DESC";
    } else {
      order = `${TRENDING_SQL} DESC, p.seq DESC`;
      orderParams.push(now);
    }
    rows = all<PostRow>(
      `${POST_SELECT} ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY ${order} LIMIT ? OFFSET ?`,
      ...params,
      ...orderParams,
      q.limit + 1,
      offset,
    );
    if (rows.length > q.limit) {
      rows = rows.slice(0, q.limit);
      next = encodeCursor({ o: offset + q.limit, t: now });
    }
  }
  return { posts: decorate(rows, viewer), nextCursor: next };
}

export function getPost(viewer: User | null, id: string): Post {
  return decorate([livePost(id)], viewer)[0];
}

/** Members' posts the viewer saved, most recently saved first. */
export function listSaved(viewer: User, limit: number, cursor: string | null): { posts: Post[]; nextCursor: string | null } {
  const c = decodeCursor(cursor);
  const rows = all<PostRow & { saved_at: number }>(
    `${POST_SELECT.replace("SELECT p.*", "SELECT p.*, s.created_at AS saved_at")}
       JOIN community_saves s ON s.post_id = p.id AND s.user_id = ?
      WHERE s.created_at < ?
      ORDER BY s.created_at DESC LIMIT ?`,
    viewer.id,
    c.s ?? Number.MAX_SAFE_INTEGER,
    limit + 1,
  );
  const page = rows.slice(0, limit);
  return { posts: decorate(page, viewer), nextCursor: rows.length > limit ? encodeCursor({ s: page[page.length - 1].saved_at }) : null };
}

/** Most used tags on visible posts, for the filter chips. */
export function popularTags(limit: number): { tag: string; posts: number }[] {
  return all<{ tag: string; posts: number }>(
    `SELECT t.tag, COUNT(*) AS posts
       FROM community_post_tags t
       JOIN community_posts p ON p.id = t.post_id
       JOIN assets a ON a.id = p.asset_id AND a.deleted_at IS NULL AND a.is_public = 1
      GROUP BY t.tag ORDER BY posts DESC, t.tag LIMIT ?`,
    limit,
  );
}

/** Models that have at least one visible post, for the model filter. */
export function postedModels(): { id: string; name: string; posts: number }[] {
  return all<{ model_id: string; posts: number }>(
    `SELECT p.model_id, COUNT(*) AS posts
       FROM community_posts p
       JOIN assets a ON a.id = p.asset_id AND a.deleted_at IS NULL AND a.is_public = 1
      WHERE p.model_id IS NOT NULL
      GROUP BY p.model_id ORDER BY posts DESC`,
  )
    .filter((r) => getModel(r.model_id))
    .map((r) => ({ id: r.model_id, name: getModel(r.model_id)!.name, posts: r.posts }));
}

/* -------------------------------- recreate -------------------------------- */

export interface Recreate {
  modelId: string;
  prompt: string;
  values: Values;
  /** The original used reference files. They belong to the author and are not copied. */
  droppedInputs: boolean;
}

/** What to send to POST /api/jobs to make something like this post. */
export function recreate(viewer: User | null, id: string): Recreate {
  const row = livePost(id);
  const isAuthor = viewer?.id === row.user_id;
  if (row.allow_recreate !== 1 && !isAuthor) throw new ApiError(403, "recreate_off", "The author keeps the settings of this post private.");
  const model = getModel(row.model_id);
  if (!model) throw new ApiError(409, "model_unavailable", "The model behind this post is no longer offered.");
  if (model.status !== "available") throw new ApiError(409, "model_unavailable", model.statusNote ?? `${model.name} is not available right now.`);
  let droppedInputs = false;
  if (row.job_id) {
    try {
      droppedInputs = Object.values(getJob(row.user_id, row.job_id).inputs).some((list) => list.length > 0);
    } catch {
      /* the job was removed from history; nothing to report */
    }
  }
  return { modelId: model.id, prompt: row.prompt, values: parseJson<Values>(row.params, {}), droppedInputs };
}
