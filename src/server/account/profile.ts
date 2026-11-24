import "server-only";

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { ownedAsset } from "@/server/assets";
import { hashPassword, hashToken, userById, verifyPassword, type User } from "@/server/auth";
import { all, dataDir, get, run, tx } from "@/server/db";
import { ApiError, badRequest, notFound } from "@/server/errors";

/** Profile, sign-in details, sessions and account deletion. */

/* --------------------------------- profile -------------------------------- */

const HANDLE = /^[a-z0-9](?:[a-z0-9_-]{1,28})[a-z0-9]$/;
// Handles that would look official or collide with app paths.
const RESERVED = new Set([
  "admin", "administrator", "api", "app", "account", "billing", "help", "support", "parallax", "staff", "team", "root",
  "settings", "login", "logout", "signup", "guest", "me", "explore", "library", "pricing", "about", "system", "official", "null", "undefined",
]);

export interface ProfilePatch {
  name?: unknown;
  handle?: unknown;
  bio?: unknown;
  avatarAssetId?: unknown;
}

export function cleanHandle(raw: unknown): string {
  if (typeof raw !== "string") throw badRequest("Pick a handle.");
  const handle = raw.trim().replace(/^@/, "").toLowerCase();
  if (handle.length < 3 || handle.length > 30) throw badRequest("A handle is 3 to 30 characters long.");
  if (!HANDLE.test(handle) || /[-_]{2}/.test(handle)) {
    throw badRequest("Use letters, numbers, - and _ in the handle. It must start and end with a letter or number.");
  }
  if (RESERVED.has(handle) || handle.startsWith("guest-")) throw new ApiError(409, "handle_taken", "That handle is not available.");
  return handle;
}

export function updateProfile(user: User, patch: ProfilePatch): User {
  const sets: string[] = [];
  const values: (string | null)[] = [];
  if (patch.name !== undefined) {
    if (typeof patch.name !== "string") throw badRequest("Enter a name.");
    const name = patch.name.replace(/\s+/g, " ").trim();
    if (!name) throw badRequest("Enter a name.");
    if (name.length > 60) throw badRequest("Keep the name under 60 characters.");
    sets.push("name = ?");
    values.push(name);
  }
  if (patch.bio !== undefined) {
    if (typeof patch.bio !== "string") throw badRequest("The bio must be text.");
    const bio = patch.bio.replace(/\r\n/g, "\n").trim();
    if (bio.length > 300) throw badRequest("Keep the bio under 300 characters.");
    sets.push("bio = ?");
    values.push(bio);
  }
  if (patch.avatarAssetId !== undefined) {
    if (patch.avatarAssetId === null) {
      values.push(null);
    } else {
      if (typeof patch.avatarAssetId !== "string" || patch.avatarAssetId.length > 64) throw badRequest("Pick one of your images.");
      const asset = ownedAsset(user.id, patch.avatarAssetId);
      if (asset.deleted_at) throw notFound("That file does not exist.");
      if (asset.kind !== "image") throw badRequest("Your picture has to be an image.");
      values.push(asset.id);
    }
    sets.push("avatar_asset_id = ?");
  }
  let handle: string | null = null;
  if (patch.handle !== undefined) {
    handle = cleanHandle(patch.handle);
    if (handle !== user.handle) {
      sets.push("handle = ?");
      values.push(handle);
    } else handle = null;
  }
  if (!sets.length) return user;
  return tx(() => {
    if (handle && get("SELECT 1 FROM users WHERE handle = ? AND id != ?", handle, user.id)) {
      throw new ApiError(409, "handle_taken", "That handle is taken. Try another.");
    }
    run(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`, ...values, user.id);
    return userById(user.id)!;
  });
}

/** For a "is this handle free?" check while typing. */
export function handleAvailable(user: User, raw: unknown): { handle: string; available: boolean; message: string | null } {
  try {
    const handle = cleanHandle(raw);
    const taken = !!get("SELECT 1 FROM users WHERE handle = ? AND id != ?", handle, user.id);
    return { handle, available: !taken, message: taken ? "That handle is taken. Try another." : null };
  } catch (err) {
    if (err instanceof ApiError) return { handle: String(raw ?? ""), available: false, message: err.message };
    throw err;
  }
}

/* -------------------------------- sign-in --------------------------------- */

function passwordHash(userId: string): string | null {
  return get<{ password_hash: string | null }>("SELECT password_hash FROM users WHERE id = ?", userId)?.password_hash ?? null;
}

function requirePassword(user: User, password: unknown) {
  if (typeof password !== "string" || !password) throw badRequest("Enter your current password.");
  if (password.length > 200 || !verifyPassword(password, passwordHash(user.id))) {
    throw new ApiError(403, "wrong_password", "That password is not right.");
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function changeEmail(user: User, input: { email: unknown; password: unknown }): User {
  if (user.isGuest) throw new ApiError(409, "guest_account", "Create an account first, then you can set an email.");
  if (typeof input.email !== "string") throw badRequest("Enter a valid email address.");
  const email = input.email.trim().toLowerCase();
  if (email.length > 254 || !EMAIL.test(email)) throw badRequest("Enter a valid email address.");
  requirePassword(user, input.password);
  if (email === user.email) throw new ApiError(409, "already_current", "That is already your email.");
  return tx(() => {
    if (get("SELECT 1 FROM users WHERE email = ? AND id != ?", email, user.id)) throw new ApiError(409, "email_taken", "Another account already uses that email.");
    run("UPDATE users SET email = ? WHERE id = ?", email, user.id);
    return userById(user.id)!;
  });
}

/** Changes the password and signs out every other session. Returns how many were signed out. */
export function changePassword(user: User, input: { currentPassword: unknown; newPassword: unknown }, currentToken: string | undefined): number {
  if (user.isGuest) throw new ApiError(409, "guest_account", "Create an account first, then you can set a password.");
  requirePassword(user, input.currentPassword);
  if (typeof input.newPassword !== "string" || input.newPassword.length < 8) throw badRequest("Use at least 8 characters for the new password.");
  if (input.newPassword.length > 200) throw badRequest("That password is too long.");
  if (input.newPassword === input.currentPassword) throw badRequest("Choose a password you are not using now.");
  const hash = hashPassword(input.newPassword);
  return tx(() => {
    run("UPDATE users SET password_hash = ? WHERE id = ?", hash, user.id);
    return signOutOthers(user.id, currentToken);
  });
}

/* -------------------------------- sessions -------------------------------- */

export const tokenHash = hashToken;
// The browser never sees the stored hash, only a short id derived from it.
const sessionId = (hash: string) => "ses_" + createHash("sha256").update("session-id:" + hash).digest("hex").slice(0, 20);

interface SessionRow {
  token_hash: string;
  created_at: number;
  expires_at: number;
  user_agent: string | null;
  last_seen_at: number | null;
}

export interface SessionView {
  id: string;
  current: boolean;
  createdAt: number;
  expiresAt: number;
  /** "Chrome on macOS". Empty when the browser did not say. */
  device: string;
  lastSeenAt: number;
}

const BROWSERS: [RegExp, string][] = [
  [/Edg(?:e|A|iOS)?\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/Firefox\/|FxiOS\//, "Firefox"],
  [/Chrome\/|CriOS\//, "Chrome"],
  [/Safari\//, "Safari"],
];
const SYSTEMS: [RegExp, string][] = [
  [/iPhone|iPad|iPod/, "iOS"],
  [/Android/, "Android"],
  [/Windows/, "Windows"],
  [/CrOS/, "ChromeOS"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/Linux/, "Linux"],
];

/** A short, readable name for a browser's user-agent. Order matters: most browsers also say "Safari". */
export function deviceLabel(agent: string | null): string {
  if (!agent) return "";
  const browser = BROWSERS.find(([re]) => re.test(agent))?.[1];
  const system = SYSTEMS.find(([re]) => re.test(agent))?.[1];
  if (browser && system) return `${browser} on ${system}`;
  return browser ?? system ?? "";
}

export function listSessions(userId: string, currentToken: string | undefined): SessionView[] {
  const current = currentToken ? tokenHash(currentToken) : null;
  return all<SessionRow>("SELECT * FROM sessions WHERE user_id = ? AND expires_at > ? ORDER BY created_at DESC", userId, Date.now()).map((s) => ({
    id: sessionId(s.token_hash),
    current: s.token_hash === current,
    createdAt: s.created_at,
    expiresAt: s.expires_at,
    device: deviceLabel(s.user_agent),
    lastSeenAt: s.last_seen_at ?? s.created_at,
  }));
}

export function revokeSession(userId: string, id: string, currentToken: string | undefined) {
  const rows = all<SessionRow>("SELECT * FROM sessions WHERE user_id = ?", userId);
  const hit = rows.find((r) => sessionId(r.token_hash) === id);
  if (!hit) throw notFound("That session does not exist.");
  if (currentToken && hit.token_hash === tokenHash(currentToken)) {
    throw badRequest("This is the session you are using. Sign out instead.");
  }
  run("DELETE FROM sessions WHERE token_hash = ? AND user_id = ?", hit.token_hash, userId);
}

export function signOutOthers(userId: string, currentToken: string | undefined): number {
  const keep = currentToken ? tokenHash(currentToken) : "";
  return run("DELETE FROM sessions WHERE user_id = ? AND token_hash != ?", userId, keep).changes;
}

/* --------------------------------- delete --------------------------------- */

/**
 * Removes the member and everything that points at them. Core tables and ours cascade
 * from users; files on disk live under data/assets/<userId>/.
 */
export function deleteAccount(user: User, input: { password: unknown; confirm: unknown }) {
  if (input.confirm !== "DELETE") throw badRequest('Type DELETE to confirm.');
  if (!user.isGuest) requirePassword(user, input.password);
  try {
    tx(() => {
      run("DELETE FROM sessions WHERE user_id = ?", user.id);
      run("DELETE FROM users WHERE id = ?", user.id);
    });
  } catch (err) {
    console.error("[account] delete failed:", err instanceof Error ? err.message : err);
    throw new ApiError(500, "delete_failed", "We could not delete your account right now. Nothing was removed. Try again later.");
  }
  // userId comes from the database, never from input; still make sure it stays inside the data dir.
  const root = path.join(dataDir(), "assets");
  const dir = path.join(root, user.id);
  if (path.dirname(dir) === root) fs.rm(dir, { recursive: true, force: true }, () => {});
}
