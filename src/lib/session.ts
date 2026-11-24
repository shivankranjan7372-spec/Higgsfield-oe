"use client";

import useSWR, { mutate } from "swr";
import { api, fetcher, type SessionUser } from "./api";

export interface Session {
  /** Null when nobody is signed in. A guest is a real account with `isGuest: true`. */
  user: SessionUser | null;
  /** Millicredits. Format with `formatCredits` from "@/config/economy". */
  balance: number;
}

const KEY = "/api/auth/me";

/**
 * Who is using the app. Pages are static shells, so this is read in the browser.
 * `member` is the signed-up person, or null for guests and signed-out visitors: use it to
 * decide between "Login" and the avatar.
 */
export function useSession() {
  const { data, isLoading } = useSWR<Session>(KEY, fetcher, { revalidateOnFocus: true, dedupingInterval: 2000 });
  const user = data?.user ?? null;
  return {
    user,
    member: user && !user.isGuest ? user : null,
    balance: data?.balance ?? 0,
    /** True until the first answer arrives. Draw the signed-out look while this is true. */
    loading: isLoading,
  };
}

/** Puts a fresh `{ user, balance }` (the answer of any auth call) on screen everywhere. */
export function setSession(next: Session): Promise<unknown> {
  return mutate(KEY, next, { revalidate: false });
}

/** Re-reads the session, for example after something spent credits. */
export function refreshSession(): Promise<unknown> {
  return mutate(KEY);
}

/** Updates only the balance, from the `balance` field most write calls return. */
export function setBalance(balance: number): Promise<unknown> {
  return mutate(KEY, (prev: Session | undefined) => (prev ? { ...prev, balance } : prev), { revalidate: false });
}

/**
 * Makes sure there is an account to work as: the signed-in one, or a new guest.
 * Call it before the first write a signed-out visitor makes (Generate, upload, like).
 */
export async function ensureSession(): Promise<Session> {
  const me = await api<Session>(KEY);
  if (me.user) return me;
  const guest = await api<Session>("/api/auth/guest", { method: "POST" });
  await setSession(guest);
  return guest;
}

export async function signUp(input: { email: string; password: string; name?: string }): Promise<Session> {
  const s = await api<Session>("/api/auth/signup", { method: "POST", body: input });
  await setSession(s);
  return s;
}

export async function logIn(input: { email: string; password: string }): Promise<Session> {
  const s = await api<Session>("/api/auth/login", { method: "POST", body: input });
  await setSession(s);
  return s;
}

export async function logOut(): Promise<void> {
  await api("/api/auth/logout", { method: "POST" });
  await setSession({ user: null, balance: 0 });
  // Drop everything cached for the account that just left.
  await mutate((key) => typeof key === "string" && key !== KEY, undefined, { revalidate: false });
}
