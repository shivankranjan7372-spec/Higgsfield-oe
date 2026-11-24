"use client";

import { Building2, Crown, Menu, X } from "lucide-react";
import { Dialog as D } from "radix-ui";
import Link from "next/link";
import { useState } from "react";
import { Logo } from "@/components/brand/logo";
import { navWords } from "@/content/shell";
import { navPrimary, navStudios, pricingBadge, routes, type NavId, type NavLink } from "@/content/site";
import { useSession } from "@/lib/session";
import { cn } from "@/ui";
import { AccountPanel } from "./account-menu";
import { NavTagged } from "./parts";

function PanelLink({ link, active, onDone }: { link: NavLink; active: boolean; onDone: () => void }) {
  return (
    <Link
      href={link.href}
      onClick={onDone}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-10 shrink-0 items-center gap-[6px] rounded-lg px-3 text-sm leading-5 font-medium transition-colors duration-150 hover:bg-border-subtle",
        active ? "text-brand" : link.chrome ? "text-chrome" : "text-text-primary",
      )}
    >
      <NavTagged link={link} />
    </Link>
  );
}

function Heading({ children }: { children: string }) {
  return <div className="flex h-8 items-end px-3 pb-1 text-xs leading-4 font-medium text-text-muted">{children}</div>;
}

/**
 * The menu button both bars show under 900px, and the panel it opens: every nav link, then the
 * sign-in buttons for a visitor or the account rows for a member. Not drawn in the design; it is
 * built from the nav's own parts.
 */
export function MobileMenu({ active, onAsk, size }: { active?: NavId; onAsk: (mode: "login" | "join") => void; size: 24 | 32 }) {
  const [open, setOpen] = useState(false);
  const { member } = useSession();
  const done = () => setOpen(false);
  const ask = (mode: "login" | "join") => {
    setOpen(false);
    onAsk(mode);
  };
  return (
    <D.Root open={open} onOpenChange={setOpen}>
      <D.Trigger
        aria-label={navWords.openMenu}
        className={cn(
          "flex shrink-0 items-center justify-center text-text-primary transition-colors duration-150 hover:bg-border-default min-[900px]:hidden",
          size === 32 ? "size-8 rounded-lg bg-border-subtle [box-shadow:#FFFFFF0D_0px_1.5px_3px_inset]" : "size-6 rounded-md hover:bg-border-subtle",
        )}
      >
        <Menu className="size-4" strokeWidth={1.5} aria-hidden />
      </D.Trigger>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 animate-fade-in bg-scrim" />
        <D.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[380px] animate-fade-in flex-col overflow-y-auto border-l border-border-subtle bg-surface-menu p-3 text-text-primary outline-none scroll-quiet"
        >
          <div className="flex h-10 shrink-0 items-center justify-between pl-3">
            <D.Title className="flex items-center">
              <span className="sr-only">{navWords.panelTitle}</span>
              <Logo size={20} />
            </D.Title>
            <D.Close
              aria-label={navWords.closeMenu}
              className="flex size-8 items-center justify-center rounded-full bg-border-subtle text-text-secondary transition-colors duration-150 hover:bg-border-default hover:text-text-primary"
            >
              <X className="size-4" strokeWidth={1.5} aria-hidden />
            </D.Close>
          </div>

          {member ? null : (
            <div className="flex shrink-0 gap-2 px-1 pt-3 pb-1">
              <button
                type="button"
                onClick={() => ask("login")}
                className="flex h-10 flex-1 items-center justify-center rounded-lg bg-brand-tint text-sm leading-5 font-semibold text-brand [box-shadow:#FFFFFF0D_0px_2px_4px_inset] transition-colors duration-150 hover:bg-brand-chip"
              >
                {navWords.login}
              </button>
              <button
                type="button"
                onClick={() => ask("join")}
                className="flex h-10 flex-1 items-center justify-center rounded-lg bg-brand text-sm leading-5 font-semibold text-text-inverse transition-colors duration-150 hover:bg-brand-glow"
              >
                {navWords.join}
              </button>
            </div>
          )}

          <nav aria-label={navWords.panelTitle} className="flex shrink-0 flex-col">
            <Heading>{navWords.pages}</Heading>
            {navPrimary.map((l) => (
              <PanelLink key={l.id} link={l} active={l.id === active} onDone={done} />
            ))}
            <Heading>{navWords.studios}</Heading>
            {navStudios.map((l) => (
              <PanelLink key={l.id} link={l} active={l.id === active} onDone={done} />
            ))}
            <div className="my-2 h-px shrink-0 bg-border-subtle" />
            <Link
              href={routes.enterprise}
              onClick={done}
              className="flex h-10 items-center gap-2 rounded-lg px-3 text-sm leading-5 font-medium text-text-primary transition-colors duration-150 hover:bg-border-subtle"
            >
              <Building2 className="size-4 text-text-secondary" strokeWidth={1.5} aria-hidden />
              {navWords.enterprise}
            </Link>
            <Link
              href={routes.pricing}
              onClick={done}
              className="flex h-10 items-center gap-2 rounded-lg px-3 text-sm leading-5 font-medium text-brand transition-colors duration-150 hover:bg-border-subtle"
            >
              <Crown className="size-4 fill-current" strokeWidth={1.5} aria-hidden />
              {member ? navWords.upgrade : navWords.pricing}
              {pricingBadge ? <span>{pricingBadge}</span> : null}
            </Link>
          </nav>

          {member ? (
            <div className="mt-2 shrink-0 border-t border-border-subtle pt-3">
              <AccountPanel onDone={done} />
            </div>
          ) : null}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
