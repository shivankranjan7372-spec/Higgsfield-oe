"use client";

import { Bell, ChevronRight, CircleHelp, Coins, Gift, KeyRound, LogOut, MonitorSmartphone, SlidersHorizontal, Trash2, UserRound, Wallet, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Avatar } from "@/components/shell/parts";
import { SIGNUP_CREDITS, formatCredits, planOf } from "@/config/economy";
import { accountNav, walletCopy } from "@/content/account";
import { routes } from "@/content/site";
import { errorMessage } from "@/lib/api";
import { logOut, useSession } from "@/lib/session";
import { cn } from "@/ui";
import { PANEL, ROW_LINE, Skeleton, Status, dots } from "./parts";

export type AccountPage = "settings" | "notifications" | "wallet" | "invite";

interface Item {
  key: string;
  href: string;
  label: string;
  icon: LucideIcon;
  page: AccountPage;
}

const sectionIcons: Record<string, LucideIcon> = {
  profile: UserRound,
  "sign-in": KeyRound,
  sessions: MonitorSmartphone,
  preferences: SlidersHorizontal,
  delete: Trash2,
};

const settingsItems: Item[] = accountNav.sections.map((s) => ({
  key: s.id,
  href: `${routes.settings}#${s.anchor}`,
  label: s.label,
  icon: sectionIcons[s.id] ?? UserRound,
  page: "settings" as const,
}));

const pageItems: Item[] = [
  { key: "notifications", href: `${routes.settings}/notifications`, label: accountNav.notifications, icon: Bell, page: "notifications" },
  { key: "wallet", href: routes.wallet, label: accountNav.wallet, icon: Wallet, page: "wallet" },
  { key: "invite", href: routes.invite, label: accountNav.invite, icon: Gift, page: "invite" },
];

/** Settings rows first, but Delete account goes last, under the pages. */
const allItems: Item[] = [...settingsItems.filter((i) => i.key !== "delete"), ...pageItems, ...settingsItems.filter((i) => i.key === "delete")];

function isCurrent(item: Item, page: AccountPage) {
  return item.page === page && (page !== "settings" || item.key === "profile");
}

/** One row of the side list, drawn like the account menu's link rows. */
function Row({ item, page }: { item: Item; page: AccountPage }) {
  const Icon = item.icon;
  const on = isCurrent(item, page);
  return (
    <Link
      href={item.href}
      aria-current={on ? "page" : undefined}
      className={cn(
        "flex h-8 shrink-0 items-center gap-[10px] rounded-lg pr-3 pl-4 text-sm leading-5 font-medium transition-colors duration-150",
        on ? "bg-border-subtle text-text-primary" : "text-text-primary hover:bg-border-subtle",
      )}
    >
      <Icon className={cn("size-4 shrink-0", on ? "text-brand" : "text-text-secondary", item.key === "delete" && !on && "text-danger")} strokeWidth={1.5} aria-hidden />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function CreditsCard() {
  const { member, user, balance } = useSession();
  const plan = planOf(user?.plan);
  const allowance = (plan.monthlyCredits > 0 ? plan.monthlyCredits : SIGNUP_CREDITS) * 1000;
  const pct = Math.max(0, Math.min(100, Math.round((balance / allowance) * 100)));
  return (
    <section aria-label={walletCopy.balance} className="flex flex-col rounded-2xl bg-border-subtle px-3 pt-3 pb-1">
      <Link href={routes.wallet} className="flex h-5 shrink-0 items-center gap-[6px] rounded-sm">
        <span className="text-sm leading-5 font-medium text-text-primary">{walletCopy.balance}</span>
        <span title={walletCopy.balanceHelp} className="flex text-text-secondary">
          <CircleHelp className="size-[14px]" strokeWidth={1.5} aria-hidden />
        </span>
        <span className="grow" />
        <span className="text-sm leading-5 text-text-secondary tabular-nums">
          {formatCredits(balance)} {walletCopy.left}
        </span>
        <ChevronRight className="size-3 shrink-0 text-text-secondary" strokeWidth={1.5} aria-hidden />
      </Link>
      <div role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`${pct}%`} className="flex items-center pt-[10px] pb-3">
        <div className="h-[5px] rounded-full" style={{ width: `${pct}%`, background: dots("#D1FE17") }} />
        <div className="h-[5px] grow rounded-full" style={{ background: dots("#FFFFFF1A") }} />
      </div>
      <Link href={routes.wallet} className={cn("group flex h-[41px] shrink-0 items-center gap-[10px] text-sm leading-5 font-medium text-text-primary", ROW_LINE)}>
        <Coins className="size-4 shrink-0 text-brand" strokeWidth={1.5} aria-hidden />
        <span className="min-w-0 grow truncate">{walletCopy.packs}</span>
        <span className="flex h-[23px] w-[41px] shrink-0 items-center justify-center rounded-full bg-brand text-xs leading-4 font-semibold text-text-inverse transition-colors duration-150 group-hover:bg-brand-glow">
          Get
        </span>
      </Link>
      {member ? (
        <Link href={routes.invite} className={cn("group flex h-[41px] shrink-0 items-center gap-[10px] text-sm leading-5 font-medium text-text-primary", ROW_LINE)}>
          <Gift className="size-4 shrink-0 text-brand" strokeWidth={1.5} aria-hidden />
          <span className="min-w-0 grow truncate">{accountNav.invite}</span>
          <span className="flex h-[23px] w-[41px] shrink-0 items-center justify-center rounded-full bg-brand text-xs leading-4 font-semibold text-text-inverse transition-colors duration-150 group-hover:bg-brand-glow">
            Get
          </span>
        </Link>
      ) : null}
    </section>
  );
}

function SidePanel({ page }: { page: AccountPage }) {
  const { user, loading } = useSession();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const name = user ? user.name || user.handle || user.email || "" : "";
  const planLabel = user ? (user.isGuest ? accountNav.guestPlan : `${planOf(user.plan).name} ${accountNav.planSuffix}`) : "";

  const out = async () => {
    setBusy(true);
    setProblem(null);
    try {
      await logOut();
      router.push(routes.home);
    } catch (e) {
      setProblem(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <div className={cn("flex w-[290px] flex-col gap-2 p-[6px]", PANEL)}>
      {loading ? (
        <div className="flex h-[54px] items-center gap-3 pr-[10px] pl-2">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex grow flex-col gap-1">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
      ) : user ? (
        <Link
          href={!user.isGuest && user.handle ? `${routes.profile}/${user.handle}` : `${routes.settings}#profile`}
          className="flex h-[54px] shrink-0 items-center gap-3 rounded-2xl pr-[10px] pl-2 transition-colors duration-150 hover:bg-border-subtle"
        >
          <Avatar name={name} url={user.avatarUrl} size={40} />
          <span className="flex min-w-0 grow flex-col">
            <span className="truncate text-sm leading-5 font-medium text-text-primary">{name}</span>
            <span className="truncate text-sm leading-5 text-text-secondary">{planLabel}</span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-text-secondary" strokeWidth={1.5} aria-hidden />
        </Link>
      ) : null}
      {user ? <CreditsCard /> : null}
      <nav aria-label={accountNav.label} className="flex flex-col pt-[2px]">
        {allItems.map((item) => (
          <Row key={item.key} item={item} page={page} />
        ))}
      </nav>
      {user ? (
        <>
          <button
            type="button"
            onClick={out}
            disabled={busy}
            className={cn(
              "flex h-[41px] shrink-0 items-center gap-[10px] pr-3 pl-4 text-left text-sm leading-5 font-medium text-text-primary transition-colors duration-150 hover:bg-border-subtle disabled:opacity-40",
              ROW_LINE,
            )}
          >
            <LogOut className="size-4 shrink-0 text-text-secondary" strokeWidth={1.5} aria-hidden />
            Sign out
          </button>
          {problem ? (
            <div className="px-4 pb-2">
              <Status error={problem} />
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/** On a phone the side list becomes one row of chips that scrolls inside itself. */
function ChipNav({ page }: { page: AccountPage }) {
  return (
    <nav aria-label={accountNav.label} className="scroll-none -mx-4 flex gap-2 overflow-x-auto px-4">
      {allItems.map((item) => {
        const Icon = item.icon;
        const on = isCurrent(item, page);
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={on ? "page" : undefined}
            className={cn(
              "flex h-8 shrink-0 items-center gap-[6px] rounded-full px-3 text-sm leading-5 font-medium whitespace-nowrap transition-colors duration-150",
              on ? "bg-border-default text-text-primary" : "bg-border-subtle text-text-primary hover:bg-border-default",
            )}
          >
            <Icon className={cn("size-4", on ? "text-brand" : "text-text-secondary")} strokeWidth={1.5} aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * The frame every account page shares: the side list of sections on the left (drawn like the
 * account menu), the page's cards on the right. On a phone the list is a row of chips on top.
 */
export function AccountFrame({ page, title, lead, children }: { page: AccountPage; title: string; lead?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-[1088px] flex-col gap-4 px-4 pt-4 pb-16 lg:flex-row lg:items-start lg:gap-6 lg:pt-8">
      <aside className="hidden shrink-0 lg:sticky lg:top-6 lg:block">
        <SidePanel page={page} />
      </aside>
      <div className="lg:hidden">
        <ChipNav page={page} />
      </div>
      <div className="flex min-w-0 grow flex-col gap-3">
        <header className="flex flex-col gap-1 pb-1">
          <h1 className="text-xl leading-7 font-semibold tracking-[-0.01em] text-text-primary">{title}</h1>
          {lead ? <div className="text-sm leading-5 text-text-secondary">{lead}</div> : null}
        </header>
        {children}
      </div>
    </div>
  );
}
