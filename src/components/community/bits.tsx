"use client";

import { CircleAlert } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { LoginDialog } from "@/components/entry/login-dialog";
import { communityWords as w } from "@/content/community";
import { routes } from "@/content/site";
import { ApiError, errorMessage } from "@/lib/api";
import { ensureSession, useSession } from "@/lib/session";
import { Button, cn } from "@/ui";
import type { Author } from "./types";

/** A round avatar; initials when there is no picture or it fails to load. */
export function Avatar({ author, size = 20, className }: { author: Pick<Author, "name" | "handle" | "avatarUrl">; size?: number; className?: string }) {
  const [broken, setBroken] = useState(false);
  const label = (author.name || author.handle || "?").trim();
  const initials = label
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center overflow-clip rounded-full bg-surface-elevated font-semibold text-text-primary select-none", className)}
      style={{ width: size, height: size, fontSize: Math.max(8, Math.round(size * 0.4)) }}
      aria-hidden
    >
      {author.avatarUrl && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={author.avatarUrl} alt="" className="size-full object-cover" onError={() => setBroken(true)} />
      ) : (
        initials
      )}
    </span>
  );
}

export function profileHref(handle: string) {
  return `${routes.profile}/${encodeURIComponent(handle)}`;
}

export function postHref(id: string) {
  return `${routes.post}/${id}`;
}

/** An author's name linking to their page. */
export function AuthorLink({ author, className }: { author: Author; className?: string }) {
  return (
    <Link href={profileHref(author.handle)} className={cn("truncate transition-colors duration-150 hover:text-text-primary", className)}>
      {author.name || author.handle}
    </Link>
  );
}

/** A quiet error line with a retry button. */
export function ErrorLine({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={cn("flex flex-wrap items-center gap-3 text-sm leading-5 text-danger", className)}>
      <CircleAlert className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
      <span className="min-w-0">{errorMessage(error)}</span>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {w.feed.retry}
        </Button>
      ) : null}
    </div>
  );
}

/** One line on what belongs here, and one button. */
export function EmptyState({ text, action, className }: { text: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-4 rounded-2xl border border-border-subtle px-6 py-16 text-center", className)}>
      <p className="max-w-[420px] text-sm leading-5 text-text-secondary">{text}</p>
      {action}
    </div>
  );
}

export type Need = "session" | "member";

/**
 * Runs writes for the visitor. `session` writes (like, save, hide) make a guest account
 * first; `member` writes ask a guest or visitor to create an account. Server answers of
 * 401/403 account_required also open the sign-in window.
 */
export function useGate() {
  const { user, member } = useSession();
  const [askOpen, setAskOpen] = useState(false);
  async function run<T>(need: Need, fn: () => Promise<T>): Promise<T | undefined> {
    if (need === "member" && !member) {
      setAskOpen(true);
      return undefined;
    }
    if (need === "session" && !user) await ensureSession();
    try {
      return await fn();
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.code === "account_required")) {
        setAskOpen(true);
        return undefined;
      }
      throw e;
    }
  }
  const dialog = <LoginDialog open={askOpen} onOpenChange={setAskOpen} mode="join" />;
  return { run, dialog, ask: () => setAskOpen(true), user, member };
}

/** A compact number, for counts. */
export function count(n: number) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function day(ms: number) {
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(new Date(ms));
}

/** "3h", "2d": how long ago, from useNow() seconds. */
export function ago(ms: number, now: number | null) {
  if (now === null) return "";
  const s = Math.max(0, now - Math.floor(ms / 1000));
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d`;
  return day(ms);
}
