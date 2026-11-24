"use client";

import { CircleHelp, Coins, Crown, Receipt, Ticket } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import useSWR from "swr";
import useSWRInfinite from "swr/infinite";
import { SIGNUP_CREDITS, formatCredits } from "@/config/economy";
import { common, gate, walletCopy as c } from "@/content/account";
import { routes } from "@/content/site";
import { api, errorMessage, fetcher } from "@/lib/api";
import { refreshSession, setBalance, useSession } from "@/lib/session";
import { Button, ButtonLink, Tag, cn } from "@/ui";
import { AccountFrame } from "./frame";
import { Card, FIELD, GuestBanner, LoadError, LoadingCard, PillButton, ROW_LINE, SignInCard, Skeleton, Status, dots, formatDate, formatDateTime, formatUsd } from "./parts";

interface LedgerEntry {
  id: number;
  kind: string;
  amount: number;
  note: string;
  jobId: string | null;
  createdAt: number;
}
interface Wallet {
  balance: number;
  plan: { id: string; name: string; concurrency: number; monthlyCredits: number; priceUsd: number };
  packs: { id: string; credits: number; priceUsd: number }[];
  demoBilling: boolean;
  history: LedgerEntry[];
}
interface Subscription {
  planId: string;
  plan: { id: string; name: string; monthlyCredits: number; concurrency: number; rank: number };
  interval: "month" | "year" | null;
  status: "free" | "active" | "canceling";
  currentPeriodEnd: number | null;
  renewsAt: number | null;
  nextChargeCents: number | null;
  pendingChange: { planId: string; planName: string; interval: string; startsAt: number } | null;
  monthlyCredits: { amount: number; nextGrantAt: number | null } | null;
  demoBilling: boolean;
}
interface ReceiptRow {
  id: string;
  number: string;
  demo: boolean;
  planName: string;
  amountCents: number;
  description: string;
  status: string;
  createdAt: number;
}
interface Usage {
  totals: { spent: number; granted: number; toppedUp: number; generations: number; failed: number };
  perDay: { date: string; spent: number; generations: number }[];
  perKind: { kind: string; spent: number; generations: number }[];
}

const PAGE = 25;

// ── Balance and plan ────────────────────────────────────────────────

function BalanceCard({ wallet }: { wallet: Wallet }) {
  const allowance = (wallet.plan.monthlyCredits > 0 ? wallet.plan.monthlyCredits : SIGNUP_CREDITS) * 1000;
  const pct = Math.max(0, Math.min(100, Math.round((wallet.balance / allowance) * 100)));
  return (
    <section aria-label={c.balance} className="flex min-w-0 flex-col rounded-2xl bg-border-subtle px-3 pt-3 pb-3">
      <div className="flex h-5 items-center gap-[6px]">
        <h2 className="text-sm leading-5 font-medium text-text-primary">{c.balance}</h2>
        <span title={c.balanceHelp} className="flex text-text-secondary">
          <CircleHelp className="size-[14px]" strokeWidth={1.5} aria-hidden />
        </span>
      </div>
      <p className="pt-3 text-4xl leading-10 font-medium tracking-[-0.0333em] text-text-primary tabular-nums" data-testid="wallet-balance">
        {formatCredits(wallet.balance)} <span className="text-sm leading-5 font-normal tracking-normal text-text-secondary">{c.left}</span>
      </p>
      <div role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`${pct}%`} className="flex items-center pt-[10px] pb-3">
        <div className="h-[5px] rounded-full" style={{ width: `${pct}%`, background: dots("#D1FE17") }} />
        <div className="h-[5px] grow rounded-full" style={{ background: dots("#FFFFFF1A") }} />
      </div>
      <p className="text-xs leading-4 text-text-secondary">{c.balanceHelp}</p>
    </section>
  );
}

function PlanCard() {
  const { data, error, isLoading, mutate } = useSWR<{ subscription: Subscription; balance: number }>("/api/billing/subscription", fetcher);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const act = async (path: string) => {
    setBusy(true);
    setProblem(null);
    try {
      await api(path, { method: "POST" });
      await mutate();
    } catch (e) {
      setProblem(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  if (isLoading) return <LoadingCard rows={2} />;
  if (error || !data) return <LoadError message={errorMessage(error)} onRetry={() => mutate()} />;
  const s = data.subscription;
  const lines: string[] = [];
  if (s.status === "free") lines.push(c.planFree);
  if (s.status === "active" && s.renewsAt) lines.push(c.renews(formatDate(s.renewsAt)));
  if (s.status === "canceling" && s.currentPeriodEnd) lines.push(c.ends(formatDate(s.currentPeriodEnd)));
  if (s.pendingChange) lines.push(c.changesTo(s.pendingChange.planName, formatDate(s.pendingChange.startsAt)));
  if (s.monthlyCredits?.nextGrantAt) lines.push(c.nextGrant(formatCredits(s.plan.monthlyCredits * 1000), formatDate(s.monthlyCredits.nextGrantAt)));
  if (s.nextChargeCents !== null && s.nextChargeCents > 0) lines.push(c.nextCharge(formatUsd(s.nextChargeCents)));
  return (
    <section aria-label={c.plan} className="flex min-w-0 flex-col rounded-2xl bg-border-subtle px-3 pt-3 pb-3">
      <div className="flex h-5 items-center gap-[6px]">
        <h2 className="text-sm leading-5 font-medium text-text-primary">{c.plan}</h2>
        <span className="grow" />
        {s.status === "canceling" ? <Tag tone="neutral">{c.cancel}</Tag> : null}
      </div>
      <p className="flex items-center gap-2 pt-3 text-4xl leading-10 font-medium tracking-[-0.0333em] text-text-primary">
        <Crown className="size-6 shrink-0 fill-current text-brand" strokeWidth={1.5} aria-hidden />
        <span className="truncate">{s.plan.name}</span>
      </p>
      <p className="pt-2 text-xs leading-4 text-text-secondary">
        {formatCredits(s.plan.monthlyCredits * 1000)} {c.perMonth} · {s.plan.concurrency} {c.jobsAtOnce}
      </p>
      <ul className="flex flex-col gap-1 pt-2 text-sm leading-5 text-text-secondary">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
        <ButtonLink href={routes.pricing} variant="lime" size="sm">
          {s.status === "free" ? c.seePlans : c.changePlan}
        </ButtonLink>
        {s.status === "active" ? (
          <Button variant="outline" size="sm" onClick={() => act("/api/billing/subscription/cancel")} disabled={busy}>
            {c.cancel}
          </Button>
        ) : null}
        {s.status === "canceling" ? (
          <Button variant="outline" size="sm" onClick={() => act("/api/billing/subscription/resume")} disabled={busy}>
            {c.resume}
          </Button>
        ) : null}
      </div>
      {s.demoBilling && s.status !== "free" ? <p className="pt-2 text-xs leading-4 text-text-secondary">{common.demoNote}</p> : null}
      {problem ? (
        <div className="pt-2">
          <Status error={problem} />
        </div>
      ) : null}
    </section>
  );
}

// ── Packs and promo ─────────────────────────────────────────────────

function PacksCard({ wallet, onChange }: { wallet: Wallet; onChange: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const add = async (id: string, credits: number) => {
    setBusy(id);
    setOk(null);
    setProblem(null);
    try {
      const r = await api<{ balance: number }>("/api/wallet/topup", { method: "POST", body: { packId: id } });
      await setBalance(r.balance);
      onChange();
      setOk(c.added(formatCredits(credits * 1000)));
    } catch (e) {
      setProblem(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };
  return (
    <Card id="packs" title={c.packs} aside={<span className="truncate text-xs leading-4 text-text-secondary">{wallet.demoBilling ? common.demoNote : c.packsHint}</span>}>
      {wallet.demoBilling ? (
        <ul className="flex flex-col">
          {wallet.packs.map((p) => (
            <li key={p.id} className={cn("flex h-[41px] items-center gap-[10px]", ROW_LINE)}>
              <Coins className="size-4 shrink-0 text-brand" strokeWidth={1.5} aria-hidden />
              <span className="min-w-0 grow truncate text-sm leading-5 font-medium text-text-primary">{c.packCredits(formatCredits(p.credits * 1000))}</span>
              <span className="text-sm leading-5 text-text-secondary tabular-nums">
                {formatUsd(p.priceUsd * 100)}
              </span>
              <PillButton onClick={() => add(p.id, p.credits)} disabled={busy !== null} aria-label={`${c.add} ${c.packCredits(formatCredits(p.credits * 1000))}`}>
                {busy === p.id ? c.adding : c.add}
              </PillButton>
            </li>
          ))}
        </ul>
      ) : (
        <p className={cn("pt-3 text-sm leading-5 text-text-secondary", ROW_LINE)}>{c.packsClosed}</p>
      )}
      {ok || problem ? (
        <div className={cn("pt-3", ROW_LINE)}>
          <Status ok={ok} error={problem} />
        </div>
      ) : null}
    </Card>
  );
}

function PromoCard({ onChange }: { onChange: () => void }) {
  const id = useId();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const apply = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setOk(null);
    setProblem(null);
    try {
      const r = await api<{ code: string; credits: number; balance: number }>("/api/billing/promo", { method: "POST", body: { code } });
      await setBalance(r.balance);
      onChange();
      setCode("");
      setOk(c.promoDone(r.code, formatCredits(r.credits)));
    } catch (err) {
      setProblem(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card id="promo" title={c.promo}>
      <form onSubmit={apply} className={cn("flex flex-col gap-2 pt-3", ROW_LINE)}>
        <div className="flex gap-2">
          <label htmlFor={`${id}-code`} className="sr-only">
            {c.promo}
          </label>
          <span className="relative min-w-0 grow">
            <Ticket className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-secondary" strokeWidth={1.5} aria-hidden />
            <input id={`${id}-code`} className={cn(FIELD, "pl-9 uppercase placeholder:normal-case")} value={code} onChange={(e) => setCode(e.target.value)} placeholder={c.promoPlaceholder} autoComplete="off" spellCheck={false} />
          </span>
          <Button type="submit" variant="soft" size="md" disabled={busy || !code.trim()}>
            {c.promoApply}
          </Button>
        </div>
        <Status ok={ok} error={problem} />
      </form>
    </Card>
  );
}

// ── Usage ───────────────────────────────────────────────────────────

function UsageCard() {
  const [tz] = useState(() => -new Date().getTimezoneOffset());
  const { data, error, isLoading, mutate } = useSWR<{ usage: Usage }>(`/api/billing/usage?days=30&tz=${tz}`, fetcher);
  if (isLoading) return <LoadingCard rows={3} />;
  if (error || !data) return <LoadError message={errorMessage(error)} onRetry={() => mutate()} />;
  const u = data.usage;
  const max = Math.max(1, ...u.perDay.map((d) => d.spent));
  const stats = [
    { label: c.spent, value: formatCredits(u.totals.spent) },
    { label: c.added30, value: formatCredits(u.totals.granted + u.totals.toppedUp) },
    { label: c.generations, value: String(u.totals.generations) },
    { label: c.failed, value: String(u.totals.failed) },
  ];
  const empty = u.totals.generations === 0 && u.totals.spent === 0;
  return (
    <Card id="usage" title={c.usage} hint={c.usageHint}>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col rounded-xl bg-border-subtle px-3 py-2">
            <dt className="text-xs leading-4 text-text-secondary">{s.label}</dt>
            <dd className="text-xl leading-7 font-medium text-text-primary tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>
      {empty ? (
        <div className="flex flex-wrap items-center gap-3 pt-3">
          <p className="min-w-0 grow text-sm leading-5 text-text-secondary">{c.noUsage}</p>
          <ButtonLink href={routes.image} variant="outline" size="sm">
            {c.startMaking}
          </ButtonLink>
        </div>
      ) : (
        <>
          <div className="mt-3 flex h-[72px] items-end gap-[3px]" role="img" aria-label={`${c.spent}: ${formatCredits(u.totals.spent)}`}>
            {u.perDay.map((d) => (
              <div
                key={d.date}
                title={`${d.date}: ${formatCredits(d.spent)} · ${d.generations}`}
                className={cn("min-w-0 flex-1 rounded-[2px]", d.spent > 0 ? "bg-brand" : "bg-border-default")}
                style={{ height: d.spent > 0 ? `${Math.max(6, (d.spent / max) * 100)}%` : "5px" }}
              />
            ))}
          </div>
          {u.perKind.length ? (
            <ul className="flex flex-col pt-3">
              {u.perKind.map((k) => (
                <li key={k.kind} className={cn("flex h-[41px] items-center gap-[10px] text-sm leading-5", ROW_LINE)}>
                  <span className="min-w-0 grow truncate font-medium text-text-primary capitalize">{k.kind}</span>
                  <span className="text-text-secondary tabular-nums">{k.generations}</span>
                  <span className="w-20 text-right text-text-primary tabular-nums">{formatCredits(k.spent)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </Card>
  );
}

// ── History and receipts ────────────────────────────────────────────

function MoreButton({ more, loading, onMore }: { more: boolean; loading: boolean; onMore: () => void }) {
  return (
    <div className={cn("flex items-center justify-center pt-3", ROW_LINE)}>
      {more ? (
        <Button variant="ghost" size="sm" onClick={onMore} disabled={loading}>
          {loading ? common.loadingMore : common.showMore}
        </Button>
      ) : (
        <span className="text-xs leading-4 text-text-secondary">{common.end}</span>
      )}
    </div>
  );
}

function HistoryCard({ pages, size, setSize, loading }: { pages: Wallet[]; size: number; setSize: (n: number) => void; loading: boolean }) {
  const rows = pages.flatMap((p) => p.history);
  const more = (pages[pages.length - 1]?.history.length ?? 0) === PAGE;
  return (
    <Card id="history" title={c.history} hint={c.historyHint}>
      {rows.length === 0 ? (
        <p className={cn("pt-3 text-sm leading-5 text-text-secondary", ROW_LINE)}>{c.noHistory}</p>
      ) : (
        <>
          <ul aria-label={c.history} className="flex flex-col">
            {rows.map((r) => (
              <li key={r.id} className={cn("flex min-h-[48px] items-center gap-[10px] py-1", ROW_LINE)}>
                <Tag tone={r.amount >= 0 ? "brand" : "neutral"} className="w-[60px] justify-center">
                  {c.kinds[r.kind] ?? r.kind}
                </Tag>
                <div className="flex min-w-0 grow flex-col">
                  <span className="truncate text-sm leading-5 font-medium text-text-primary">{r.note}</span>
                  <span className="text-xs leading-4 text-text-secondary">{formatDateTime(r.createdAt)}</span>
                </div>
                <span className={cn("shrink-0 text-sm leading-5 font-medium tabular-nums", r.amount >= 0 ? "text-brand" : "text-text-primary")}>
                  {r.amount >= 0 ? "+" : "−"}
                  {formatCredits(Math.abs(r.amount))}
                </span>
              </li>
            ))}
          </ul>
          <MoreButton more={more} loading={loading} onMore={() => setSize(size + 1)} />
        </>
      )}
    </Card>
  );
}

function ReceiptsCard() {
  const { data, error, isLoading, isValidating, size, setSize, mutate } = useSWRInfinite<{ receipts: ReceiptRow[] }>(
    (i, prev: { receipts: ReceiptRow[] } | null) => {
      if (prev && prev.receipts.length < PAGE) return null;
      const before = prev?.receipts[prev.receipts.length - 1]?.createdAt;
      return `/api/billing/receipts?limit=${PAGE}${before ? `&before=${before}` : ""}`;
    },
    fetcher,
  );
  if (isLoading) return <LoadingCard rows={2} />;
  if (error || !data) return <LoadError message={errorMessage(error)} onRetry={() => mutate()} />;
  const rows = data.flatMap((p) => p.receipts);
  const more = (data[data.length - 1]?.receipts.length ?? 0) === PAGE;
  return (
    <Card id="receipts" title={c.receipts} hint={c.receiptsHint}>
      {rows.length === 0 ? (
        <p className={cn("pt-3 text-sm leading-5 text-text-secondary", ROW_LINE)}>{c.noReceipts}</p>
      ) : (
        <>
          <ul aria-label={c.receipts} className="flex flex-col">
            {rows.map((r) => (
              <li key={r.id} className={cn("flex min-h-[48px] items-center gap-[10px] py-1", ROW_LINE)}>
                <Receipt className="size-4 shrink-0 text-text-secondary" strokeWidth={1.5} aria-hidden />
                <div className="flex min-w-0 grow flex-col">
                  <span className="line-clamp-2 text-sm leading-5 font-medium text-text-primary">{r.description}</span>
                  <span className="truncate text-xs leading-4 text-text-secondary">
                    {r.number} · {formatDate(r.createdAt)}
                  </span>
                </div>
                {r.demo ? <Tag tone="neutral">{c.demoReceipt}</Tag> : null}
                <span className="shrink-0 text-sm leading-5 font-medium text-text-primary tabular-nums">{formatUsd(r.amountCents)}</span>
              </li>
            ))}
          </ul>
          <MoreButton more={more} loading={isValidating} onMore={() => setSize(size + 1)} />
        </>
      )}
    </Card>
  );
}

// ── Page ────────────────────────────────────────────────────────────

export function WalletPage() {
  const { user, loading } = useSession();
  const { data, error, isLoading, isValidating, size, setSize, mutate } = useSWRInfinite<Wallet>(
    (i, prev: Wallet | null) => {
      if (!user) return null;
      if (prev && prev.history.length < PAGE) return null;
      const before = prev?.history[prev.history.length - 1]?.id;
      return `/api/wallet?limit=${PAGE}${before ? `&before=${before}` : ""}`;
    },
    fetcher,
  );
  const refresh = () => {
    mutate();
    refreshSession();
  };

  let body;
  if (loading || (user && isLoading)) {
    body = (
      <>
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-[160px] rounded-2xl" />
          <Skeleton className="h-[160px] rounded-2xl" />
        </div>
        <LoadingCard rows={3} />
      </>
    );
  } else if (!user) {
    body = <SignInCard {...gate.signedOut.wallet} next={routes.wallet} />;
  } else if (error || !data?.[0]) {
    body = <LoadError message={errorMessage(error)} onRetry={() => mutate()} />;
  } else {
    const w = data[0];
    body = (
      <>
        {user.isGuest ? <GuestBanner next={routes.wallet} /> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <BalanceCard wallet={w} />
          <PlanCard />
        </div>
        <PacksCard wallet={w} onChange={refresh} />
        <PromoCard onChange={refresh} />
        <UsageCard />
        <HistoryCard pages={data} size={size} setSize={setSize} loading={isValidating} />
        <ReceiptsCard />
      </>
    );
  }
  return (
    <AccountFrame page="wallet" title={c.title}>
      {body}
    </AccountFrame>
  );
}
