import "server-only";

import type { User } from "@/server/auth";
import { all, get, parseJson, run, tx } from "@/server/db";
import { ApiError, badRequest, notFound } from "@/server/errors";
import type { MediaType } from "@/registry";
import { POST_SELECT, decorate, livePost, type Post, type PostRow } from "./posts";
import { decodeCursor, encodeCursor, requireAccount } from "./shared";

/**
 * Contests: a theme and a window. Members enter one of their published posts,
 * other members vote (once per entry), and the leaderboard ranks entries by votes.
 */

export type Phase = "upcoming" | "open" | "voting" | "ended";

interface ContestRow {
  id: string;
  slug: string;
  title: string;
  summary: string;
  brief: string;
  rules: string;
  kind: MediaType | null;
  prize: string;
  opens_at: number;
  closes_at: number;
  ends_at: number;
}

export interface Contest {
  id: string;
  slug: string;
  title: string;
  summary: string;
  brief: string;
  rules: string[];
  /** The only kind of file accepted, or null for any. */
  kind: MediaType | null;
  prize: string;
  phase: Phase;
  canEnter: boolean;
  canVote: boolean;
  opensAt: number;
  closesAt: number;
  endsAt: number;
  entries: number;
  /** Null when signed out. `entryPostId` is the viewer's own entry, if any. */
  viewer: { entryPostId: string | null } | null;
}

export function phaseOf(r: ContestRow, now = Date.now()): Phase {
  if (now < r.opens_at) return "upcoming";
  if (now < r.closes_at) return "open";
  if (now < r.ends_at) return "voting";
  return "ended";
}

function toContest(r: ContestRow, viewer: User | null): Contest {
  const phase = phaseOf(r);
  const entries = get<{ n: number }>("SELECT COUNT(*) AS n FROM community_contest_entries WHERE contest_id = ?", r.id)!.n;
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    summary: r.summary,
    brief: r.brief,
    rules: parseJson<string[]>(r.rules, []),
    kind: r.kind,
    prize: r.prize,
    phase,
    canEnter: phase === "open",
    canVote: phase === "open" || phase === "voting",
    opensAt: r.opens_at,
    closesAt: r.closes_at,
    endsAt: r.ends_at,
    entries,
    viewer: viewer
      ? { entryPostId: get<{ post_id: string }>("SELECT post_id FROM community_contest_entries WHERE contest_id = ? AND user_id = ?", r.id, viewer.id)?.post_id ?? null }
      : null,
  };
}

const PHASE_ORDER: Record<Phase, number> = { open: 0, voting: 1, upcoming: 2, ended: 3 };

/** Running contests first, then upcoming, then past ones. */
export function listContests(viewer: User | null): Contest[] {
  return all<ContestRow>("SELECT * FROM community_contests ORDER BY opens_at DESC")
    .map((r) => toContest(r, viewer))
    .sort((a, b) => PHASE_ORDER[a.phase] - PHASE_ORDER[b.phase] || (a.phase === "ended" ? b.endsAt - a.endsAt : a.closesAt - b.closesAt));
}

function contestBySlug(slug: string): ContestRow {
  const row = slug.length <= 80 ? get<ContestRow>("SELECT * FROM community_contests WHERE slug = ?", slug) : undefined;
  if (!row) throw notFound("That contest does not exist.");
  return row;
}

export function getContest(viewer: User | null, slug: string): Contest {
  return toContest(contestBySlug(slug), viewer);
}

/* --------------------------------- entries -------------------------------- */

export interface Entry {
  rank: number;
  votes: number;
  enteredAt: number;
  /** Null when signed out. */
  viewer: { voted: boolean } | null;
  post: Post;
}

/** `top` is the leaderboard (most votes, earliest entry wins a tie). `new` is newest first. */
export function listEntries(viewer: User | null, slug: string, sort: "top" | "new", limit: number, cursor: string | null): { entries: Entry[]; nextCursor: string | null } {
  const contest = contestBySlug(slug);
  const offset = decodeCursor(cursor).o ?? 0;
  const order = sort === "top" ? "e.vote_count DESC, e.created_at ASC" : "e.created_at DESC";
  const rows = all<PostRow & { vote_count: number; entered_at: number }>(
    `${POST_SELECT.replace("SELECT p.*", "SELECT p.*, e.vote_count, e.created_at AS entered_at")}
       JOIN community_contest_entries e ON e.post_id = p.id AND e.contest_id = ?
      ORDER BY ${order} LIMIT ? OFFSET ?`,
    contest.id,
    limit + 1,
    offset,
  );
  const page = rows.slice(0, limit);
  const posts = decorate(page, viewer);
  const voted = viewer
    ? new Set(all<{ post_id: string }>("SELECT post_id FROM community_contest_votes WHERE contest_id = ? AND user_id = ?", contest.id, viewer.id).map((r) => r.post_id))
    : null;
  return {
    entries: page.map((r, i) => ({
      // Rank is the place on the leaderboard; on the `new` sort it is still the vote rank.
      rank: sort === "top" ? offset + i + 1 : rankOf(contest.id, r.vote_count, r.entered_at),
      votes: r.vote_count,
      enteredAt: r.entered_at,
      viewer: voted ? { voted: voted.has(r.id) } : null,
      post: posts[i],
    })),
    nextCursor: rows.length > limit ? encodeCursor({ o: offset + limit }) : null,
  };
}

function rankOf(contestId: string, votes: number, enteredAt: number): number {
  return (
    get<{ n: number }>(
      "SELECT COUNT(*) AS n FROM community_contest_entries WHERE contest_id = ? AND (vote_count > ? OR (vote_count = ? AND created_at < ?))",
      contestId,
      votes,
      votes,
      enteredAt,
    )!.n + 1
  );
}

export function enter(user: User, slug: string, postId: unknown): Contest {
  requireAccount(user, "enter contests");
  if (typeof postId !== "string" || postId.length > 80) throw badRequest("Pick one of your posts to enter.");
  const contest = contestBySlug(slug);
  const phase = phaseOf(contest);
  if (phase !== "open") throw new ApiError(409, "contest_closed", phase === "upcoming" ? "This contest has not opened yet." : "Entries for this contest are closed.");
  const post = livePost(postId);
  if (post.user_id !== user.id) throw notFound("That post does not exist.");
  if (contest.kind && post.kind !== contest.kind) throw badRequest(`This contest takes ${contest.kind === "image" ? "images" : contest.kind === "video" ? "videos" : "audio"} only.`);
  tx(() => {
    if (get("SELECT 1 FROM community_contest_entries WHERE contest_id = ? AND user_id = ?", contest.id, user.id)) {
      throw new ApiError(409, "already_entered", "You already have an entry in this contest. Withdraw it first to enter a different post.");
    }
    run("INSERT INTO community_contest_entries (contest_id, post_id, user_id, created_at) VALUES (?, ?, ?, ?)", contest.id, post.id, user.id, Date.now());
  });
  return toContest(contest, user);
}

/** Withdraws the member's own entry while the contest is still taking entries. Its votes go with it. */
export function withdraw(user: User, slug: string, postId: string) {
  const contest = contestBySlug(slug);
  const entry = get("SELECT 1 FROM community_contest_entries WHERE contest_id = ? AND post_id = ? AND user_id = ?", contest.id, postId, user.id);
  if (!entry) throw notFound("That entry does not exist.");
  if (phaseOf(contest) !== "open") throw new ApiError(409, "contest_closed", "Entries can only be withdrawn while the contest is open.");
  run("DELETE FROM community_contest_entries WHERE contest_id = ? AND post_id = ?", contest.id, postId);
}

/* ---------------------------------- votes --------------------------------- */

/** One vote per member per entry. Voting again is harmless; removing a vote is allowed while voting runs. */
export function setVote(user: User, slug: string, postId: string, on: boolean): { voted: boolean; votes: number } {
  requireAccount(user, "vote");
  const contest = contestBySlug(slug);
  const entry = get<{ user_id: string }>("SELECT user_id FROM community_contest_entries WHERE contest_id = ? AND post_id = ?", contest.id, postId);
  if (!entry) throw notFound("That entry does not exist.");
  const phase = phaseOf(contest);
  if (phase !== "open" && phase !== "voting") throw new ApiError(409, "contest_closed", "Voting for this contest is closed.");
  if (entry.user_id === user.id) throw badRequest("You cannot vote for your own entry.");
  return tx(() => {
    const changed = on
      ? run("INSERT OR IGNORE INTO community_contest_votes (contest_id, post_id, user_id, created_at) VALUES (?, ?, ?, ?)", contest.id, postId, user.id, Date.now()).changes
      : run("DELETE FROM community_contest_votes WHERE contest_id = ? AND post_id = ? AND user_id = ?", contest.id, postId, user.id).changes;
    if (changed) run("UPDATE community_contest_entries SET vote_count = MAX(0, vote_count + ?) WHERE contest_id = ? AND post_id = ?", on ? 1 : -1, contest.id, postId);
    const votes = get<{ n: number }>("SELECT vote_count AS n FROM community_contest_entries WHERE contest_id = ? AND post_id = ?", contest.id, postId)!.n;
    return { voted: on, votes };
  });
}
