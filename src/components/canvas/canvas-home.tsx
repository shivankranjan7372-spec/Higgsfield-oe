"use client";

import { LayoutGrid, Plus, Search, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { LoginDialog } from "@/components/entry/login-dialog";
import { canvasCopy } from "@/content/canvas";
import { routes } from "@/content/site";
import { useNow } from "@/lib/browser";
import { ensureSession, useSession } from "@/lib/session";
import { Artwork, cn } from "@/ui";
import { CanvasHero } from "./hero";
import { newId, storageBroken, useBoards, type Board, type BoardItem } from "./store";

const t = canvasCopy;
const boardHref = (id: string) => `${routes.canvas}/board?id=${encodeURIComponent(id)}`;

/** The white 32-high pill the design draws for "Sign in". */
const pill =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-full bg-text-primary px-[15px] text-xs leading-[18px] font-semibold whitespace-nowrap text-ink transition-colors duration-150 hover:bg-text-soft disabled:opacity-40";

/** The quiet box the list sits in. */
const well = "flex w-full flex-col items-center justify-center gap-3 rounded-xl border border-border-subtle bg-[#FFFFFF05]";

function ago(then: number, now: number | null) {
  if (!now) return "";
  const s = Math.round((then - now * 1000) / 1000);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const abs = Math.abs(s);
  if (abs < 60) return rtf.format(0, "second");
  if (abs < 3600) return rtf.format(Math.round(s / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(s / 3600), "hour");
  return rtf.format(Math.round(s / 86400), "day");
}

function BoardCard({ board, now, onRemove }: { board: Board; now: number | null; onRemove: () => void }) {
  const [asking, setAsking] = useState(false);
  const cover = board.items.find((i) => i.kind === "image" && i.src);
  const name = board.name || t.untitled;
  return (
    <li className="group relative flex min-w-0 flex-col gap-2">
      <Link
        href={boardHref(board.id)}
        aria-label={t.card.open(name)}
        className="relative flex aspect-[16/10] w-full items-center justify-center overflow-hidden rounded-xl border border-border-subtle bg-surface-secondary transition-colors duration-150 hover:bg-surface-secondary-strong"
      >
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover.src} alt="" loading="lazy" className="size-full object-cover opacity-90 transition-opacity duration-150 group-hover:opacity-100" />
        ) : (
          <LayoutGrid className="size-6 text-text-tertiary" strokeWidth={1.5} aria-hidden />
        )}
      </Link>
      <div className="flex min-w-0 items-center justify-between gap-2 px-1">
        <div className="min-w-0">
          <p className="truncate text-sm leading-5 font-medium text-text-primary">{name}</p>
          <p className="truncate text-xs leading-[18px] text-text-secondary">
            {t.card.items(board.items.filter((i) => i.kind !== "pending").length)}
            {now ? ` · ${t.card.edited} ${ago(board.updatedAt, now)}` : ""}
          </p>
        </div>
        {asking ? (
          <div className="flex shrink-0 items-center gap-1" role="group" aria-label={t.card.confirmRemove}>
            <span className="sr-only">{t.card.confirmRemove}</span>
            <button type="button" onClick={onRemove} className="h-7 rounded-full bg-danger/15 px-3 text-xs font-semibold text-danger transition-colors duration-150 hover:bg-danger/25">
              {t.card.yes}
            </button>
            <button type="button" onClick={() => setAsking(false)} className="h-7 rounded-full bg-border-subtle px-3 text-xs font-semibold text-text-primary transition-colors duration-150 hover:bg-border-default">
              {t.card.no}
            </button>
          </div>
        ) : (
          <button
            type="button"
            aria-label={t.card.remove(name)}
            onClick={() => setAsking(true)}
            className="flex size-7 shrink-0 items-center justify-center rounded-full text-text-secondary transition-colors duration-150 hover:bg-border-subtle hover:text-text-primary"
          >
            <Trash2 className="size-4" strokeWidth={1.5} aria-hidden />
          </button>
        )}
      </div>
    </li>
  );
}

/** Lays a template's notes out as board items. */
export function templateItems(id: string): BoardItem[] {
  const tpl = t.templates.find((x) => x.id === id);
  if (!tpl) return [];
  return tpl.notes.map((n) => ({ id: newId("itm"), kind: "note" as const, x: n.x, y: n.y, w: n.w, h: n.h, text: n.text }));
}

export function CanvasHome() {
  const router = useRouter();
  const { user, loading } = useSession();
  const owner = user?.id ?? null;
  const { boards, create, remove } = useBoards(owner);
  const now = useNow();
  const [tab, setTab] = useState<"all" | "templates">("all");
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [login, setLogin] = useState(false);
  const [starting, setStarting] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  /** Makes a canvas (signing a new visitor in as a guest first) and opens it. */
  async function start(name: string, template?: string) {
    if (starting) return;
    setStarting(true);
    try {
      if (owner) {
        const board = create(name, template ? templateItems(template) : []);
        if (board) router.push(boardHref(board.id));
        return;
      }
      // A first-time visitor becomes a guest; the board page makes the canvas once it knows them.
      await ensureSession();
      router.push(`${routes.canvas}/board?new=1${template ? `&template=${template}` : ""}`);
    } catch {
      setLogin(true);
    } finally {
      setStarting(false);
    }
  }

  const q = query.trim().toLowerCase();
  const shownBoards = q ? boards.filter((b) => (b.name || t.untitled).toLowerCase().includes(q)) : boards;
  const shownTemplates = q ? t.templates.filter((x) => x.name.toLowerCase().includes(q)) : t.templates;

  const tabClass = (on: boolean) =>
    cn(
      "flex h-8 shrink-0 items-center justify-center gap-[6px] rounded-full px-3 text-xs leading-[18px] font-semibold transition-colors duration-150",
      on ? "bg-border-default text-text-primary" : "text-text-tab hover:text-text-primary",
    );

  let body;
  if (tab === "templates") {
    body = shownTemplates.length ? (
      <ul className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shownTemplates.map((tpl) => (
          <li key={tpl.id} className="min-w-0">
            <button
              type="button"
              aria-label={t.templateUse(tpl.name)}
              disabled={starting}
              onClick={() => void start(tpl.name, tpl.id)}
              className="group flex w-full flex-col gap-2 rounded-xl text-left"
            >
              <Artwork name={`canvas/template-${tpl.id}`} className="aspect-[16/10] w-full rounded-xl border border-border-subtle opacity-90 transition-opacity duration-150 group-hover:opacity-100" />
              <span className="min-w-0 px-1">
                <span className="block truncate text-sm leading-5 font-medium text-text-primary">{tpl.name}</span>
                <span className="block truncate text-xs leading-[18px] text-text-secondary">{tpl.blurb}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    ) : (
      <div className={cn(well, "h-[172px] px-4 text-center")}>
        <p className="text-sm leading-5 text-text-muted">{t.noMatch(query.trim())}</p>
      </div>
    );
  } else if (loading) {
    body = <div aria-busy="true" aria-label="Loading" className={cn(well, "shimmer h-[172px]")} />;
  } else if (!user) {
    body = (
      <div className={cn(well, "h-[172px] px-4 text-center")}>
        <p className="text-sm leading-5 text-text-muted">{t.signedOut.text}</p>
        <button type="button" className={pill} onClick={() => setLogin(true)}>
          {t.signedOut.action}
        </button>
      </div>
    );
  } else if (boards.length === 0) {
    body = (
      <div className={cn(well, "h-[172px] px-4 text-center")}>
        <p className="text-sm leading-5 text-text-muted">{t.empty.text}</p>
        <button type="button" className={pill} disabled={starting} onClick={() => void start(t.untitled)}>
          {t.empty.action}
        </button>
      </div>
    );
  } else if (shownBoards.length === 0) {
    body = (
      <div className={cn(well, "h-[172px] px-4 text-center")}>
        <p className="text-sm leading-5 text-text-muted">{t.noMatch(query.trim())}</p>
      </div>
    );
  } else {
    body = (
      <ul aria-label={t.tabs.all} className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {shownBoards.map((b) => (
          <BoardCard key={b.id} board={b} now={now} onRemove={() => remove(b.id)} />
        ))}
      </ul>
    );
  }

  return (
    <div className="flex flex-1 flex-col pb-16">
      <CanvasHero />
      <div className="mx-auto flex w-full max-w-[1216px] flex-col items-center gap-6 px-4">
        <div className="flex h-8 w-full items-center justify-between gap-3">
          <div role="tablist" aria-label={t.tabs.label} className="flex min-w-0 items-center gap-[14px]">
            <button type="button" role="tab" aria-selected={tab === "all"} onClick={() => setTab("all")} className={tabClass(tab === "all")}>
              {t.tabs.all}
            </button>
            <span aria-hidden className="h-3 w-px shrink-0 bg-border-default" />
            <button type="button" role="tab" aria-selected={tab === "templates"} onClick={() => setTab("templates")} className={tabClass(tab === "templates")}>
              {t.tabs.templates}
              <span className="flex h-[18px] w-[65px] items-center justify-center rounded-sm bg-[#D1FE171A] text-2xs leading-[14px] font-medium text-brand">{t.tabs.templatesTag}</span>
            </button>
          </div>
          <div className="flex min-w-0 items-center gap-2">
            {searching ? (
              <label className="flex h-8 min-w-0 items-center gap-2 rounded-full bg-border-subtle pr-1 pl-3">
                <span className="sr-only">{t.search.label}</span>
                <Search className="size-4 shrink-0 text-text-secondary" strokeWidth={1.5} aria-hidden />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setQuery("");
                      setSearching(false);
                    }
                  }}
                  placeholder={t.search.placeholder}
                  className="w-[120px] min-w-0 bg-transparent text-xs leading-[18px] text-text-primary outline-none placeholder:text-text-tertiary sm:w-[180px]"
                />
                <button
                  type="button"
                  aria-label={t.search.close}
                  onClick={() => {
                    setQuery("");
                    setSearching(false);
                  }}
                  className="flex size-6 shrink-0 items-center justify-center rounded-full text-text-secondary transition-colors duration-150 hover:bg-border-default hover:text-text-primary"
                >
                  <X className="size-4" strokeWidth={1.5} aria-hidden />
                </button>
              </label>
            ) : (
              <button
                type="button"
                aria-label={t.search.open}
                onClick={() => {
                  setSearching(true);
                  window.setTimeout(() => searchRef.current?.focus(), 0);
                }}
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-border-subtle text-text-primary transition-colors duration-150 hover:bg-border-default"
              >
                <Search className="size-5" strokeWidth={1.5} aria-hidden />
              </button>
            )}
            {user && boards.length > 0 && tab === "all" ? (
              <button type="button" className={pill} disabled={starting} onClick={() => void start(t.untitled)}>
                <Plus className="size-4" strokeWidth={1.5} aria-hidden />
                <span className="hidden sm:inline">{t.newCanvas}</span>
                <span className="sr-only sm:hidden">{t.newCanvas}</span>
              </button>
            ) : null}
          </div>
        </div>
        {body}
        {user && tab === "all" && storageBroken() ? <p className="text-xs leading-[18px] text-text-secondary">{t.storageFailed}</p> : null}
      </div>
      <LoginDialog open={login} onOpenChange={setLogin} mode="login" next={routes.canvas} />
    </div>
  );
}
