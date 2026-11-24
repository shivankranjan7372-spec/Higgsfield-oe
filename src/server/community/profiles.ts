import "server-only";

import type { User } from "@/server/auth";
import { all, get, run } from "@/server/db";
import { badRequest, notFound } from "@/server/errors";
import { authorOf, type Author } from "./posts";
import { decodeCursor, encodeCursor, nameOf, requireAccount, tell } from "./shared";

/** Public profiles, follows and hides. Guest accounts have no public profile. */

interface ProfileRow {
  id: string;
  handle: string;
  name: string;
  bio: string;
  avatar_asset_id: string | null;
  created_at: number;
}

export interface Profile {
  id: string;
  handle: string;
  name: string;
  bio: string;
  avatarUrl: string | null;
  joinedAt: number;
  counts: { posts: number; followers: number; following: number; likes: number; views: number };
  /** Null when signed out. */
  viewer: { isSelf: boolean; following: boolean; followsYou: boolean; hidden: boolean } | null;
}

/** A full (non-guest) member by handle, or a 404. */
export function memberByHandle(handle: string): ProfileRow {
  const clean = handle.trim().toLowerCase().replace(/^@/, "");
  const row = clean.length <= 40 ? get<ProfileRow>("SELECT id, handle, name, bio, avatar_asset_id, created_at FROM users WHERE handle = ? AND is_guest = 0", clean) : undefined;
  if (!row) throw notFound("That member does not exist.");
  return row;
}

export function getProfile(viewer: User | null, handle: string): Profile {
  const u = memberByHandle(handle);
  const stats = get<{ posts: number; likes: number; views: number }>(
    `SELECT COUNT(*) AS posts, COALESCE(SUM(p.like_count), 0) AS likes, COALESCE(SUM(p.view_count), 0) AS views
       FROM community_posts p JOIN assets a ON a.id = p.asset_id AND a.deleted_at IS NULL AND a.is_public = 1
      WHERE p.user_id = ?`,
    u.id,
  )!;
  const followers = get<{ n: number }>("SELECT COUNT(*) AS n FROM community_follows WHERE followee_id = ?", u.id)!.n;
  const following = get<{ n: number }>("SELECT COUNT(*) AS n FROM community_follows WHERE follower_id = ?", u.id)!.n;
  return {
    id: u.id,
    handle: u.handle,
    name: u.name,
    bio: u.bio,
    avatarUrl: u.avatar_asset_id ? `/api/assets/${u.avatar_asset_id}/file` : null,
    joinedAt: u.created_at,
    counts: { posts: stats.posts, followers, following, likes: stats.likes, views: stats.views },
    viewer: viewer
      ? {
          isSelf: viewer.id === u.id,
          following: !!get("SELECT 1 FROM community_follows WHERE follower_id = ? AND followee_id = ?", viewer.id, u.id),
          followsYou: !!get("SELECT 1 FROM community_follows WHERE follower_id = ? AND followee_id = ?", u.id, viewer.id),
          hidden: !!get("SELECT 1 FROM community_hides WHERE user_id = ? AND hidden_user_id = ?", viewer.id, u.id),
        }
      : null,
  };
}

/* --------------------------------- follows -------------------------------- */

export function setFollow(user: User, handle: string, on: boolean): { following: boolean; followers: number } {
  requireAccount(user, "follow people");
  const target = memberByHandle(handle);
  if (target.id === user.id) throw badRequest("You cannot follow yourself.");
  if (on) {
    const added = run("INSERT OR IGNORE INTO community_follows (follower_id, followee_id, created_at) VALUES (?, ?, ?)", user.id, target.id, Date.now()).changes;
    if (Number(added) > 0) {
      tell(target.id, user, "follow", `follow:${target.id}:${user.id}`, { title: `${nameOf(user)} followed you`, link: `/u/${user.handle}` });
    }
  } else run("DELETE FROM community_follows WHERE follower_id = ? AND followee_id = ?", user.id, target.id);
  const followers = get<{ n: number }>("SELECT COUNT(*) AS n FROM community_follows WHERE followee_id = ?", target.id)!.n;
  return { following: on, followers };
}

/** Followers of a member, or the members they follow. Newest first. Guests are left out. */
export function listFollows(handle: string, which: "followers" | "following", limit: number, cursor: string | null): { members: Author[]; nextCursor: string | null } {
  const u = memberByHandle(handle);
  const c = decodeCursor(cursor);
  const [me, them] = which === "followers" ? ["followee_id", "follower_id"] : ["follower_id", "followee_id"];
  const rows = all<{ user_id: string; handle: string; name: string; avatar_asset_id: string | null; created_at: number }>(
    `SELECT u.id AS user_id, u.handle, u.name, u.avatar_asset_id, f.created_at
       FROM community_follows f JOIN users u ON u.id = f.${them} AND u.is_guest = 0
      WHERE f.${me} = ? AND f.created_at < ?
      ORDER BY f.created_at DESC LIMIT ?`,
    u.id,
    c.s ?? Number.MAX_SAFE_INTEGER,
    limit + 1,
  );
  const page = rows.slice(0, limit);
  return { members: page.map(authorOf), nextCursor: rows.length > limit ? encodeCursor({ s: page[page.length - 1].created_at }) : null };
}

/* ---------------------------------- hides --------------------------------- */

/** Hides (or shows again) a member's posts in the viewer's own feeds. Nobody else is told. */
export function setHidden(user: User, handle: string, on: boolean): { hidden: boolean } {
  const target = memberByHandle(handle);
  if (target.id === user.id) throw badRequest("You cannot hide your own posts.");
  if (on) run("INSERT OR IGNORE INTO community_hides (user_id, hidden_user_id, created_at) VALUES (?, ?, ?)", user.id, target.id, Date.now());
  else run("DELETE FROM community_hides WHERE user_id = ? AND hidden_user_id = ?", user.id, target.id);
  return { hidden: on };
}

export function listHidden(user: User): Author[] {
  return all<{ user_id: string; handle: string; name: string; avatar_asset_id: string | null }>(
    `SELECT u.id AS user_id, u.handle, u.name, u.avatar_asset_id
       FROM community_hides h JOIN users u ON u.id = h.hidden_user_id
      WHERE h.user_id = ? ORDER BY h.created_at DESC`,
    user.id,
  ).map(authorOf);
}
