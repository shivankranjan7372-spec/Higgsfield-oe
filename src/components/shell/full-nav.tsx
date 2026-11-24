"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { LogoMark } from "@/components/brand/logo";
import { LoginDialog } from "@/components/entry/login-dialog";
import { navWords, type MenuId } from "@/content/shell";
import { navPrimary, navStudios, routes, type NavId, type NavLink } from "@/content/site";
import { useSession } from "@/lib/session";
import { cn } from "@/ui";
import { AccountMenu } from "./account-menu";
import { Bell } from "./bell";
import { MobileMenu } from "./mobile-menu";
import { NavMenuPanel } from "./nav-menu";
import {
  EnterprisePlate,
  JoinButton,
  LanguagePlate,
  LoginButton,
  NavTagged,
  PricingPlate,
  SearchPlate,
  navTextClass,
  plateIcon,
  useAsk,
} from "./parts";

const MENUS: ReadonlySet<string> = new Set<MenuId>(["image", "video", "audio"]);
const isMenu = (id: NavId): id is MenuId => MENUS.has(id);

const itemBase =
  "inline-flex h-7 shrink-0 items-center rounded-md px-2 text-sm leading-5 font-medium whitespace-nowrap transition-colors duration-150 focus-visible:-outline-offset-2";

function links(panel: HTMLElement | null): HTMLAnchorElement[] {
  return panel ? Array.from(panel.querySelectorAll("a")) : [];
}

/**
 * The 52px bar on the home and marketing pages.
 * Image, Video and Audio open the big menus on hover, click or the keyboard; Escape closes them
 * and gives focus back. Under 900px the links fold into the menu button. `active` is the contract;
 * `AppShell` passes it.
 */
export function FullNav({ active }: { active?: NavId }) {
  const { member } = useSession();
  const login = useAsk();
  const [open, setOpen] = useState<MenuId | null>(null);
  const headerRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggers = useRef<Partial<Record<MenuId, HTMLButtonElement | null>>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusFirst = useRef(false);
  const via = useRef<"hover" | "click">("click");

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const later = (fn: () => void, ms: number) => {
    clear();
    timer.current = setTimeout(fn, ms);
  };
  const openRef = useRef<MenuId | null>(null);
  useEffect(() => {
    openRef.current = open;
  }, [open]);
  const close = useCallback((refocus: boolean) => {
    const was = openRef.current;
    setOpen(null);
    if (refocus && was) triggers.current[was]?.focus();
  }, []);

  // While a menu is open: Escape closes it, and so does a press anywhere outside the bar.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close(true);
      }
    };
    const onDown = (e: PointerEvent) => {
      if (!headerRef.current?.contains(e.target as Node)) close(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open, close]);

  // Opened from the keyboard: put focus on the first row.
  useEffect(() => {
    if (open && focusFirst.current) {
      focusFirst.current = false;
      links(panelRef.current)[0]?.focus();
    }
  }, [open]);

  useEffect(() => clear, []);

  const onTriggerKey = (id: MenuId) => (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusFirst.current = true;
      if (open === id) links(panelRef.current)[0]?.focus();
      else setOpen(id);
    }
  };

  const onPanelKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const all = links(panelRef.current);
    const at = all.indexOf(document.activeElement as HTMLAnchorElement);
    if (at < 0) return;
    e.preventDefault();
    const next = e.key === "ArrowDown" ? Math.min(all.length - 1, at + 1) : at - 1;
    if (next < 0) {
      if (open) triggers.current[open]?.focus();
    } else all[next]?.focus();
  };

  const item = (link: NavLink) => {
    const tagGap = link.tag ? (link.tag.tone === "brand" ? "gap-[5px]" : "gap-1") : null;
    if (isMenu(link.id)) {
      const id = link.id;
      const isOpen = open === id;
      return (
        <button
          key={link.id}
          type="button"
          ref={(el) => {
            triggers.current[id] = el;
          }}
          aria-expanded={isOpen}
          aria-controls={isOpen ? `nav-menu-${id}` : undefined}
          aria-current={link.id === active ? "page" : undefined}
          onClick={() => {
            clear();
            // A press right after hover opened the menu keeps it open instead of closing it.
            if (isOpen && via.current === "hover") via.current = "click";
            else {
              via.current = "click";
              setOpen(isOpen ? null : id);
            }
          }}
          onKeyDown={onTriggerKey(id)}
          onPointerEnter={(e) => {
            if (e.pointerType !== "mouse") return;
            if (open === id) clear();
            else
              later(() => {
                via.current = "hover";
                setOpen(id);
              }, open ? 0 : 90);
          }}
          onPointerLeave={(e) => {
            if (e.pointerType === "mouse") later(() => setOpen(null), 160);
          }}
          className={cn(itemBase, tagGap, navTextClass({ active: link.id === active, open: isOpen }))}
        >
          <NavTagged link={link} />
        </button>
      );
    }
    return (
      <Link
        key={link.id}
        href={link.href}
        aria-current={link.id === active ? "page" : undefined}
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse" && open) later(() => setOpen(null), 120);
        }}
        className={cn(itemBase, tagGap, navTextClass({ active: link.id === active, chrome: link.chrome }))}
      >
        <NavTagged link={link} />
      </Link>
    );
  };

  const openLabel = open ? navPrimary.find((l) => l.id === open)?.label ?? open : "";

  return (
    <header ref={headerRef} className="relative z-40 flex h-[52px] shrink-0 items-center gap-3 bg-page px-4">
      <Link href={routes.home} aria-label={navWords.home} className="shrink-0 rounded-md">
        <LogoMark size={32} />
      </Link>

      <nav aria-label="Main" className="hidden h-7 min-w-0 flex-1 items-center overflow-x-auto scroll-none min-[900px]:flex">
        {navPrimary.map(item)}
        <span aria-hidden className="mx-1 h-3 w-px shrink-0 bg-border-default" />
        {navStudios.map(item)}
      </nav>
      <span className="flex-1 min-[900px]:hidden" />

      {member ? (
        <div className="flex shrink-0 items-center gap-1">
          <SearchPlate />
          <Bell size={16} className={plateIcon} />
          <span className="hidden lg:flex">
            <EnterprisePlate />
          </span>
          <span className="hidden min-[900px]:flex">
            <PricingPlate label={navWords.upgrade} />
          </span>
          <span className="ml-1 flex">
            <AccountMenu size={32} />
          </span>
          <MobileMenu active={active} onAsk={login.ask} size={32} />
        </div>
      ) : (
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex items-center gap-1">
            <SearchPlate />
            <span className="hidden min-[900px]:flex">
              <LanguagePlate />
            </span>
            <span className="hidden lg:flex">
              <EnterprisePlate />
            </span>
            <span className="hidden min-[900px]:flex">
              <PricingPlate label={navWords.pricing} />
            </span>
          </div>
          <div className="flex items-center gap-1">
            <LoginButton onClick={() => login.ask("login")} />
            <JoinButton onClick={() => login.ask("join")} className="hidden sm:flex" />
            <MobileMenu active={active} onAsk={login.ask} size={32} />
          </div>
        </div>
      )}

      {open ? (
        <div
          className="absolute top-10 left-4 z-40 pt-2"
          onPointerEnter={(e) => {
            if (e.pointerType === "mouse") clear();
          }}
          onPointerLeave={(e) => {
            if (e.pointerType === "mouse") later(() => setOpen(null), 160);
          }}
          onKeyDown={onPanelKey}
          onBlur={(e) => {
            const to = e.relatedTarget as Node | null;
            if (to && !e.currentTarget.contains(to) && !Object.values(triggers.current).some((t) => t === to)) close(false);
          }}
        >
          <NavMenuPanel ref={panelRef} id={open} domId={`nav-menu-${open}`} label={navWords.menuOf(openLabel)} onPick={() => close(false)} />
        </div>
      ) : null}

      <LoginDialog open={login.open} onOpenChange={login.setOpen} mode={login.mode} />
    </header>
  );
}
