"use client";

import { ArrowDownWideNarrow, Clapperboard, Crown, Ellipsis, FolderOpen, LayoutGrid, LogIn, PanelLeft, Plus, Search, Users, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { LoginDialog } from "@/components/entry/login-dialog";
import { LogoMark } from "@/components/brand/logo";
import { formatCredits } from "@/config/economy";
import { cinema } from "@/content/cinema";
import { closeForGood } from "@/lib/closable";
import { pricingBadge, routes } from "@/content/site";
import { api } from "@/lib/api";
import { Artwork, Button, Dialog, DialogContent, MenuItem, Popover, PopoverContent, PopoverTrigger, cn } from "@/ui";
import { refreshProject, type Project } from "./data";
import { useCinema } from "./state";

const t = cinema.sidebar;

/** The glossy 24px tile behind each sidebar link icon, in the drawn colours. */
function NavTile({ from, to, children }: { from: string; to: string; children: ReactNode }) {
  return (
    <span
      aria-hidden
      className="relative flex size-6 shrink-0 items-center justify-center rounded-md border border-[#C5C5C53D] text-text-primary [box-shadow:#FFFFFF3D_0px_2px_4px_inset,#00000014_0px_4px_2px]"
      style={{ backgroundImage: `linear-gradient(180deg, #FFFFFF33 0%, #00000000 100%), linear-gradient(135deg, ${from} 3.87%, ${to} 93.45%)` }}
    >
      {children}
    </span>
  );
}

const rowClass =
  "flex h-9 w-full items-center gap-2 rounded-xl px-[6px] text-left text-sm leading-5 font-medium text-text-primary transition-colors duration-150 hover:bg-border-subtle";

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function ProjectRow({ project, active, onOpen }: { project: Project; active: boolean; onOpen: () => void }) {
  const { report, openProject } = useCinema();
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [name, setName] = useState(project.title);
  const [saving, setSaving] = useState(false);

  async function rename() {
    setSaving(true);
    try {
      await api(`/api/cinema/projects/${project.id}`, { method: "PATCH", body: { title: name.trim() } });
      refreshProject(project.id);
      setRenaming(false);
    } catch (e) {
      report(e);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setSaving(true);
    try {
      await api(`/api/cinema/projects/${project.id}`, { method: "DELETE" });
      if (active) openProject(null);
      refreshProject(null);
      setDeleting(false);
    } catch (e) {
      report(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="group relative">
      <button
        type="button"
        onClick={onOpen}
        aria-current={active ? "true" : undefined}
        className={cn(
          "flex h-9 w-full items-center gap-2 rounded-xl pr-9 pl-[6px] text-left text-sm leading-4 font-medium transition-colors duration-150 hover:bg-border-subtle hover:text-text-primary",
          active ? "bg-border-subtle text-text-primary" : "text-text-secondary",
        )}
      >
        <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-md border border-[#C5C5C54C] bg-[#FFFFFF14]">
          <Clapperboard className="size-4" strokeWidth={1.5} />
        </span>
        <span className="min-w-0 flex-1 truncate">{project.title}</span>
      </button>
      <Popover open={menu} onOpenChange={setMenu}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`${t.projectMenu}: ${project.title}`}
            className="absolute top-[6px] right-[6px] flex size-6 items-center justify-center rounded-md text-text-secondary opacity-0 transition-colors duration-150 group-hover:opacity-100 hover:bg-border-default hover:text-text-primary focus-visible:opacity-100 data-[state=open]:opacity-100 max-lg:opacity-100"
          >
            <Ellipsis className="size-4" strokeWidth={1.5} aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[180px]">
          <MenuItem
            onClick={() => {
              setMenu(false);
              setName(project.title);
              setRenaming(true);
            }}
          >
            {t.rename}
          </MenuItem>
          <MenuItem
            className="text-danger"
            onClick={() => {
              setMenu(false);
              setDeleting(true);
            }}
          >
            {t.delete}
          </MenuItem>
        </PopoverContent>
      </Popover>
      <Dialog open={renaming} onOpenChange={setRenaming}>
        <DialogContent title={t.renameTitle} className="max-w-[400px]">
          <form
            className="flex flex-col gap-4 p-6"
            onSubmit={(e) => {
              e.preventDefault();
              void rename();
            }}
          >
            <label className="flex flex-col gap-2 text-xs leading-4 font-medium text-text-secondary">
              {t.nameLabel}
              <input
                autoFocus
                value={name}
                maxLength={120}
                onChange={(e) => setName(e.target.value)}
                className="h-10 rounded-lg bg-surface-field px-3 text-sm leading-5 text-text-primary outline-none"
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="soft" size="md" onClick={() => setRenaming(false)}>
                {t.cancel}
              </Button>
              <Button variant="lime" size="md" type="submit" disabled={saving || !name.trim()}>
                {t.save}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={deleting} onOpenChange={setDeleting}>
        <DialogContent title={t.deleteTitle} className="max-w-[400px]">
          <div className="flex flex-col gap-4 p-6">
            <p className="text-sm leading-5 text-text-secondary">{t.deleteBody}</p>
            <div className="flex justify-end gap-2">
              <Button variant="soft" size="md" onClick={() => setDeleting(false)}>
                {t.cancel}
              </Button>
              <Button variant="white" size="md" className="text-danger" disabled={saving} onClick={() => void remove()}>
                {t.deleteConfirm}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </li>
  );
}

export function Sidebar({ onCollapse, onNavigate }: { onCollapse: () => void; onNavigate?: () => void }) {
  const { session, projects, projectId, openProject, newProject, setCastOpen, project } = useCinema();
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"recent" | "name">("recent");
  const [sortOpen, setSortOpen] = useState(false);
  const [login, setLogin] = useState<"login" | "join" | null>(null);
  const [making, setMaking] = useState(false);

  const shown = useMemo(() => {
    let list = projects.data?.projects ?? [];
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((p) => p.title.toLowerCase().includes(q));
    if (sort === "name") list = [...list].sort((a, b) => a.title.localeCompare(b.title));
    return list;
  }, [projects.data, query, sort]);

  const total = projects.data?.projects.length ?? 0;

  return (
    <div className="flex size-full flex-col overflow-clip rounded-2xl border border-border-subtle bg-surface-primary">
      <div className="flex h-[52px] shrink-0 items-center justify-center gap-1 px-2">
        <Link
          href={routes.home}
          aria-label={cinema.homeLabel}
          className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-xl bg-border-subtle px-[6px] [box-shadow:#0000000F_0px_2px_8px] transition-colors duration-150 hover:bg-border-default"
        >
          <LogoMark size={24} />
          <span className="truncate text-sm leading-5 font-medium text-text-primary">{cinema.studioName}</span>
        </Link>
        <button
          type="button"
          onClick={onCollapse}
          aria-label={cinema.sidebar.collapse}
          className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-border-subtle text-text-primary transition-colors duration-150 hover:bg-border-default"
        >
          <PanelLeft className="size-4 max-lg:hidden" strokeWidth={1.5} aria-hidden />
          <X className="size-4 lg:hidden" strokeWidth={1.5} aria-hidden />
        </button>
      </div>

      <nav aria-label={cinema.studioName} className="flex shrink-0 flex-col gap-[2px] px-2 pt-2 pb-2">
        <button
          type="button"
          className={cn(rowClass, "bg-border-subtle")}
          onClick={() => {
            onNavigate?.();
            scrollToId("cinema-top");
          }}
        >
          <NavTile from="#222221" to="#3B3C3A">
            <Clapperboard className="size-[14px]" strokeWidth={1.5} />
          </NavTile>
          {cinema.nav.workspace}
        </button>
        <button
          type="button"
          className={rowClass}
          disabled={!project}
          onClick={() => {
            onNavigate?.();
            setCastOpen(true);
          }}
        >
          <NavTile from="#4188BE" to="#0E2772">
            <Users className="size-[14px]" strokeWidth={1.5} />
          </NavTile>
          {cinema.nav.cast}
        </button>
        <button
          type="button"
          className={rowClass}
          disabled={!project}
          onClick={() => {
            onNavigate?.();
            scrollToId("cinema-storyboard");
          }}
        >
          <NavTile from="#E251B4" to="#8D1237">
            <LayoutGrid className="size-[14px]" strokeWidth={1.5} />
          </NavTile>
          {cinema.nav.storyboard}
        </button>
        <Link href={routes.library} className={rowClass}>
          <NavTile from="#A5A5A5" to="#3D3D3D">
            <FolderOpen className="size-[14px]" strokeWidth={1.5} />
          </NavTile>
          {cinema.nav.library}
        </Link>
      </nav>

      <div className="flex min-h-0 flex-1 flex-col px-2">
        <div className="mt-4 flex h-9 shrink-0 items-center justify-between px-[6px]">
          <h2 className="text-xs leading-4 font-medium text-text-secondary">{t.projects}</h2>
          <div className="flex items-center gap-[2px]">
            <button
              type="button"
              aria-label={t.search}
              aria-pressed={searching}
              disabled={!total}
              onClick={() => {
                setSearching((s) => !s);
                setQuery("");
              }}
              className="flex size-6 items-center justify-center rounded-md text-text-secondary transition-colors duration-150 hover:bg-border-subtle hover:text-text-primary disabled:opacity-40"
            >
              <Search className="size-4" strokeWidth={1.5} aria-hidden />
            </button>
            <Popover open={sortOpen} onOpenChange={setSortOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label={t.sort}
                  disabled={!total}
                  className="flex size-6 items-center justify-center rounded-md text-text-secondary transition-colors duration-150 hover:bg-border-subtle hover:text-text-primary disabled:opacity-40 data-[state=open]:bg-border-subtle"
                >
                  <ArrowDownWideNarrow className="size-4" strokeWidth={1.5} aria-hidden />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[200px]">
                {(["recent", "name"] as const).map((s) => (
                  <MenuItem
                    key={s}
                    selected={sort === s}
                    onClick={() => {
                      setSort(s);
                      setSortOpen(false);
                    }}
                  >
                    {s === "recent" ? t.sortRecent : t.sortName}
                  </MenuItem>
                ))}
              </PopoverContent>
            </Popover>
          </div>
        </div>
        {searching ? (
          <input
            autoFocus
            aria-label={t.search}
            placeholder={t.searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setSearching(false);
                setQuery("");
              }
            }}
            className="mx-[2px] mb-1 h-8 shrink-0 rounded-lg bg-surface-field px-3 text-sm leading-5 text-text-primary outline-none placeholder:text-text-muted"
          />
        ) : null}
        <button
          type="button"
          disabled={making}
          onClick={async () => {
            setMaking(true);
            await newProject();
            setMaking(false);
            onNavigate?.();
          }}
          className="mt-[6px] flex h-9 w-full shrink-0 items-center gap-2 rounded-xl pl-[6px] text-left text-sm leading-4 font-medium text-text-secondary transition-colors duration-150 hover:bg-border-subtle hover:text-text-primary disabled:opacity-60"
        >
          <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-md border border-[#C5C5C54C] bg-[#FFFFFF14]">
            <Plus className="size-4" strokeWidth={1.5} />
          </span>
          {t.newProject}
        </button>
        <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto pb-2">
          {projects.isLoading ? (
            <div className="flex flex-col gap-1 pt-1">
              {[0, 1].map((i) => (
                <div key={i} className="shimmer h-9 rounded-xl bg-border-subtle" />
              ))}
            </div>
          ) : !session.user ? (
            <p className="px-[6px] pt-2 text-xs leading-4 text-text-tertiary">{t.signedOut}</p>
          ) : total === 0 ? (
            <p className="px-[6px] pt-2 text-xs leading-4 text-text-tertiary">{t.empty}</p>
          ) : shown.length === 0 ? (
            <p className="px-[6px] pt-2 text-xs leading-4 text-text-tertiary">{t.noMatch}</p>
          ) : (
            <ul aria-label={t.projects} className="flex flex-col gap-[2px]">
              {shown.map((p) => (
                <ProjectRow
                  key={p.id}
                  project={p}
                  active={p.id === projectId}
                  onOpen={() => {
                    openProject(p.id);
                    onNavigate?.();
                  }}
                />
              ))}
            </ul>
          )}
        </div>

        {/* Closed for good, not just for this visit: see src/lib/closable.ts. */}
        <div
          data-closable="cinemaGuide"
          className="relative mb-1 hidden shrink-0 flex-col rounded-xl border border-border-subtle bg-origin-border p-3 [background-image:linear-gradient(180deg,#FFFFFF0A_0%,#FFFFFF1F_100%)] [@media(min-height:760px)]:flex"
        >
          <button
            type="button"
            aria-label={cinema.guide.close}
            onClick={() => closeForGood("cinemaGuide")}
            className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-sm text-text-secondary transition-colors duration-150 after:absolute after:-inset-1 hover:text-text-primary"
          >
            <X className="size-4" strokeWidth={1.5} aria-hidden />
          </button>
          <div className="flex flex-col gap-1 pl-1">
            <span className="text-xs leading-4 text-text-secondary">{cinema.guide.kicker}</span>
            <span className="w-[163px] text-sm leading-5 font-medium text-text-primary">{cinema.guide.title}</span>
          </div>
          <div className="mt-3 overflow-clip rounded-sm border border-border-strong">
            <Artwork name="cinema/guide-card" className="aspect-[185/103] w-full" />
          </div>
          <Link
            href={routes.guide}
            className="mt-3 flex h-10 items-center justify-center rounded-lg bg-text-primary text-sm leading-4 font-medium text-text-inverse [box-shadow:#0000001A_0px_2px_4px] transition-colors duration-150 hover:bg-text-soft"
          >
            {cinema.guide.button}
          </Link>
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-1 border-t border-border-subtle px-2 pt-[9px] pb-2">
        <Link
          href={routes.pricing}
          className="flex h-9 items-center gap-3 rounded-xl bg-[#FF005B0F] pl-[10px] text-sm leading-5 font-medium text-text-primary transition-colors duration-150 hover:bg-[#FF005B1F]"
        >
          <Crown className="size-4 fill-promo text-promo" strokeWidth={1.5} aria-hidden />
          <span className="w-[78px]">{cinema.account.pricing}</span>
          <span
            className="flex h-[15px] items-center rounded-[2px] px-1 font-display text-xs leading-[14px] font-bold text-text-primary uppercase"
            style={{ backgroundImage: "radial-gradient(ellipse 39.43% 136.54% at 51.64% 117.31%, #EE4596 0%, #ED2D84 50%, #ED1572 100%)" }}
          >
            {pricingBadge}
          </span>
        </Link>
        {session.member ? (
          <Link
            href={routes.wallet}
            className="flex h-9 items-center gap-3 rounded-xl border border-border-default pl-[11px] text-sm leading-5 font-medium text-text-primary transition-colors duration-150 hover:bg-border-subtle"
          >
            <span className="min-w-0 flex-1 truncate">{session.member.name || session.member.email}</span>
            <span className="pr-3 font-mono text-xs text-text-secondary">
              {formatCredits(session.balance)} {cinema.account.credits}
            </span>
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setLogin(session.user ? "join" : "login")}
            className="flex h-9 items-center gap-3 rounded-xl border border-brand bg-brand pl-[11px] text-sm leading-5 font-medium text-black transition-colors duration-150 hover:bg-brand-glow"
          >
            <LogIn className="size-4" strokeWidth={1.5} aria-hidden />
            <span className="flex-1 text-left">{session.user ? cinema.account.join : cinema.account.login}</span>
            {session.user ? <span className="pr-3 font-mono text-xs">{formatCredits(session.balance)}</span> : null}
          </button>
        )}
      </div>
      <LoginDialog open={login !== null} onOpenChange={(o) => !o && setLogin(null)} mode={login ?? "login"} next={routes.cinema} />
    </div>
  );
}
