"use client";

import { Building2, Crown, Folder, Gift, Languages, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { LogoMark } from "@/components/brand/logo";
import { LoginDialog } from "@/components/entry/login-dialog";
import { SearchDialog } from "@/components/entry/search-dialog";
import { brand } from "@/config/brand";
import { navPrimary, navStudios, pricingBadge, routes, type NavId, type NavLink } from "@/content/site";
import { useSession } from "@/lib/session";
import { AccountMenu } from "./account-menu";
import { Bell } from "./bell";
import { MobileMenu } from "./mobile-menu";
import { Button, MenuItem, MenuLabel, Popover, PopoverContent, PopoverTrigger, Tag, cn, iconButtonClass } from "@/ui";

function NavItem({ link, active }: { link: NavLink; active: boolean }) {
  return (
    <Link
      href={link.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-7 shrink-0 items-center rounded-md px-2 text-sm leading-5 font-medium whitespace-nowrap transition-colors duration-150 focus-visible:-outline-offset-2",
        link.tag && "gap-1",
        active ? "text-brand" : link.chrome ? "text-chrome hover:opacity-80" : "text-text-idle hover:text-text-tab",
      )}
    >
      {link.label}
      {link.tag ? <Tag tone={link.tag.tone}>{link.tag.label}</Tag> : null}
    </Link>
  );
}

/* No display class here on purpose: each use sets its own, because nothing merges classes. */
const quietLink = "h-6 shrink-0 items-center gap-[6px] rounded-md text-sm leading-5 font-medium whitespace-nowrap transition-colors duration-150";

/** Opens the search window over the page. */
function SearchButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" aria-label="Search" onClick={() => setOpen(true)} className={iconButtonClass(24, "dim")}>
        <Search className="size-4" strokeWidth={1.5} aria-hidden />
      </button>
      <SearchDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

function EnterpriseLink() {
  return (
    <Link href={routes.enterprise} className={cn(quietLink, "hidden text-text-idle hover:text-text-tab lg:inline-flex")}>
      <Building2 className="size-[14px]" strokeWidth={1.5} aria-hidden />
      Enterprise
    </Link>
  );
}

function PlansLink({ label }: { label: string }) {
  return (
    <Link href={routes.pricing} className={cn(quietLink, "inline-flex text-brand hover:opacity-80")}>
      <Crown className="size-[14px] fill-current" strokeWidth={1.5} aria-hidden />
      <span className="flex items-center gap-1">
        {label}
        {pricingBadge ? <span>{pricingBadge}</span> : null}
      </span>
    </Link>
  );
}

/** The app is in English only for now, and says so. */
function LanguageButton() {
  return (
    <span className="hidden sm:inline-flex">
      <Popover>
        <PopoverTrigger aria-label="Language" className={iconButtonClass(24, "dim")}>
          <Languages className="size-4" strokeWidth={1.5} aria-hidden />
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[200px]">
          <MenuLabel>Language</MenuLabel>
          <MenuItem selected>English</MenuItem>
          <p className="px-2 pt-1 pb-2 text-xs leading-4 text-text-secondary">More languages are on the way.</p>
        </PopoverContent>
      </Popover>
    </span>
  );
}

/** Login and Get started open the sign-in window over the page, so nobody loses their place. */
function VisitorCluster({ active }: { active?: NavId }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"login" | "join">("login");
  const ask = (next: "login" | "join") => {
    setMode(next);
    setOpen(true);
  };
  return (
    <div className="flex shrink-0 items-center gap-2">
      <div className="flex items-center gap-3">
        <SearchButton />
        <LanguageButton />
        <EnterpriseLink />
        <span className="hidden min-[900px]:inline-flex">
          <PlansLink label="Pricing" />
        </span>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="tint" size="xs" onClick={() => ask("login")}>
          Login
        </Button>
        <span className="hidden sm:inline-flex">
          <Button variant="lime" size="xs" onClick={() => ask("join")}>
            Get started
          </Button>
        </span>
        <MobileMenu active={active} onAsk={ask} size={24} />
      </div>
      <LoginDialog open={open} onOpenChange={setOpen} mode={mode} />
    </div>
  );
}

function MemberCluster({ active }: { active?: NavId }) {
  return (
    <div className="flex shrink-0 items-center gap-3">
      <SearchButton />
      <Bell size={16} className={iconButtonClass(24, "dim")} />
      <span className="hidden items-center gap-3 min-[900px]:inline-flex">
        <Link href={routes.library} aria-label="Library" className={iconButtonClass(24, "dim")}>
          <Folder className="size-4 fill-current" strokeWidth={1.5} aria-hidden />
        </Link>
        <Link href={routes.invite} aria-label="Invite a friend, earn credits" className={iconButtonClass(28, "lime", "relative")}>
          <Gift className="size-4" strokeWidth={1.5} aria-hidden />
          <span aria-hidden className="absolute top-[3px] right-[3px] size-[6px] rounded-full bg-brand ring-2 ring-page" />
        </Link>
      </span>
      <EnterpriseLink />
      <span className="hidden min-[900px]:inline-flex">
        <PlansLink label="Upgrade" />
      </span>
      <AccountMenu size={24} />
      <MobileMenu active={active} onAsk={() => {}} size={24} />
    </div>
  );
}

/**
 * The 44px app nav: logo, the page links, and the account cluster on the right.
 * Pass `active` to light the current page. Guests and visitors see Login and Get started;
 * members see their shortcuts and avatar.
 */
export function CompactNav({ active }: { active?: NavId }) {
  const { member } = useSession();
  return (
    <header className="flex h-11 shrink-0 items-start">
      <nav aria-label="Main" className="flex h-9 w-full items-center gap-3 px-4">
        <Link href={routes.home} aria-label={`${brand.name} home`} className="shrink-0 rounded-sm">
          <LogoMark size={20} />
        </Link>
        <div className="hidden h-7 min-w-0 flex-1 items-center overflow-x-auto scroll-none min-[900px]:flex">
          {navPrimary.map((link) => (
            <NavItem key={link.id} link={link} active={link.id === active} />
          ))}
          <span aria-hidden className="mx-1 h-3 w-px shrink-0 bg-border-default" />
          {navStudios.map((link) => (
            <NavItem key={link.id} link={link} active={link.id === active} />
          ))}
        </div>
        <span className="flex-1 min-[900px]:hidden" />
        {member ? <MemberCluster active={active} /> : <VisitorCluster active={active} />}
      </nav>
    </header>
  );
}
