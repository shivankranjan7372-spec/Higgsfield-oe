"use client";

import { ChevronRight, CircleHelp, Coins, Crown, Folder, Gift, LogOut, Settings, Sparkles, UserRound, BookOpen } from "lucide-react";
import { Popover as P } from "radix-ui";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { PLANS, SIGNUP_CREDITS, formatCredits, planOf } from "@/config/economy";
import { accountWords, navWords } from "@/content/shell";
import { routes } from "@/content/site";
import { errorMessage } from "@/lib/api";
import { logOut, useSession } from "@/lib/session";
import { cn } from "@/ui";
import { Avatar } from "./parts";

const TOP_PLAN = Object.values(PLANS).reduce((a, b) => (b.priceUsd > a.priceUsd ? b : a));

/** One dotted run of the credits meter. */
function dots(color: string) {
  return `repeating-linear-gradient(90deg, ${color} 0px, ${color} 5px, transparent 5px, transparent 7.7px)`;
}

function Row({ href, icon, children, onDone }: { href: string; icon: ReactNode; children: ReactNode; onDone?: () => void }) {
  return (
    <Link
      href={href}
      onClick={onDone}
      className="flex h-8 shrink-0 items-center gap-[10px] rounded-lg pr-3 pl-4 text-sm leading-5 font-medium text-text-primary transition-colors duration-150 hover:bg-border-subtle"
    >
      <span className="flex size-4 shrink-0 items-center justify-center text-text-secondary">{icon}</span>
      {children}
    </Link>
  );
}

function GetRow({ href, icon, label, onDone }: { href: string; icon: ReactNode; label: string; onDone?: () => void }) {
  return (
    <Link
      href={href}
      onClick={onDone}
      className="group flex h-[41px] shrink-0 items-center gap-[10px] border-t border-[#FFFFFF14] text-sm leading-5 font-medium text-text-primary"
    >
      <span className="flex size-4 shrink-0 items-center justify-center text-brand">{icon}</span>
      <span className="min-w-0 grow truncate">{label}</span>
      <span className="flex h-[23px] w-[41px] shrink-0 items-center justify-center rounded-full bg-brand text-xs leading-4 font-semibold text-text-inverse transition-colors duration-150 group-hover:bg-brand-glow">
        {accountWords.get}
      </span>
    </Link>
  );
}

/**
 * Everything in the account menu, for a member: who they are, their credits, where to top up,
 * and the account pages. Used in the avatar popover and in the small-screen panel.
 */
export function AccountPanel({ onDone }: { onDone?: () => void }) {
  const { member, balance } = useSession();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  if (!member) return null;

  const name = member.name || member.handle || member.email || "";
  const plan = planOf(member.plan);
  const allowance = (plan.monthlyCredits > 0 ? plan.monthlyCredits : SIGNUP_CREDITS) * 1000;
  const pct = Math.max(0, Math.min(100, Math.round((balance / allowance) * 100)));

  const out = async () => {
    setBusy(true);
    setProblem(null);
    try {
      await logOut();
      onDone?.();
    } catch (e) {
      setProblem(errorMessage(e) || accountWords.logOutFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Link
        href={member.handle ? `${routes.profile}/${member.handle}` : routes.settings}
        onClick={onDone}
        className="flex h-[54px] shrink-0 items-center gap-3 rounded-2xl pr-[10px] pl-2 transition-colors duration-150 hover:bg-border-subtle"
      >
        <Avatar name={name} url={member.avatarUrl} size={40} />
        <span className="flex min-w-0 grow flex-col">
          <span className="truncate text-sm leading-5 font-medium text-text-primary">{name}</span>
          <span className="truncate text-sm leading-5 text-text-secondary">{accountWords.plan(plan.name)}</span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-text-secondary" strokeWidth={1.5} aria-hidden />
      </Link>

      <section aria-label={accountWords.creditsHeading} className="flex flex-col rounded-2xl bg-border-subtle px-3 pt-3 pb-1">
        <Link href={routes.wallet} onClick={onDone} className="flex h-5 shrink-0 items-center gap-[6px] rounded-sm">
          <span className="text-sm leading-5 font-medium text-text-primary">{accountWords.creditsHeading}</span>
          <span title={accountWords.creditsHint} className="flex text-text-secondary">
            <CircleHelp className="size-[14px]" strokeWidth={1.5} aria-hidden />
          </span>
          <span className="grow" />
          <span className="text-sm leading-5 text-text-secondary tabular-nums" data-balance={balance}>
            {accountWords.left(formatCredits(balance))}
          </span>
          <ChevronRight className="size-3 shrink-0 text-text-secondary" strokeWidth={1.5} aria-hidden />
        </Link>
        <div
          role="meter"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label={accountWords.meter(pct)}
          className="flex items-center pt-[10px] pb-3"
        >
          <div className="h-[5px] rounded-full" style={{ width: `${pct}%`, background: dots("#D1FE17") }} />
          <div className="h-[5px] grow rounded-full" style={{ background: dots("#FFFFFF1A") }} />
        </div>
        <GetRow href={routes.wallet} icon={<Coins className="size-4" strokeWidth={1.5} aria-hidden />} label={accountWords.topUp} onDone={onDone} />
        <GetRow
          href={routes.pricing}
          icon={<Crown className="size-4 fill-current" strokeWidth={1.5} aria-hidden />}
          label={plan.id === TOP_PLAN.id ? accountWords.changePlan : accountWords.upgrade}
          onDone={onDone}
        />
      </section>

      <nav aria-label={navWords.account} className="flex flex-col pt-[2px]">
        {member.handle ? (
          <Row href={`${routes.profile}/${member.handle}`} icon={<UserRound className="size-4" strokeWidth={1.5} aria-hidden />} onDone={onDone}>
            {accountWords.viewProfile}
          </Row>
        ) : null}
        <Row href={routes.settings} icon={<Settings className="size-4" strokeWidth={1.5} aria-hidden />} onDone={onDone}>
          {accountWords.settings}
        </Row>
        <Row href={routes.library} icon={<Folder className="size-4" strokeWidth={1.5} aria-hidden />} onDone={onDone}>
          {accountWords.library}
        </Row>
        <Row href={routes.invite} icon={<Gift className="size-4" strokeWidth={1.5} aria-hidden />} onDone={onDone}>
          {accountWords.invite}
        </Row>
        <Row href={routes.whatsNew} icon={<Sparkles className="size-4" strokeWidth={1.5} aria-hidden />} onDone={onDone}>
          {accountWords.whatsNew}
        </Row>
        <Row href={routes.guide} icon={<BookOpen className="size-4" strokeWidth={1.5} aria-hidden />} onDone={onDone}>
          {accountWords.help}
        </Row>
      </nav>

      <div className="flex flex-col border-t border-[#FFFFFF14]">
        <button
          type="button"
          onClick={out}
          disabled={busy}
          className="mt-1 flex h-8 shrink-0 items-center gap-[10px] rounded-lg pr-3 pl-4 text-left text-sm leading-5 font-medium text-text-primary transition-colors duration-150 hover:bg-border-subtle disabled:opacity-60"
        >
          <LogOut className="size-4 shrink-0 text-text-secondary" strokeWidth={1.5} aria-hidden />
          {busy ? accountWords.loggingOut : accountWords.logOut}
        </button>
        {problem ? (
          <p role="alert" className="px-4 pt-1 pb-1 text-xs leading-4 text-danger">
            {problem}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** The avatar in either bar. It opens the account menu drawn in the design (290px wide). */
export function AccountMenu({ size }: { size: 24 | 32 }) {
  const { member } = useSession();
  const [open, setOpen] = useState(false);
  if (!member) return null;
  const name = member.name || member.handle || member.email || "";
  return (
    <P.Root open={open} onOpenChange={setOpen}>
      <P.Trigger aria-label={navWords.account} className={cn("shrink-0 rounded-full", open && "ring-2 ring-brand")}>
        <Avatar name={name} url={member.avatarUrl} size={size} />
      </P.Trigger>
      <P.Portal>
        <P.Content
          align="end"
          sideOffset={8}
          collisionPadding={8}
          aria-label={navWords.account}
          className="z-50 flex max-h-[calc(100dvh-64px)] w-[290px] animate-rise-in flex-col overflow-y-auto rounded-3xl border border-[#FFFFFF14] bg-[#1C1E20F2] p-[6px] text-text-primary outline-none [box-shadow:#00000066_0px_16px_40px] backdrop-blur-[32px] scroll-quiet"
        >
          <AccountPanel onDone={() => setOpen(false)} />
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}
