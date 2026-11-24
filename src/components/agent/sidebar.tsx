"use client";

import {
  Brain,
  CalendarClock,
  ChevronDown,
  ChevronsUpDown,
  Ellipsis,
  FolderOpen,
  LogIn,
  PanelLeft,
  Pin,
  PinOff,
  Plus,
  Search,
  Shapes,
  Tag as TagIcon,
  Trash2,
  Pencil,
  X,
  Zap,
  MessageSquare,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ComponentType, type ReactNode } from "react";
import useSWR, { mutate } from "swr";
import { LogoMark } from "@/components/brand/logo";
import { LoginDialog } from "@/components/entry/login-dialog";
import { pricingBadge, routes } from "@/content/site";
import { copy, agentName, agentRoutes } from "@/content/agent";
import { api, errorMessage, fetcher } from "@/lib/api";
import { closeForGood } from "@/lib/closable";
import { useSession } from "@/lib/session";
import { Artwork, Button, cn, Dialog, DialogContent, MenuItem, Popover, PopoverContent, PopoverTrigger } from "@/ui";
import { keys, sortChats, useChats } from "./data";
import { IconPlate } from "./icons";
import type { Chat } from "./types";

export type SideId = "new" | "projects" | "skills" | "connectors" | "schedules" | "memory" | "chat";

type Icon = ComponentType<{ className?: string; strokeWidth?: number }>;

function NavRow({ href, icon: Icon, label, active, onNavigate }: { href: string; icon: Icon; label: string; active?: boolean; onNavigate?: () => void }) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-9 w-[206px] shrink-0 items-center gap-2 rounded-xl pl-[6px] text-sm leading-5 font-medium text-text-primary transition-colors duration-150 hover:bg-border-subtle",
        active && "bg-border-subtle",
      )}
    >
      <IconPlate>
        <Icon className="size-4" strokeWidth={1.5} aria-hidden />
      </IconPlate>
      {label}
    </Link>
  );
}

/** The stacked-cards drawing above "No chats yet", drawn with boxes instead of a picture. */
function EmptyStack() {
  return (
    <div aria-hidden className="relative mx-auto h-[95px] w-[103px]">
      <div className="absolute top-1 left-[22px] h-[72px] w-[70px] rotate-6 rounded-xl bg-surface-secondary-strong" />
      <div className="absolute top-0 left-[18px] h-[72px] w-[70px] rounded-xl bg-surface-tertiary" />
      <div className="absolute top-[6px] left-[24px] h-[72px] w-[70px] rounded-xl border border-border-subtle bg-surface-secondary-strong" />
      <div className="absolute bottom-[4px] left-[8px] flex size-[26px] items-center justify-center rounded-full bg-[#6B6D70] text-text-primary">
        <Plus className="size-4" strokeWidth={2} />
      </div>
    </div>
  );
}

function ChatItem({ chat, active, onNavigate }: { chat: Chat; active: boolean; onNavigate?: () => void }) {
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(chat.title);
  const [confirm, setConfirm] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const patch = async (body: Record<string, unknown>) => {
    setProblem(null);
    try {
      const { chat: next } = await api<{ chat: Chat }>(`/api/agent/chats/${chat.id}`, { method: "PATCH", body });
      await mutate(keys.chats, (prev: { chats: Chat[] } | undefined) => (prev ? { chats: sortChats(prev.chats.map((c) => (c.id === next.id ? next : c))) } : prev), {
        revalidate: false,
      });
    } catch (e) {
      setProblem(errorMessage(e));
    }
  };

  const remove = async () => {
    setProblem(null);
    try {
      await api(`/api/agent/chats/${chat.id}`, { method: "DELETE" });
      setConfirm(false);
      await mutate(keys.chats, (prev: { chats: Chat[] } | undefined) => (prev ? { chats: prev.chats.filter((c) => c.id !== chat.id) } : prev), {
        revalidate: false,
      });
      if (active) router.push(agentRoutes.home);
    } catch (e) {
      setProblem(errorMessage(e));
    }
  };

  if (renaming) {
    return (
      <li>
        <form
          className="flex h-8 items-center gap-1 rounded-lg bg-border-subtle px-1"
          onSubmit={(e) => {
            e.preventDefault();
            const t = name.trim();
            setRenaming(false);
            if (t && t !== chat.title) void patch({ title: t.slice(0, 80) });
          }}
        >
          <label className="sr-only" htmlFor={`rename-${chat.id}`}>
            {copy.chat.rename}
          </label>
          <input
            id={`rename-${chat.id}`}
            autoFocus
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setName(chat.title);
                setRenaming(false);
              }
            }}
            onBlur={(e) => e.currentTarget.form?.requestSubmit()}
            className="h-7 min-w-0 flex-1 rounded-md bg-transparent px-1 text-sm leading-5 text-text-primary outline-none"
          />
        </form>
      </li>
    );
  }

  return (
    <li className="group relative">
      <Link
        href={`${agentRoutes.chat}/${chat.id}`}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex h-8 items-center gap-2 rounded-lg pr-8 pl-2 text-sm leading-5 text-text-nav transition-colors duration-150 hover:bg-border-subtle hover:text-text-primary",
          active && "bg-border-subtle text-text-primary",
        )}
      >
        {chat.pinned ? <Pin className="size-3 shrink-0 text-text-secondary" strokeWidth={1.5} aria-label={copy.chat.pinned} /> : null}
        <span className="min-w-0 flex-1 truncate">{chat.title || copy.nav.newChat}</span>
        {chat.state !== "idle" ? (
          <span
            className={cn("size-[6px] shrink-0 rounded-full", chat.state === "running" ? "animate-pulse bg-brand" : "bg-promo")}
            aria-label={chat.state === "running" ? copy.chat.working : copy.chat.waiting}
          />
        ) : null}
      </Link>
      <Popover open={menu} onOpenChange={setMenu}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`${copy.chat.actions}: ${chat.title}`}
            className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-md text-text-secondary opacity-0 transition-colors duration-150 group-hover:opacity-100 hover:bg-border-default hover:text-text-primary focus-visible:opacity-100 data-[state=open]:opacity-100 [@media(hover:none)]:opacity-100"
          >
            <Ellipsis className="size-4" strokeWidth={1.5} aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[180px]">
          <MenuItem
            icon={chat.pinned ? <PinOff className="size-4" strokeWidth={1.5} /> : <Pin className="size-4" strokeWidth={1.5} />}
            onClick={() => {
              setMenu(false);
              void patch({ pinned: !chat.pinned });
            }}
          >
            {chat.pinned ? copy.chat.unpin : copy.chat.pin}
          </MenuItem>
          <MenuItem
            icon={<Pencil className="size-4" strokeWidth={1.5} />}
            onClick={() => {
              setMenu(false);
              setName(chat.title);
              setRenaming(true);
            }}
          >
            {copy.chat.rename}
          </MenuItem>
          <MenuItem
            icon={<Trash2 className="size-4" strokeWidth={1.5} />}
            className="text-danger"
            onClick={() => {
              setMenu(false);
              setConfirm(true);
            }}
          >
            {copy.chat.delete}
          </MenuItem>
        </PopoverContent>
      </Popover>
      {problem ? (
        <p role="alert" className="px-2 pb-1 text-xs leading-4 text-danger">
          {problem}
        </p>
      ) : null}
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent title={copy.chat.delete} className="max-w-[400px]">
          <p className="px-6 pt-2 text-sm leading-5 text-text-secondary">{copy.chat.deleteConfirm}</p>
          <p className="truncate px-6 pt-1 text-sm leading-5 font-medium">{chat.title}</p>
          <div className="flex justify-end gap-2 p-6">
            <Button variant="outline" size="md" onClick={() => setConfirm(false)}>
              {copy.chat.cancel}
            </Button>
            <Button variant="lime" size="md" onClick={() => void remove()}>
              {copy.chat.delete}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </li>
  );
}

function ChatList({ activeChat, searching, onNavigate }: { activeChat?: string; searching: boolean; onNavigate?: () => void }) {
  const { user } = useSession();
  const { data, error, isLoading, mutate: reload } = useChats();
  const [q, setQ] = useState("");
  const term = q.trim().slice(0, 100);
  const found = useSWR<{ chats: Chat[] }>(user && searching && term ? `/api/agent/chats?limit=50&search=${encodeURIComponent(term)}` : null, fetcher);
  const chats = searching && term ? found.data?.chats : data?.chats;

  let body: ReactNode;
  if (user && (isLoading || (searching && term && found.isLoading && !found.data))) {
    body = (
      <ul className="flex flex-col gap-1 px-2 pt-1" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <li key={i} className="shimmer h-8 rounded-lg bg-surface-secondary" />
        ))}
      </ul>
    );
  } else if (user && error) {
    body = (
      <div role="alert" className="flex flex-col items-center gap-2 px-4 pt-8 text-center text-xs leading-[18px] text-text-muted">
        {errorMessage(error) || copy.chatsError}
        <Button size="sm" variant="outline" onClick={() => void reload()}>
          {copy.retry}
        </Button>
      </div>
    );
  } else if (chats && chats.length) {
    body = (
      <ul className="flex flex-col gap-[2px] px-2 pt-1 pb-2" aria-label={copy.nav.chats}>
        {chats.map((c) => (
          <ChatItem key={c.id} chat={c} active={c.id === activeChat} onNavigate={onNavigate} />
        ))}
      </ul>
    );
  } else if (searching && term) {
    body = <p className="px-4 pt-6 text-center text-xs leading-[18px] text-text-muted">{copy.noMatches}</p>;
  } else {
    body = (
      <div className="flex flex-col items-center pt-8 text-center">
        <EmptyStack />
        <p className="mt-3 text-base leading-6 font-semibold tracking-[-0.01em] text-text-primary">{copy.emptyChats.title}</p>
        <p className="text-xs leading-[18px] text-text-muted">{copy.emptyChats.body}</p>
      </div>
    );
  }

  return (
    <>
      {searching ? (
        <div className="px-2 pb-1">
          <label htmlFor="agent-chat-search" className="sr-only">
            {copy.nav.search}
          </label>
          <input
            id="agent-chat-search"
            autoFocus
            type="search"
            value={q}
            maxLength={100}
            onChange={(e) => setQ(e.target.value)}
            placeholder={copy.nav.search}
            className="h-8 w-full rounded-lg border border-border-default bg-surface-field px-3 text-sm leading-5 text-text-primary outline-none placeholder:text-text-tertiary"
          />
        </div>
      ) : null}
      {body}
    </>
  );
}

function Aside() {
  // Closed for good, not just for this visit: see src/lib/closable.ts.
  return (
    <div data-closable="agentGuide" className="flex shrink-0 justify-center [@media(max-height:820px)]:hidden">
      <div
        className="relative flex h-[226px] w-[210px] flex-col items-center justify-center gap-3 overflow-clip rounded-xl border border-border-subtle bg-origin-border"
        style={{ backgroundImage: "linear-gradient(in oklab 180deg, #FFFFFF0A 0%, #FFFFFF1F 100%)" }}
      >
        <div className="flex w-[184px] flex-col gap-1 pl-1">
          <p className="text-xs leading-4 text-text-secondary">{copy.aside.kicker}</p>
          <p className="w-[176px] text-sm leading-5 font-medium text-text-primary">{copy.aside.title}</p>
        </div>
        <div aria-hidden className="relative h-[84px] w-[184px] overflow-clip pt-[18px]">
          <div className="absolute top-[38px] left-[24px] h-[106px] w-[60px] -rotate-[11deg] overflow-clip rounded-xl border border-border-default">
            <Artwork name="agent/guide-1" className="size-full" />
            <div className="absolute inset-0 bg-[#00000099]" />
          </div>
          <div className="absolute top-[34px] left-[106px] h-[106px] w-[60px] rotate-[8.5deg] overflow-clip rounded-xl border border-border-default">
            <Artwork name="agent/guide-2" className="size-full" />
            <div className="absolute inset-0 bg-[#00000099]" />
          </div>
          <div className="absolute top-[26px] left-[60px] h-[134px] w-[76px] overflow-clip rounded-xl border border-border-default">
            <Artwork name="agent/guide-3" className="size-full" />
          </div>
        </div>
        <Link
          href={routes.guide}
          className="flex h-8 w-[184px] items-center justify-center rounded-md border border-border-default bg-border-subtle text-sm leading-4 font-medium text-text-primary backdrop-blur-[12px] transition-colors duration-150 [box-shadow:#FFFFFF0D_0px_2px_3px_inset] hover:bg-border-default"
        >
          {copy.aside.cta}
        </Link>
        <button
          type="button"
          aria-label={copy.aside.close}
          onClick={() => closeForGood("agentGuide")}
          className="absolute top-1 left-[180px] flex size-6 items-center justify-center rounded-sm text-text-secondary transition-colors duration-150 hover:bg-border-subtle hover:text-text-primary"
        >
          <X className="size-4" strokeWidth={1.5} aria-hidden />
        </button>
      </div>
    </div>
  );
}

export function Sidebar({
  active,
  activeChat,
  onCollapse,
  onNavigate,
}: {
  active?: SideId;
  activeChat?: string;
  onCollapse: () => void;
  onNavigate?: () => void;
}) {
  const { member, user } = useSession();
  const [more, setMore] = useState(active === "schedules" || active === "memory");
  const [chatsOpen, setChatsOpen] = useState(true);
  const [searching, setSearching] = useState(false);
  const [login, setLogin] = useState(false);
  const who = useMemo(() => member?.name || member?.email || null, [member]);

  return (
    <nav aria-label={agentName} className="flex h-[calc(100dvh-8px)] w-[224px] flex-col rounded-2xl border border-border-subtle bg-surface-primary">
      {/* Switcher, search and collapse. */}
      <div className="mt-1 flex h-11 shrink-0 items-center justify-center">
        <div className="flex h-11 w-[162px] items-center justify-center rounded-xl">
          <Link
            href={routes.home}
            aria-label={copy.nav.home}
            className="flex h-9 w-[154px] items-center justify-center gap-[9px] rounded-xl bg-border-subtle [box-shadow:#0000000F_0px_2px_8px] transition-colors duration-150 hover:bg-border-default"
          >
            <span className="flex h-5 w-[113px] items-center gap-1">
              <LogoMark size={20} />
              <span className="text-xs leading-5 font-medium text-[#FFFFFFCC]">{agentName}</span>
            </span>
            <ChevronsUpDown className="size-[10px] text-text-secondary" strokeWidth={2} aria-hidden />
          </Link>
        </div>
        <button
          type="button"
          aria-label={copy.nav.search}
          aria-pressed={searching}
          onClick={() => {
            setSearching((s) => !s);
            setChatsOpen(true);
          }}
          className={cn(
            "flex h-8 w-[26px] items-center justify-center rounded-sm text-text-nav transition-colors duration-150 hover:bg-border-subtle hover:text-text-primary",
            searching && "bg-border-subtle text-text-primary",
          )}
        >
          <Search className="size-4" strokeWidth={1.5} aria-hidden />
        </button>
        <button
          type="button"
          aria-label={copy.nav.collapse}
          onClick={onCollapse}
          className="flex h-8 w-[26px] items-center justify-center rounded-sm text-text-nav transition-colors duration-150 hover:bg-border-subtle hover:text-text-primary"
        >
          <PanelLeft className="size-4" strokeWidth={1.5} aria-hidden />
        </button>
      </div>

      {/* Main places. */}
      <div className="mt-[10px] flex shrink-0 flex-col items-center gap-[2px]">
        <NavRow href={agentRoutes.home} icon={Plus} label={copy.nav.newChat} active={active === "new"} onNavigate={onNavigate} />
        <NavRow href={agentRoutes.projects} icon={FolderOpen} label={copy.nav.projects} active={active === "projects"} onNavigate={onNavigate} />
        <NavRow href={agentRoutes.skills} icon={Zap} label={copy.nav.skills} active={active === "skills"} onNavigate={onNavigate} />
        <NavRow href={agentRoutes.connectors} icon={Shapes} label={copy.nav.connectors} active={active === "connectors"} onNavigate={onNavigate} />
        {more ? (
          <>
            <NavRow href={agentRoutes.schedules} icon={CalendarClock} label={copy.nav.schedules} active={active === "schedules"} onNavigate={onNavigate} />
            <NavRow href={agentRoutes.memory} icon={Brain} label={copy.nav.memory} active={active === "memory"} onNavigate={onNavigate} />
          </>
        ) : null}
        <button
          type="button"
          aria-expanded={more}
          onClick={() => setMore((m) => !m)}
          className="flex h-9 w-[206px] shrink-0 items-center gap-2 rounded-xl pl-[6px] text-left text-sm leading-5 font-medium text-text-primary transition-colors duration-150 hover:bg-border-subtle"
        >
          <IconPlate>
            <Ellipsis className="size-4" strokeWidth={1.5} aria-hidden />
          </IconPlate>
          {more ? copy.nav.less : copy.nav.more}
        </button>
      </div>

      {/* Chats. */}
      <div className="mt-[2px] flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 px-2">
          <button
            type="button"
            aria-expanded={chatsOpen}
            onClick={() => setChatsOpen((o) => !o)}
            className="flex h-7 w-full items-center justify-between rounded-md px-[6px] text-xs leading-[18px] font-medium text-text-muted transition-colors duration-150 hover:bg-border-subtle hover:text-text-primary"
          >
            {copy.nav.chats}
            <ChevronDown className={cn("size-4 transition-transform duration-150", !chatsOpen && "-rotate-90")} strokeWidth={1.5} aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto scroll-quiet">
          {chatsOpen ? <ChatList activeChat={activeChat} searching={searching} onNavigate={onNavigate} /> : null}
        </div>
        <Aside />
      </div>

      {/* Pricing and the account. */}
      <div className="flex shrink-0 flex-col items-center gap-2 pt-2 pb-3">
        <Link
          href={routes.pricing}
          className="flex h-8 w-[206px] items-center justify-between rounded-full bg-[#FF005B1A] pr-[7px] pl-3 transition-colors duration-150 hover:bg-[#FF005B33]"
        >
          <span className="flex items-center gap-2 text-sm leading-5 font-medium text-promo">
            <TagIcon className="size-4" strokeWidth={1.5} aria-hidden />
            {copy.nav.pricing}
          </span>
          {pricingBadge ? (
            <span className="flex h-[18px] items-center rounded-full bg-promo px-[6px] text-2xs leading-[14px] font-medium text-text-primary">{pricingBadge}</span>
          ) : null}
        </Link>
        <div className="flex h-9 w-[206px] items-center rounded-md">
          {member ? (
            <Link
              href={routes.settings}
              className="flex h-9 w-[170px] min-w-0 items-center gap-2 rounded-full border border-[#D9D9D90A] pl-3 text-sm leading-5 font-medium text-text-primary transition-colors duration-150 hover:bg-border-subtle"
            >
              <MessageSquare className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
              <span className="min-w-0 truncate pr-3">{who}</span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setLogin(true)}
              className="flex h-9 w-[170px] items-center gap-2 rounded-full border border-[#D9D9D90A] pl-3 text-sm leading-5 font-medium text-text-primary transition-colors duration-150 hover:bg-border-subtle"
            >
              <LogIn className="size-4" strokeWidth={1.5} aria-hidden />
              {copy.nav.logIn}
              {user ? <span className="ml-auto pr-3 text-xs leading-4 font-normal text-text-tertiary">{copy.nav.guest}</span> : null}
            </button>
          )}
          <Link
            href={agentRoutes.memory}
            onClick={onNavigate}
            aria-label={copy.nav.memory}
            className="flex size-9 items-center justify-center rounded-md text-text-nav transition-colors duration-150 hover:bg-border-subtle hover:text-text-primary"
          >
            <Brain className="size-4" strokeWidth={1.5} aria-hidden />
          </Link>
        </div>
      </div>
      <LoginDialog open={login} onOpenChange={setLogin} mode="login" />
    </nav>
  );
}
