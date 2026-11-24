import "server-only";

import type { User } from "@/server/auth";
import { all, get, newId, run, tx } from "@/server/db";
import { ApiError, badRequest, notFound } from "@/server/errors";
import { authorOf, livePost } from "./posts";
import { DAY, decodeCursor, encodeCursor, nameOf, requireAccount, tell } from "./shared";

/** Likes, saves, views, comments and reports on posts. */

/* ------------------------------ likes & saves ----------------------------- */

type Reaction = "like" | "save";
const TABLE: Record<Reaction, { table: string; column: string }> = {
  like: { table: "community_likes", column: "like_count" },
  save: { table: "community_saves", column: "save_count" },
};

/** Idempotent: liking twice is still one like. Answers the new state and count. */
export function setReaction(user: User, postId: string, kind: Reaction, on: boolean): { active: boolean; count: number } {
  const post = livePost(postId);
  const { table, column } = TABLE[kind];
  let fresh = false;
  const result = tx(() => {
    const changed = on
      ? run(`INSERT OR IGNORE INTO ${table} (post_id, user_id, created_at) VALUES (?, ?, ?)`, post.id, user.id, Date.now()).changes
      : run(`DELETE FROM ${table} WHERE post_id = ? AND user_id = ?`, post.id, user.id).changes;
    if (changed) run(`UPDATE community_posts SET ${column} = MAX(0, ${column} + ?) WHERE id = ?`, on ? 1 : -1, post.id);
    fresh = on && Number(changed) > 0;
    const count = get<{ n: number }>(`SELECT ${column} AS n FROM community_posts WHERE id = ?`, post.id)!.n;
    return { active: on, count };
  });
  // The owner hears about a like, not about a save: saving is private.
  if (fresh && kind === "like") {
    tell(post.user_id, user, "like", `like:${post.id}:${user.id}`, {
      title: `${nameOf(user)} liked your post`,
      body: post.title,
      link: `/community/post/${post.id}`,
      data: { postId: post.id },
    });
  }
  return result;
}

/* ---------------------------------- views --------------------------------- */

/** Counts one view per viewer per post per day. */
export function recordView(viewer: string, postId: string): number {
  const post = livePost(postId);
  return tx(() => {
    const day = Math.floor(Date.now() / DAY);
    if (run("INSERT OR IGNORE INTO community_views (post_id, viewer, day) VALUES (?, ?, ?)", post.id, viewer, day).changes) {
      run("UPDATE community_posts SET view_count = view_count + 1 WHERE id = ?", post.id);
    }
    return get<{ n: number }>("SELECT view_count AS n FROM community_posts WHERE id = ?", post.id)!.n;
  });
}

/* -------------------------------- comments -------------------------------- */

export const COMMENT_MAX = 1000;

interface CommentRow {
  seq: number;
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  created_at: number;
  handle: string;
  name: string;
  avatar_asset_id: string | null;
  post_owner: string;
}

export interface Comment {
  id: string;
  postId: string;
  body: string;
  author: ReturnType<typeof authorOf>;
  createdAt: number;
  /** True when the viewer wrote it or owns the post. */
  canDelete: boolean;
}

const COMMENT_SELECT = `
  SELECT c.*, u.handle, u.name, u.avatar_asset_id, p.user_id AS post_owner
    FROM community_comments c
    JOIN users u ON u.id = c.user_id
    JOIN community_posts p ON p.id = c.post_id`;

function toComment(r: CommentRow, viewer: User | null): Comment {
  return {
    id: r.id,
    postId: r.post_id,
    body: r.body,
    author: authorOf(r),
    createdAt: r.created_at,
    canDelete: !!viewer && (viewer.id === r.user_id || viewer.id === r.post_owner),
  };
}

/** Oldest first, so a thread reads top to bottom. */
export function listComments(viewer: User | null, postId: string, limit: number, cursor: string | null): { comments: Comment[]; nextCursor: string | null } {
  const post = livePost(postId);
  const c = decodeCursor(cursor);
  const rows = all<CommentRow>(`${COMMENT_SELECT} WHERE c.post_id = ? AND c.seq > ? ORDER BY c.seq LIMIT ?`, post.id, c.s ?? 0, limit + 1);
  const page = rows.slice(0, limit);
  return { comments: page.map((r) => toComment(r, viewer)), nextCursor: rows.length > limit ? encodeCursor({ s: page[page.length - 1].seq }) : null };
}

export function addComment(user: User, postId: string, rawBody: unknown): Comment {
  requireAccount(user, "comment");
  if (typeof rawBody !== "string") throw badRequest("Write a comment first.");
  const body = rawBody.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!body) throw badRequest("Write a comment first.");
  if (body.length > COMMENT_MAX) throw badRequest(`Keep comments under ${COMMENT_MAX.toLocaleString("en-US")} characters.`);
  const post = livePost(postId);
  const id = newId("cmt");
  tx(() => {
    run("INSERT INTO community_comments (id, post_id, user_id, body, created_at) VALUES (?, ?, ?, ?, ?)", id, post.id, user.id, body, Date.now());
    run("UPDATE community_posts SET comment_count = comment_count + 1 WHERE id = ?", post.id);
  });
  tell(post.user_id, user, "comment", `comment:${id}`, {
    title: `${nameOf(user)} commented on your post`,
    body: body.slice(0, 200),
    link: `/community/post/${post.id}`,
    data: { postId: post.id, commentId: id },
  });
  return toComment(get<CommentRow>(`${COMMENT_SELECT} WHERE c.id = ?`, id)!, user);
}

/** The comment's author or the post's owner may delete it. */
export function deleteComment(user: User, id: string) {
  const row = get<CommentRow>(`${COMMENT_SELECT} WHERE c.id = ?`, id);
  if (!row) throw notFound("That comment does not exist.");
  if (row.user_id !== user.id && row.post_owner !== user.id) {
    throw new ApiError(403, "forbidden", "You can delete your own comments, and comments on your own posts.");
  }
  tx(() => {
    run("DELETE FROM community_comments WHERE id = ?", row.id);
    run("UPDATE community_posts SET comment_count = MAX(0, comment_count - 1) WHERE id = ?", row.post_id);
  });
}

/* --------------------------------- reports -------------------------------- */

export const REPORT_REASONS = ["spam", "nudity", "violence", "hate", "harassment", "copyright", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/**
 * Stores a report for a moderator. Reporting the same post again updates the reason.
 * The post also drops out of the reporter's own feeds.
 */
export function reportPost(user: User, postId: string, reason: unknown, rawNote: unknown) {
  requireAccount(user, "report posts");
  const why = REPORT_REASONS.find((r) => r === reason);
  if (!why) throw badRequest(`Pick a reason: ${REPORT_REASONS.join(", ")}.`);
  if (rawNote !== undefined && rawNote !== null && typeof rawNote !== "string") throw badRequest("The note must be text.");
  const note = (typeof rawNote === "string" ? rawNote : "").trim();
  if (note.length > 500) throw badRequest("Keep the note under 500 characters.");
  const post = livePost(postId);
  if (post.user_id === user.id) throw badRequest("You cannot report your own post.");
  run(
    `INSERT INTO community_reports (id, post_id, reporter_id, reason, note, created_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (post_id, reporter_id) DO UPDATE SET reason = excluded.reason, note = excluded.note`,
    newId("rpt"),
    post.id,
    user.id,
    why,
    note,
    Date.now(),
  );
}
