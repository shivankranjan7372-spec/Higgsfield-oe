import "server-only";

import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { GUEST_CREDITS, MILLI, SIGNUP_CREDITS } from "@/config/economy";
import { grant } from "./credits";
import { get, newId, run, tx } from "./db";

export const SESSION_COOKIE = "px_session";
const SESSION_DAYS = 30;
const DAY = 86_400_000;

export interface User {
  id: string;
  email: string | null;
  handle: string;
  name: string;
  isGuest: boolean;
  plan: string;
  avatarAssetId: string | null;
  bio: string;
  createdAt: number;
}

interface UserRow {
  id: string;
  email: string | null;
  handle: string;
  name: string;
  password_hash: string | null;
  is_guest: number;
  plan: string;
  avatar_asset_id: string | null;
  bio: string;
  created_at: number;
}

function toUser(r: UserRow): User {
  return {
    id: r.id,
    email: r.email,
    handle: r.handle,
    name: r.name,
    isGuest: r.is_guest === 1,
    plan: r.plan,
    avatarAssetId: r.avatar_asset_id,
    bio: r.bio,
    createdAt: r.created_at,
  };
}

/** What the browser may know about the signed-in member. */
export function publicUser(u: User) {
  return {
    id: u.id,
    email: u.email,
    handle: u.handle,
    name: u.name,
    isGuest: u.isGuest,
    plan: u.plan,
    avatarUrl: u.avatarAssetId ? `/api/assets/${u.avatarAssetId}/file` : null,
    bio: u.bio,
    createdAt: u.createdAt,
  };
}

/* ------------------------------- passwords -------------------------------- */

const SCRYPT = { N: 16384, r: 8, p: 1 };

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  return `s1$${salt.toString("base64")}$${scryptSync(password, salt, 64, SCRYPT).toString("base64")}`;
}

export function verifyPassword(password: string, stored: string | null): boolean {
  const [scheme, salt, hash] = (stored ?? "").split("$");
  // Hash even when there is no account, so timing does not reveal which emails exist.
  const expected = scheme === "s1" && hash ? Buffer.from(hash, "base64") : Buffer.alloc(64);
  const actual = scryptSync(password, salt ? Buffer.from(salt, "base64") : Buffer.alloc(16), 64, SCRYPT);
  return timingSafeEqual(actual, expected) && scheme === "s1";
}

/* -------------------------------- accounts -------------------------------- */

export class AccountError extends Error {}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanEmail(raw: unknown): string {
  const email = String(raw ?? "").trim().toLowerCase();
  if (email.length > 254 || !EMAIL.test(email)) throw new AccountError("Enter a valid email address.");
  return email;
}

function cleanPassword(raw: unknown): string {
  const password = String(raw ?? "");
  if (password.length < 8) throw new AccountError("Use at least 8 characters for the password.");
  if (password.length > 200) throw new AccountError("That password is too long.");
  return password;
}

function cleanName(raw: unknown, fallback: string): string {
  const name = String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
  return name || fallback;
}

function freeHandle(seed: string): string {
  const base = seed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 20) || "maker";
  for (let i = 0; i < 20; i++) {
    const handle = i === 0 ? base : `${base}-${randomBytes(2).toString("hex")}`;
    if (handle.length >= 3 && !get("SELECT 1 FROM users WHERE handle = ?", handle)) return handle;
  }
  return `${base}-${randomBytes(5).toString("hex")}`;
}

export function userById(id: string): User | null {
  const row = get<UserRow>("SELECT * FROM users WHERE id = ?", id);
  return row ? toUser(row) : null;
}

export function createGuest(): User {
  return tx(() => {
    const id = newId("usr");
    const tag = randomBytes(3).toString("hex");
    run("INSERT INTO users (id, handle, name, is_guest, created_at) VALUES (?, ?, ?, 1, ?)", id, `guest-${tag}`, "Guest", Date.now());
    grant(id, "grant", GUEST_CREDITS * MILLI, "Guest starter credits");
    return userById(id)!;
  });
}

/**
 * Creates an account. When `guest` is given, that guest account is upgraded in place,
 * so everything made as a guest is kept.
 */
export function signUp(input: { email: unknown; password: unknown; name?: unknown }, guest: User | null): User {
  const email = cleanEmail(input.email);
  const password = cleanPassword(input.password);
  const name = cleanName(input.name, email.split("@")[0]);
  return tx(() => {
    if (get("SELECT 1 FROM users WHERE email = ?", email)) throw new AccountError("An account with that email already exists.");
    const hash = hashPassword(password);
    if (guest?.isGuest) {
      run("UPDATE users SET email = ?, name = ?, handle = ?, password_hash = ?, is_guest = 0 WHERE id = ?", email, name, freeHandle(name), hash, guest.id);
      grant(guest.id, "grant", (SIGNUP_CREDITS - GUEST_CREDITS) * MILLI, "Welcome credits");
      return userById(guest.id)!;
    }
    const id = newId("usr");
    run("INSERT INTO users (id, email, handle, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)", id, email, freeHandle(name), name, hash, Date.now());
    grant(id, "grant", SIGNUP_CREDITS * MILLI, "Welcome credits");
    return userById(id)!;
  });
}

export function logIn(input: { email: unknown; password: unknown }): User {
  const email = String(input.email ?? "").trim().toLowerCase();
  const row = get<UserRow>("SELECT * FROM users WHERE email = ?", email);
  if (!verifyPassword(String(input.password ?? ""), row?.password_hash ?? null) || !row) {
    throw new AccountError("That email and password do not match.");
  }
  return toUser(row);
}

/* -------------------------------- sessions -------------------------------- */

/** How a session token is stored. The token itself is never written down. */
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

const SEEN_EVERY = 60_000;

export function userFromToken(token: string): User | null {
  const hash = hashToken(token);
  const now = Date.now();
  const row = get<UserRow & { seen_at: number | null }>(
    "SELECT u.*, s.last_seen_at AS seen_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?",
    hash,
    now,
  );
  if (!row) return null;
  // "Last active" for the sessions screen. One write a minute per session at most.
  if (now - (row.seen_at ?? 0) > SEEN_EVERY) run("UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?", now, hash);
  return toUser(row);
}

/**
 * Starts a session and sets the cookie. Only the token's hash is stored. The browser's
 * user-agent is kept so the member can tell their devices apart; no address is kept.
 */
export async function startSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  const hdrs = await headers();
  const agent = (hdrs.get("user-agent") ?? "").slice(0, 300) || null;
  const isHttps = process.env.COOKIE_SECURE === "1" || hdrs.get("x-forwarded-proto") === "https";
  run(
    "INSERT INTO sessions (token_hash, user_id, created_at, expires_at, user_agent, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)",
    hashToken(token),
    userId,
    now,
    now + SESSION_DAYS * DAY,
    agent,
    now,
  );
  run("DELETE FROM sessions WHERE expires_at < ?", now);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: isHttps ? "none" : "lax",
    secure: isHttps,
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}

export async function endSession() {
  const jar = await cookies();
  const hdrs = await headers();
  const isHttps = process.env.COOKIE_SECURE === "1" || hdrs.get("x-forwarded-proto") === "https";
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) run("DELETE FROM sessions WHERE token_hash = ?", hashToken(token));
  jar.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: isHttps ? "none" : "lax",
    secure: isHttps,
    path: "/",
    maxAge: 0,
  });
}
