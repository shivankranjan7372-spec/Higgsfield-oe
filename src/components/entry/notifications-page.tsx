"use client";

import { AlertTriangle, Bell, CheckCheck, CheckCircle2, Coins, Heart, Lock, Megaphone, MessageCircle, ShieldCheck, Sparkles, Trash2, UserPlus, Crown, Circle, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import useSWR from "swr";
import useSWRInfinite from "swr/infinite";
import { notifyCopy as c } from "@/content/entry";
import { routes } from "@/content/site";
import { api, errorMessage, fetcher } from "@/lib/api";
import { useNow } from "@/lib/browser";
import { STREAM_DOWN, notificationStream, useLiveStream } from "@/lib/live";
import { useSession } from "@/lib/session";
import { Button, ButtonLink, Switch, cn, iconButtonClass } from "@/ui";
import { LoginDialog } from "./login-dialog";

export interface Notice {
  id: string;
  kind: string;
  title: string;
  body: string;
  link: string | null;
  data: Record<string, unknown>;
  read: boolean;
  readAt: number | null;
  createdAt: number;
  cursor: number;
}

interface NoticePage {
  notices: Notice[];
  unread: number;
  nextCursor: number | null;
}

interface Preference {
  kind: string;
  label: string;
  group: string;
  canMute: boolean;
  enabled: boolean;
}

const kindIcon: Record<string, LucideIcon> = {
  generation_done: CheckCircle2,
  generation_failed: AlertTriangle,
  credits_low: Coins,
  plan: Crown,
  like: Heart,
  comment: MessageCircle,
  follow: UserPlus,
  announcement: Megaphone,
  system: ShieldCheck,
};

/** "3 min ago", from the live clock. */
export function useAgo() {
  const now = useNow();
  return (ms: number) => {
    if (now === null) return "";
    const s = Math.max(0, now - Math.floor(ms / 1000));
    const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto", style: "short" });
    if (s < 60) return rtf.format(0, "second");
    if (s < 3600) return rtf.format(-Math.floor(s / 60), "minute");
    if (s < 86400) return rtf.format(-Math.floor(s / 3600), "hour");
    if (s < 86400 * 30) return rtf.format(-Math.floor(s / 86400), "day");
    return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(ms);
  };
}

const chip = (on: boolean) =>
  cn(
    "inline-flex h-8 shrink-0 items-center gap-1 rounded-full text-sm leading-5 font-medium whitespace-nowrap text-[#FFFFFFCC] transition-colors duration-150",
    on ? "bg-border-default px-[15px] text-text-primary" : "border border-border-default px-[14px] hover:bg-border-subtle",
  );

const panel = "rounded-[28px] border border-[#FFFFFF1F] bg-[#23262AB2]";

export function NotificationsPage() {
  const { user, loading } = useSession();
  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6 px-4 pt-8 pb-16">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-2xl leading-8 font-semibold tracking-[-0.02em] text-text-primary">{c.title}</h1>
          <p className="text-sm leading-5 text-text-secondary">{c.intro}</p>
        </div>
        <Link href={routes.whatsNew} className="inline-flex items-center gap-1 text-sm leading-5 font-medium text-text-nav transition-colors duration-150 hover:text-text-primary">
          <Sparkles className="size-4" strokeWidth={1.5} aria-hidden />
          {c.whatsNew}
        </Link>
      </header>
      {loading ? <ListSkeleton /> : user ? <Inbox /> : <SignedOut />}
    </div>
  );
}

function SignedOut() {
  const [open, setOpen] = useState(false);
  return (
    <section className={cn(panel, "flex flex-col items-center gap-4 px-6 py-16 text-center")}>
      <span className="flex size-11 items-center justify-center rounded-lg bg-border-subtle">
        <Bell className="size-5 text-text-primary" strokeWidth={1.5} aria-hidden />
      </span>
      <div className="flex max-w-[400px] flex-col gap-1">
        <h2 className="text-lg leading-6 font-semibold text-text-primary">{c.signedOutTitle}</h2>
        <p className="text-sm leading-5 text-text-secondary">{c.signedOutBody}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="tint" size="md" onClick={() => setOpen(true)}>
          {c.signIn}
        </Button>
        <ButtonLink href={`${routes.join}?next=${encodeURIComponent(routes.notifications)}`} variant="lime" size="md">
          {c.join}
        </ButtonLink>
      </div>
      <LoginDialog open={open} onOpenChange={setOpen} mode="login" />
    </section>
  );
}

function Inbox() {
  const router = useRouter();
  const ago = useAgo();
  const [filter, setFilter] = useState<(typeof c.filters)[number]>(c.filters[0]);
  const [problem, setProblem] = useState<string | null>(null);
  const [live, setLive] = useState(false);

  const keyFor = (i: number, prev: NoticePage | null) => {
    if (prev && prev.nextCursor === null) return null;
    const p = new URLSearchParams({ limit: "20" });
    if (filter.unread) p.set("unread", "1");
    if (filter.kinds) p.set("kind", filter.kinds);
    if (i > 0 && prev?.nextCursor != null) p.set("before", String(prev.nextCursor));
    return `/api/notifications?${p}`;
  };
  const list = useSWRInfinite<NoticePage>(keyFor, fetcher, { revalidateFirstPage: true });
  const pages = list.data ?? [];
  const notices = pages.flatMap((p) => p.notices);
  const unread = pages[0]?.unread ?? 0;
  const hasMore = pages.length > 0 && pages[pages.length - 1].nextCursor !== null;
  const { mutate } = list;

  // Live: new notices and count changes arrive over the stream; refresh the list when they do.
  // The stream is shared with the bell in the navigation, so this page adds no connection.
  const connectedBefore = useRef(false);
  useLiveStream(notificationStream, (event) => {
    if (event === STREAM_DOWN) return setLive(false);
    if (event === "ready") {
      setLive(true);
      // The first `ready` arrives with the page; a later one means we were away and may have missed some.
      if (!connectedBefore.current) return void (connectedBefore.current = true);
    }
    void mutate();
  });

  async function act(fn: () => Promise<unknown>) {
    setProblem(null);
    try {
      await fn();
    } catch (e) {
      setProblem(errorMessage(e));
    }
    await mutate();
  }

  const setRead = (n: Notice, read: boolean) => act(() => api(`/api/notifications/${n.id}`, { method: "PATCH", body: { read } }));
  const remove = (n: Notice) => act(() => api(`/api/notifications/${n.id}`, { method: "DELETE" }));
  const markAll = () => act(() => api("/api/notifications/read", { method: "POST", body: { all: true } }));
  const open = async (n: Notice) => {
    if (!n.read) await setRead(n, true);
    if (n.link?.startsWith("/") && !n.link.startsWith("//")) router.push(n.link);
  };

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <section aria-label={c.title} className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div role="tablist" aria-label={c.filtersLabel} className="-mx-4 flex min-w-0 items-center gap-2 overflow-x-auto px-4 scroll-none sm:mx-0 sm:px-0">
            {c.filters.map((f) => (
              <button key={f.id} type="button" role="tab" aria-selected={filter.id === f.id} onClick={() => setFilter(f)} className={chip(filter.id === f.id)}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-[6px] text-xs leading-4 font-medium text-text-secondary" aria-live="polite">
              <Circle className={cn("size-2", live ? "fill-brand text-brand" : "fill-text-tertiary text-text-tertiary")} aria-hidden />
              {live ? c.live : null} {c.unreadCount(unread)}
            </span>
            <Button variant="soft" size="sm" onClick={markAll} disabled={unread === 0}>
              <CheckCheck className="size-4" strokeWidth={1.5} aria-hidden />
              {c.markAll}
            </Button>
          </div>
        </div>

        {problem ? (
          <p role="alert" className="text-sm leading-5 text-danger">
            {problem}
          </p>
        ) : null}

        <div className={cn(panel, "p-3")}>
          {list.error && !pages.length ? (
            <div role="alert" className="flex flex-col items-start gap-2 px-2 py-6">
              <p className="text-sm leading-5 text-text-primary">{errorMessage(list.error) || c.error}</p>
              <button type="button" onClick={() => void mutate()} className="text-sm leading-5 font-semibold text-brand hover:underline">
                {c.retry}
              </button>
            </div>
          ) : !pages.length ? (
            <ListSkeleton bare />
          ) : notices.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-4 py-14 text-center">
              <p className="max-w-[420px] text-sm leading-5 text-text-secondary">{filter.id === "all" ? c.empty : c.emptyFiltered}</p>
              {filter.id === "all" ? (
                <ButtonLink href={routes.image} variant="lime" size="md">
                  {c.emptyAction}
                </ButtonLink>
              ) : null}
            </div>
          ) : (
            <ul className="flex flex-col gap-1" data-notices>
              {notices.map((n) => {
                const Icon = kindIcon[n.kind] ?? Bell;
                return (
                  <li key={n.id} data-notice={n.id} data-read={n.read} className="group relative flex min-w-0 items-start gap-3 rounded-xl p-2 transition-colors duration-150 hover:bg-border-subtle">
                    <span className="relative flex size-11 shrink-0 items-center justify-center rounded-lg bg-border-subtle">
                      <Icon className={cn("size-5", n.kind === "generation_failed" ? "text-danger" : "text-text-primary")} strokeWidth={1.5} aria-hidden />
                      {!n.read ? <span aria-hidden className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-brand ring-2 ring-surface-secondary" /> : null}
                    </span>
                    <button type="button" onClick={() => void open(n)} className="flex min-w-0 flex-1 flex-col gap-[3px] pt-[3px] text-left">
                      <span className="flex min-w-0 items-baseline gap-2">
                        <span className={cn("truncate text-sm leading-5 font-semibold", n.read ? "text-text-nav" : "text-text-primary")}>{n.title}</span>
                        {!n.read ? <span className="sr-only">(unread)</span> : null}
                        <span className="shrink-0 text-xs leading-[18px] text-text-tertiary">{ago(n.createdAt)}</span>
                      </span>
                      {n.body ? <span className="line-clamp-2 text-xs leading-[18px] text-text-tab">{n.body}</span> : null}
                    </button>
                    <span className="flex shrink-0 items-center gap-1 sm:opacity-0 sm:transition-opacity sm:duration-150 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                      <button type="button" aria-label={n.read ? c.markUnread : c.markRead} onClick={() => void setRead(n, !n.read)} className={iconButtonClass(32, "soft")}>
                        {n.read ? <Circle className="size-4" strokeWidth={1.5} aria-hidden /> : <CheckCheck className="size-4" strokeWidth={1.5} aria-hidden />}
                      </button>
                      <button type="button" aria-label={c.remove} onClick={() => void remove(n)} className={iconButtonClass(32, "soft")}>
                        <Trash2 className="size-4" strokeWidth={1.5} aria-hidden />
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {hasMore ? (
            <button
              type="button"
              onClick={() => void list.setSize(list.size + 1)}
              disabled={list.isValidating}
              className="mt-1 flex h-11 w-full items-center justify-center rounded-xl text-sm leading-5 font-medium text-text-secondary transition-colors duration-150 hover:bg-border-subtle hover:text-text-primary disabled:opacity-50"
            >
              {c.loadMore}
            </button>
          ) : null}
        </div>
      </section>
      <Preferences />
    </div>
  );
}

function Preferences() {
  const { data, error, mutate } = useSWR<{ preferences: Preference[] }>("/api/notifications/preferences", fetcher);
  const [problem, setProblem] = useState<string | null>(null);
  const groups = Object.keys(c.groups);

  async function toggle(p: Preference, enabled: boolean) {
    setProblem(null);
    try {
      const next = await api<{ preferences: Preference[] }>("/api/notifications/preferences", { method: "PUT", body: { kinds: { [p.kind]: enabled } } });
      await mutate(next, { revalidate: false });
    } catch (e) {
      setProblem(errorMessage(e));
    }
  }

  return (
    <aside aria-labelledby="prefs-title" className={cn(panel, "flex w-full shrink-0 flex-col gap-4 p-5 lg:w-[340px]")}>
      <div className="flex flex-col gap-1">
        <h2 id="prefs-title" className="text-base leading-5 font-semibold text-text-primary">
          {c.prefsTitle}
        </h2>
        <p className="text-xs leading-[18px] text-text-secondary">{c.prefsIntro}</p>
      </div>
      {problem ? (
        <p role="alert" className="text-xs leading-4 text-danger">
          {problem}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm leading-5 text-text-secondary">
          {errorMessage(error)}
        </p>
      ) : !data ? (
        <div className="flex flex-col gap-3" aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="shimmer h-5 rounded-xs bg-border-subtle" />
          ))}
        </div>
      ) : (
        groups.map((g) => {
          const items = data.preferences.filter((p) => p.group === g);
          if (!items.length) return null;
          return (
            <div key={g} className="flex flex-col gap-2">
              <span className="text-xs leading-[18px] font-medium text-text-muted">{c.groups[g]}</span>
              {items.map((p) => (
                <label key={p.kind} className="flex min-h-8 items-center justify-between gap-3">
                  <span className="min-w-0 text-sm leading-5 text-text-primary">{p.label}</span>
                  {p.canMute ? (
                    <Switch checked={p.enabled} onCheckedChange={(v) => void toggle(p, v)} aria-label={p.label} />
                  ) : (
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs leading-4 text-text-secondary">
                      <Lock className="size-3" strokeWidth={1.5} aria-hidden />
                      {c.locked}
                    </span>
                  )}
                </label>
              ))}
            </div>
          );
        })
      )}
    </aside>
  );
}

function ListSkeleton({ bare }: { bare?: boolean }) {
  return (
    <div className={cn("flex flex-col gap-1", !bare && cn(panel, "p-3"))} aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 p-2">
          <span className="shimmer size-11 rounded-lg bg-border-subtle" />
          <span className="flex flex-col gap-2">
            <span className="shimmer h-3 w-48 rounded-xs bg-border-subtle" />
            <span className="shimmer h-3 w-72 max-w-[50vw] rounded-xs bg-border-subtle" />
          </span>
        </div>
      ))}
    </div>
  );
}
