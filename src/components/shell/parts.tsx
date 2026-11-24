"use client";

import { Building2, Crown, Languages, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { SearchDialog } from "@/components/entry/search-dialog";
import { pricingBadge, routes, type NavLink } from "@/content/site";
import { navWords } from "@/content/shell";
import { MenuItem, MenuLabel, Popover, PopoverContent, PopoverTrigger, Tag, cn } from "@/ui";

/** The 32px grey plate the full nav draws behind its right-hand icons and links. */
export const plate =
  "rounded-lg bg-border-subtle text-text-primary [box-shadow:#FFFFFF0D_0px_1.5px_3px_inset] transition-colors duration-150 hover:bg-border-default";

/** A square 32px plate holding one 16px icon. */
export const plateIcon = cn("flex size-8 shrink-0 items-center justify-center", plate);

/** Text of a nav link in the 52px bar: idle grey, white while its menu is open, lime when current. */
export function navTextClass({ active, open, chrome }: { active?: boolean; open?: boolean; chrome?: boolean }) {
  if (open) return "bg-border-subtle text-text-primary";
  if (active) return "text-brand";
  if (chrome) return "text-chrome hover:opacity-80";
  return "text-text-nav hover:text-text-primary";
}

export function NavTagged({ link }: { link: NavLink }) {
  return (
    <>
      {link.label}
      {link.tag ? <Tag tone={link.tag.tone}>{link.tag.label}</Tag> : null}
    </>
  );
}

/** The search icon; opens the shared search window. */
export function SearchPlate() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" aria-label={navWords.search} onClick={() => setOpen(true)} className={plateIcon}>
        <Search className="size-4" strokeWidth={1.5} aria-hidden />
      </button>
      <SearchDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

/** The app is in English only for now, and says so. */
export function LanguagePlate() {
  return (
    <Popover>
      <PopoverTrigger aria-label={navWords.language} className={plateIcon}>
        <Languages className="size-4" strokeWidth={1.5} aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[200px]">
        <MenuLabel>{navWords.language}</MenuLabel>
        <MenuItem selected>{navWords.english}</MenuItem>
        <p className="px-2 pt-1 pb-2 text-xs leading-4 text-text-secondary">{navWords.languageNote}</p>
      </PopoverContent>
    </Popover>
  );
}

export function EnterprisePlate() {
  return (
    <Link href={routes.enterprise} className={cn("flex h-8 shrink-0 items-center gap-2 px-[10px] text-xs leading-4 font-medium whitespace-nowrap", plate)}>
      <Building2 className="size-[14px]" strokeWidth={1.5} aria-hidden />
      {navWords.enterprise}
    </Link>
  );
}

/** "Pricing" or "Upgrade", with the yearly saving hanging under it in the pink tab, as drawn. */
export function PricingPlate({ label }: { label: string }) {
  return (
    <Link
      href={routes.pricing}
      className={cn("relative flex h-8 shrink-0 items-center gap-2 pr-[10px] pl-[10px] text-xs leading-4 font-medium whitespace-nowrap", plate)}
    >
      <Crown className="size-[14px] fill-current" strokeWidth={1.5} aria-hidden />
      {label}
      {pricingBadge ? (
        <span
          className="absolute top-[26px] left-[11px] flex h-[15px] items-center rounded-[2px] px-[3px] font-display text-xs leading-[14px] font-bold whitespace-nowrap text-text-primary uppercase"
          style={{ backgroundImage: "radial-gradient(ellipse 39.43% 136.54% at 51.64% 117.31% in oklab, #EE4596 0%, #ED2D84 50%, #ED1572 100%)" }}
        >
          {pricingBadge}
        </span>
      ) : null}
    </Link>
  );
}

/** Login and Get started in the 52px bar. */
export function LoginButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-8 shrink-0 items-center justify-center rounded-lg bg-brand-tint px-[10px] text-xs leading-4 font-semibold whitespace-nowrap text-brand [box-shadow:#FFFFFF0D_0px_2px_4px_inset] transition-colors duration-150 hover:bg-brand-chip"
    >
      {navWords.login}
    </button>
  );
}

export function JoinButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-8 shrink-0 items-center justify-center rounded-lg bg-brand px-[10px] text-xs leading-4 font-semibold whitespace-nowrap text-text-inverse transition-colors duration-150 hover:bg-brand-glow active:bg-brand-pressed",
        className ?? "flex",
      )}
    >
      {navWords.join}
    </button>
  );
}

/** The round picture or initial that stands for the member. */
export function Avatar({ name, url, size }: { name: string; url: string | null; size: 24 | 32 | 40 }) {
  const box = size === 24 ? "size-6 text-2xs leading-3" : size === 32 ? "size-8 text-xs leading-4" : "size-10 text-sm leading-5";
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-clip rounded-full bg-surface-elevated font-semibold text-text-primary uppercase",
        box,
      )}
    >
      {url ? (
        // Served by our own API behind the session cookie, so the image optimizer can't fetch it.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="size-full object-cover" />
      ) : (
        name.trim().charAt(0) || "·"
      )}
    </span>
  );
}

/** Login dialog state shared by a bar and its small-screen panel. */
export function useAsk() {
  const [state, setState] = useState<{ open: boolean; mode: "login" | "join" }>({ open: false, mode: "login" });
  return {
    open: state.open,
    mode: state.mode,
    ask: (mode: "login" | "join") => setState({ open: true, mode }),
    setOpen: (open: boolean) => setState((s) => ({ ...s, open })),
  };
}
