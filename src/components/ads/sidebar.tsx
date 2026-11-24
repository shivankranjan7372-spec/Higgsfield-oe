"use client";

import { ArrowDownWideNarrow, ChevronDown, CircleUserRound, Copy, Ellipsis, House, Images, Package, PanelLeft, Pencil, Plus, Tag, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { LoginDialog } from "@/components/entry/login-dialog";
import { ads } from "@/content/ads";
import { routes } from "@/content/site";
import { useSession } from "@/lib/session";
import { MenuItem, Popover, PopoverContent, PopoverTrigger, Spinner, cn } from "@/ui";
import type { Campaign } from "./data";

const row =
  "relative flex h-8 w-full min-w-0 items-center rounded-lg pr-2 pl-[34px] text-left text-sm leading-5 font-medium text-text-primary transition-colors duration-150 hover:bg-border-subtle";
const rowIcon = "absolute top-2 left-2 size-4";
const heading = "flex h-7 items-center gap-1 rounded-md pl-[6px] text-xs leading-[18px] font-medium text-text-muted transition-colors duration-150 hover:text-text-primary";
const small = "flex size-6 items-center justify-center rounded-md text-text-primary transition-colors duration-150 hover:bg-border-subtle";

function NavRow({ icon, active, children, ...rest }: { icon: ReactNode; active?: boolean; children: ReactNode; onClick?: () => void }) {
  return (
    <button type="button" aria-current={active ? "page" : undefined} className={cn(row, active && "bg-border-subtle")} {...rest}>
      <span className={rowIcon}>{icon}</span>
      <span className="truncate">{children}</span>
    </button>
  );
}

/** A heading that folds its section away, with optional small buttons on the right. */
function Section({ title, extra, children }: { title: string; extra?: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="flex flex-col gap-[2px] px-2">
      <div className="flex h-7 items-center justify-between">
        <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className={heading}>
          {title}
          <ChevronDown className={cn("size-4 transition-transform duration-150", !open && "-rotate-90")} strokeWidth={1.5} aria-hidden />
        </button>
        {extra ? <div className="flex items-center gap-[2px] pr-[6px]">{extra}</div> : null}
      </div>
      {open ? <div className="flex flex-col gap-[2px] pt-[2px]">{children}</div> : null}
    </div>
  );
}

export interface CampaignActions {
  onOpen: (c: Campaign) => void;
  onRename: (c: Campaign, name: string) => Promise<void>;
  onDuplicate: (c: Campaign) => Promise<void>;
  onDelete: (c: Campaign) => Promise<void>;
}

function CampaignRow({ c, active, actions }: { c: Campaign; active: boolean; actions: CampaignActions }) {
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(c.name);
  const [busy, setBusy] = useState(false);
  const name0 = c.name || ads.untitled;

  async function act(fn: () => Promise<void>) {
    setMenu(false);
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <form
        className="flex h-8 items-center px-1"
        onSubmit={async (e) => {
          e.preventDefault();
          setEditing(false);
          if (name.trim() && name.trim() !== c.name) await act(() => actions.onRename(c, name.trim()));
        }}
      >
        <input
          autoFocus
          aria-label={ads.sidebar.rename}
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setEditing(false);
          }}
          className="h-7 w-full min-w-0 rounded-md border border-border-strong bg-surface-field px-2 text-sm leading-5 text-text-primary focus:outline-none"
        />
      </form>
    );
  }

  return (
    <div className={cn("group relative flex h-8 items-center rounded-lg transition-colors duration-150 hover:bg-border-subtle", active && "bg-border-subtle")}>
      <button
        type="button"
        onClick={() => actions.onOpen(c)}
        aria-current={active ? "true" : undefined}
        title={name0}
        className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg pr-8 pl-2 text-left text-sm leading-5 font-medium text-text-primary"
      >
        {c.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.cover.kind === "video" ? `${c.cover.url}?poster=1` : c.cover.url} alt="" className="size-4 shrink-0 rounded-xs object-cover" onError={(e) => (e.currentTarget.style.visibility = "hidden")} />
        ) : c.status === "running" ? (
          <Spinner className="size-4 shrink-0 text-brand" label={ads.status.running} />
        ) : (
          <span className="size-4 shrink-0 rounded-xs bg-surface-tertiary" aria-hidden />
        )}
        <span className="truncate">{name0}</span>
      </button>
      <Popover open={menu} onOpenChange={setMenu}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`More for ${name0}`}
            className={cn(
              "absolute right-1 flex size-6 items-center justify-center rounded-md text-text-secondary opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100 hover:text-text-primary focus-visible:opacity-100 data-[state=open]:opacity-100 [@media(hover:none)]:opacity-100",
              busy && "opacity-100",
            )}
          >
            {busy ? <Spinner /> : <Ellipsis className="size-4" strokeWidth={1.5} aria-hidden />}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[180px]" align="end">
          <MenuItem role="menuitem" icon={<House className="size-4" strokeWidth={1.5} aria-hidden />} onClick={() => (setMenu(false), actions.onOpen(c))}>
            {ads.sidebar.openAd}
          </MenuItem>
          <MenuItem
            role="menuitem"
            icon={<Pencil className="size-4" strokeWidth={1.5} aria-hidden />}
            onClick={() => {
              setMenu(false);
              setName(c.name);
              setEditing(true);
            }}
          >
            {ads.sidebar.rename}
          </MenuItem>
          <MenuItem role="menuitem" icon={<Copy className="size-4" strokeWidth={1.5} aria-hidden />} onClick={() => act(() => actions.onDuplicate(c))}>
            {ads.sidebar.duplicate}
          </MenuItem>
          <MenuItem role="menuitem" className="text-danger" icon={<Trash2 className="size-4" strokeWidth={1.5} aria-hidden />} onClick={() => act(() => actions.onDelete(c))}>
            {ads.sidebar.delete}
          </MenuItem>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export interface SidebarProps {
  campaigns: Campaign[];
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  activeId: string | null;
  actions: CampaignActions;
  onHome: () => void;
  onBrands: () => void;
  onProducts: () => void;
  onAvatars: () => void;
  onCollapse?: () => void;
}

/** The left column: home, the asset shelves, then the member's ads and drafts. */
export function SidebarBody(p: SidebarProps) {
  const { user, member, loading: sessionLoading } = useSession();
  const [byName, setByName] = useState(false);
  const [login, setLogin] = useState(false);
  const sorted = [...p.campaigns].sort((a, b) => (byName ? a.name.localeCompare(b.name) : b.updatedAt - a.updatedAt));
  const made = sorted.filter((c) => c.status !== "draft");
  const drafts = sorted.filter((c) => c.status === "draft");

  const list = (items: Campaign[], empty: string) =>
    p.loading ? (
      [0, 1].map((i) => <div key={i} className="shimmer mx-2 h-6 rounded-md bg-surface-secondary" />)
    ) : p.failed ? (
      <div className="flex items-center gap-2 pl-[6px] text-xs leading-4 text-text-secondary" role="alert">
        {ads.sidebar.loadError}
        <button type="button" onClick={p.onRetry} className="font-medium text-text-primary underline-offset-2 hover:underline">
          {ads.sidebar.retry}
        </button>
      </div>
    ) : items.length === 0 ? (
      <p className="flex h-8 items-center pl-[6px] text-xs leading-4 text-text-secondary">{empty}</p>
    ) : (
      items.map((c) => <CampaignRow key={c.id} c={c} active={c.id === p.activeId} actions={p.actions} />)
    );

  return (
    <div className="flex h-full min-h-0 w-full flex-col pt-1">
      <div className="flex h-[46px] shrink-0 justify-center pt-[2px]">
        <div className="flex h-9 w-[228px] items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-brand text-ink">
              <Tag className="size-[14px]" strokeWidth={2} aria-hidden />
            </span>
            <span className="text-sm leading-5 font-semibold text-text-primary">{ads.title}</span>
          </span>
          {p.onCollapse ? (
            <button type="button" aria-label={ads.sidebar.collapse} onClick={p.onCollapse} className={cn(small, "rounded-sm")}>
              <PanelLeft className="size-4" strokeWidth={1.5} aria-hidden />
            </button>
          ) : null}
        </div>
      </div>

      <nav aria-label={ads.title} className="scroll-quiet flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-4">
        <div className="flex flex-col gap-[2px] px-2 pt-2">
          <NavRow icon={<House className="size-4" strokeWidth={1.5} aria-hidden />} active={!p.activeId} onClick={p.onHome}>
            {ads.sidebar.home}
          </NavRow>
          <Link href={routes.library} className={row}>
            <Images className={rowIcon} strokeWidth={1.5} aria-hidden />
            <span className="truncate">{ads.sidebar.allMedia}</span>
          </Link>
        </div>

        <Section title={ads.sidebar.assets}>
          <NavRow icon={<Tag className="size-4" strokeWidth={1.5} aria-hidden />} onClick={p.onBrands}>
            {ads.sidebar.brands}
          </NavRow>
          <NavRow icon={<Package className="size-4" strokeWidth={1.5} aria-hidden />} onClick={p.onProducts}>
            {ads.sidebar.products}
          </NavRow>
          <NavRow icon={<CircleUserRound className="size-4" strokeWidth={1.5} aria-hidden />} onClick={p.onAvatars}>
            {ads.sidebar.avatars}
          </NavRow>
        </Section>

        {!sessionLoading && !user ? (
          <p className="px-4 text-xs leading-4 text-text-secondary">{ads.sidebar.signedOut}</p>
        ) : (
          <>
            <Section
              title={ads.sidebar.ads}
              extra={
                <>
                  <button type="button" aria-label={byName ? ads.sidebar.sortNewest : ads.sidebar.sortName} title={byName ? ads.sidebar.sortNewest : ads.sidebar.sortName} onClick={() => setByName(!byName)} className={small}>
                    <ArrowDownWideNarrow className="size-4" strokeWidth={1.5} aria-hidden />
                  </button>
                  <button type="button" aria-label={ads.sidebar.newAd} title={ads.sidebar.newAd} onClick={p.onHome} className={small}>
                    <Plus className="size-4" strokeWidth={1.5} aria-hidden />
                  </button>
                </>
              }
            >
              {list(made, ads.sidebar.noAds)}
            </Section>
            <Section
              title={ads.sidebar.drafts}
              extra={
                <button type="button" aria-label={`${ads.sidebar.newAd} (${ads.sidebar.drafts})`} onClick={p.onHome} className={small}>
                  <Plus className="size-4" strokeWidth={1.5} aria-hidden />
                </button>
              }
            >
              {list(drafts, ads.sidebar.noDrafts)}
            </Section>
          </>
        )}

        {user && !member ? (
          <div className="mx-2 flex flex-col gap-2 rounded-lg bg-surface-secondary p-3">
            <p className="text-xs leading-4 text-text-secondary">{ads.sidebar.guest}</p>
            <button type="button" onClick={() => setLogin(true)} className="self-start text-xs leading-4 font-semibold text-brand hover:underline">
              {ads.sidebar.createAccount}
            </button>
          </div>
        ) : null}
      </nav>
      <LoginDialog open={login} onOpenChange={setLogin} mode="join" next={routes.ads} />
    </div>
  );
}
