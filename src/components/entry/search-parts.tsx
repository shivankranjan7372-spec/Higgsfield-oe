"use client";

import {
  ArrowUpRight,
  Bell,
  Clock,
  Compass,
  Folder,
  FolderOpen,
  Image as ImageIcon,
  LayoutGrid,
  LogIn,
  LogOut,
  Music,
  Sparkles,
  SquarePlay,
  Upload,
  UserRound,
  Users,
  Wallet,
  Wand2,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { VendorGlyph } from "@/components/brand/logo";
import type { SearchTab } from "@/content/entry";
import { api, fetcher } from "@/lib/api";
import { ensureSession, logOut, refreshSession } from "@/lib/session";
import { cn } from "@/ui";

/* ---- Shapes, from docs/api/notify.md ---- */

export type ResultType = "models" | "files" | "generations" | "folders" | "posts";

export interface ResultItem {
  type: ResultType;
  id: string;
  title: string;
  subtitle: string;
  href: string;
  thumbUrl: string | null;
  createdAt: number | null;
  match?: "prefix" | "word" | "contains" | "detail";
  extra: Record<string, unknown>;
}

export interface ResultGroup {
  type: ResultType;
  label: string;
  items: ResultItem[];
  more: boolean;
}

export interface SearchAnswer {
  query: string;
  groups: ResultGroup[];
  total: number;
}

export interface RecentSearch {
  id: string;
  query: string;
  createdAt: number;
}

export interface Suggestions {
  popularModels: ResultItem[];
  recentItems: ResultItem[];
  recentSearches: RecentSearch[];
}

export interface Command {
  id: string;
  type: "go" | "action";
  group: string;
  label: string;
  hint: string;
  href: string | null;
  api: { method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; path: string; body: unknown } | null;
  keywords: string[];
  shortcut: string | null;
}

export const commandGroupOrder = ["Go to", "Library", "Account", "Actions"];

/** The search answer for a query, a little after the member stops typing. */
export function useDebounced<T>(value: T, ms = 180): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return v;
}

export function searchKey(q: string, tab: SearchTab, limit: number): string | null {
  const t = q.trim();
  if (!t) return null;
  const types = tab === "all" ? "" : `&types=${tab}`;
  return `/api/search?q=${encodeURIComponent(t.slice(0, 100))}${types}&limit=${limit}`;
}

export function useSearch(q: string, tab: SearchTab, limit: number) {
  return useSWR<SearchAnswer>(searchKey(q, tab, limit), fetcher, { keepPreviousData: true, revalidateOnFocus: false });
}

/** Saves a query as a recent search. Quiet: a visitor without a session simply has none. */
export async function saveRecent(query: string, signedIn: boolean): Promise<void> {
  const q = query.trim().replace(/\s+/g, " ");
  if (!signedIn || !q) return;
  try {
    await api("/api/search/recent", { method: "POST", body: { query: q.slice(0, 100) } });
  } catch {
    /* not worth interrupting someone who is on the way to a result */
  }
}

/** Runs a palette entry. Returns the address to go to next, if any. */
export async function runCommand(cmd: Command): Promise<string | null> {
  if (cmd.type === "action" && cmd.api) {
    if (cmd.id === "sign-out") await logOut();
    else if (cmd.id === "try-as-guest") await ensureSession();
    else {
      await api(cmd.api.path, { method: cmd.api.method, body: cmd.api.body ?? undefined });
      await refreshSession();
    }
  }
  return cmd.href;
}

/* ---- Pieces ---- */

const typeIcon: Record<ResultType, LucideIcon> = {
  models: Sparkles,
  files: ImageIcon,
  generations: Wand2,
  folders: Folder,
  posts: Users,
};

export const tabIcon: Partial<Record<SearchTab, LucideIcon>> = typeIcon;

const commandIcon: Record<string, LucideIcon> = {
  "go-explore": Compass,
  "go-image": ImageIcon,
  "go-video": SquarePlay,
  "go-audio": Music,
  "go-apps": LayoutGrid,
  "go-library": FolderOpen,
  notifications: Bell,
  "notification-settings": Bell,
  wallet: Wallet,
  "whats-new": Sparkles,
  upload: Upload,
  "sign-out": LogOut,
  "sign-in": LogIn,
  "try-as-guest": UserRound,
};

export function iconForCommand(cmd: Command): LucideIcon {
  return commandIcon[cmd.id] ?? (cmd.group === "Library" ? FolderOpen : cmd.type === "action" ? Zap : ArrowUpRight);
}

/** The 44-pixel tile at the start of a row: a thumbnail, a maker's letter, or an icon. */
export function RowTile({ item, icon: Icon }: { item?: ResultItem; icon?: LucideIcon }) {
  const box = "flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-border-subtle text-text-primary";
  if (item?.thumbUrl) {
    return (
      <span className={box}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.thumbUrl} alt="" loading="lazy" className="size-full object-cover" />
      </span>
    );
  }
  if (item?.type === "models" && typeof item.extra.maker === "string") {
    return (
      <span className={box}>
        <VendorGlyph vendor={item.extra.maker} className="text-base leading-5" />
      </span>
    );
  }
  const I = Icon ?? (item ? typeIcon[item.type] : Clock);
  return (
    <span className={box}>
      <I className="size-5" strokeWidth={1.5} aria-hidden />
    </span>
  );
}

/** A 60-pixel result row: tile, title, second line. Highlighted while hovered or picked with the arrows. */
export function RowBody({ title, subtitle, tag, active }: { title: string; subtitle?: string; tag?: string | null; active?: boolean }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
      <span className="flex min-w-0 items-center gap-[6px]">
        <span className={cn("truncate text-sm leading-5 font-semibold", active ? "text-text-primary" : "text-[#FFFFFFE6]")}>{title}</span>
        {tag ? <NewBadge>{tag}</NewBadge> : null}
      </span>
      {subtitle ? <span className="truncate text-xs leading-[18px] text-text-tab">{subtitle}</span> : null}
    </span>
  );
}

export const rowClass = (active: boolean) =>
  cn(
    "flex h-[60px] w-full min-w-0 items-center gap-3 rounded-xl px-2 text-left transition-colors duration-150 hover:bg-border-subtle",
    active && "bg-border-subtle",
  );

export function NewBadge({ children }: { children: string }) {
  return (
    <span className="inline-flex h-4 shrink-0 items-center rounded-xs bg-brand px-[6px] font-display text-xs leading-4 font-bold text-ink uppercase">
      {children}
    </span>
  );
}

export function SectionLabel({ children, action }: { children: string; action?: React.ReactNode }) {
  return (
    <div className="flex h-[18px] items-center justify-between gap-4">
      <span className="text-xs leading-[18px] font-medium text-text-muted">{children}</span>
      {action}
    </div>
  );
}

/** A model's first badge, shown in lime the way the design marks new things. */
export function firstBadge(item: ResultItem): string | null {
  const b = item.extra.badges;
  return Array.isArray(b) && typeof b[0] === "string" ? b[0] : null;
}

/** Quiet rows in the shape of results, while the first answer is on its way. */
export function RowSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-1" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex h-[60px] items-center gap-3 px-2">
          <span className="shimmer size-11 rounded-lg bg-border-subtle" />
          <span className="flex flex-col gap-2">
            <span className="shimmer h-3 w-40 rounded-xs bg-border-subtle" />
            <span className="shimmer h-3 w-56 rounded-xs bg-border-subtle" />
          </span>
        </div>
      ))}
    </div>
  );
}
