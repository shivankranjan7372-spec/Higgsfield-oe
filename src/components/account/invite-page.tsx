"use client";

import { Check, Coins, Copy, Gift, Link2, UserPlus, Users } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import useSWR from "swr";
import { formatCredits } from "@/config/economy";
import { gate, inviteCopy as c } from "@/content/account";
import { routes } from "@/content/site";
import { api, errorMessage, fetcher } from "@/lib/api";
import { useLive } from "@/lib/browser";
import { refreshSession, setBalance, useSession } from "@/lib/session";
import { Button, ButtonLink, cn } from "@/ui";
import { AccountFrame } from "./frame";
import { Card, FIELD, GuestBanner, LoadError, LoadingCard, ROW_LINE, SignInCard, Status } from "./parts";

interface Referral {
  code: string;
  path: string;
  creditsEach: number;
  invited: number;
  creditsEarned: number;
  limit: number;
  claimedInvite: { claimedAt: number } | null;
}

const KEY = "/api/account/referral";

function LinkCard({ r }: { r: Referral }) {
  const live = useLive();
  const link = live ? `${window.location.origin}${r.path}` : r.path;
  const [copied, setCopied] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const copy = async () => {
    setProblem(null);
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setProblem(c.copyFailed);
    }
  };
  return (
    <Card id="link" title={c.link} aside={<span className="font-mono text-xs leading-4 text-text-secondary">{`${c.code} ${r.code}`}</span>}>
      <div className={cn("flex flex-col gap-2 pt-3 sm:flex-row", ROW_LINE)}>
        <span className="relative min-w-0 grow">
          <Link2 className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-secondary" strokeWidth={1.5} aria-hidden />
          <input readOnly aria-label={c.link} value={link} onFocus={(e) => e.currentTarget.select()} className={cn(FIELD, "pl-9 font-mono text-xs")} data-testid="invite-link" />
        </span>
        <Button variant="lime" size="md" onClick={copy} aria-live="polite">
          {copied ? <Check className="size-4" strokeWidth={1.5} aria-hidden /> : <Copy className="size-4" strokeWidth={1.5} aria-hidden />}
          {copied ? c.copied : c.copy}
        </Button>
      </div>
      {problem ? (
        <div className="pt-2">
          <Status error={problem} />
        </div>
      ) : null}
    </Card>
  );
}

function RewardCard({ r }: { r: Referral }) {
  const each = formatCredits(r.creditsEach);
  const tiles = [
    { icon: Gift, label: c.youGet, value: each, sub: c.perInvite },
    { icon: UserPlus, label: c.theyGet, value: each, sub: c.onJoin },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {tiles.map((t) => (
        <section key={t.label} aria-label={t.label} className="flex flex-col rounded-2xl bg-border-subtle px-3 pt-3 pb-3">
          <div className="flex h-5 items-center gap-[6px]">
            <t.icon className="size-4 text-brand" strokeWidth={1.5} aria-hidden />
            <h2 className="text-sm leading-5 font-medium text-text-primary">{t.label}</h2>
          </div>
          <p className="pt-3 text-4xl leading-10 font-medium tracking-[-0.0333em] text-text-primary tabular-nums">{t.value}</p>
          <p className="text-xs leading-4 text-text-secondary">{t.sub}</p>
        </section>
      ))}
    </div>
  );
}

function SoFarCard({ r }: { r: Referral }) {
  const rows = [
    { label: c.invited, value: String(r.invited), icon: Users },
    { label: c.earned, value: formatCredits(r.creditsEarned), icon: Coins },
  ];
  return (
    <Card id="so-far" title={c.sofar} hint={c.limit(r.limit)}>
      <ul aria-label={c.sofar} className="flex flex-col">
        {rows.map((x) => (
          <li key={x.label} className={cn("flex h-[41px] items-center gap-[10px] text-sm leading-5", ROW_LINE)}>
            <x.icon className="size-4 shrink-0 text-text-secondary" strokeWidth={1.5} aria-hidden />
            <span className="min-w-0 grow font-medium text-text-primary">{x.label}</span>
            <span className="font-medium text-text-primary tabular-nums">{x.value}</span>
          </li>
        ))}
      </ul>
      <p className={cn("pt-3 text-sm leading-5 text-text-secondary", ROW_LINE)}>
        {r.invited === 0 ? c.noneYet : r.invited >= r.limit ? c.limitReached : c.listNote}
      </p>
    </Card>
  );
}

function ClaimCard({ r, guest, onDone }: { r: Referral; guest: boolean; onDone: () => void }) {
  const id = useId();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const claim = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setOk(null);
    setProblem(null);
    try {
      const res = await api<{ credits: number; balance: number }>(`${KEY}/claim`, { method: "POST", body: { code: code.trim() } });
      await setBalance(res.balance);
      setOk(c.claimed(formatCredits(res.credits)));
      setCode("");
      onDone();
    } catch (err) {
      setProblem(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  if (r.claimedInvite && !ok)
    return (
      <Card id="claim" title={c.claim}>
        <p className={cn("pt-3 text-sm leading-5 text-text-secondary", ROW_LINE)}>{c.alreadyClaimed}</p>
      </Card>
    );
  return (
    <Card id="claim" title={c.claim} hint={c.claimHint}>
      {guest ? (
        <div className={cn("flex flex-col items-start gap-3 pt-3 sm:flex-row sm:items-center", ROW_LINE)}>
          <p className="min-w-0 grow text-sm leading-5 text-text-secondary">{c.guestClaim}</p>
          <ButtonLink href={`${routes.join}?next=${encodeURIComponent(routes.invite)}`} variant="lime" size="sm">
            {gate.join}
          </ButtonLink>
        </div>
      ) : (
        <form onSubmit={claim} className={cn("flex flex-col gap-2 pt-3", ROW_LINE)}>
          <div className="flex gap-2">
            <label htmlFor={`${id}-code`} className="sr-only">
              {c.claim}
            </label>
            <input
              id={`${id}-code`}
              className={cn(FIELD, "grow font-mono uppercase placeholder:font-sans placeholder:normal-case")}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={c.claimPlaceholder}
              autoComplete="off"
              spellCheck={false}
              disabled={!!ok}
            />
            <Button type="submit" variant="soft" size="md" disabled={busy || !code.trim() || !!ok}>
              {c.claimButton}
            </Button>
          </div>
          <Status ok={ok} error={problem} />
        </form>
      )}
    </Card>
  );
}

export function InvitePage() {
  const { user, loading } = useSession();
  const { data, error, isLoading, mutate } = useSWR<Referral>(user ? KEY : null, fetcher);

  let body;
  if (loading || (user && isLoading)) {
    body = (
      <>
        <LoadingCard rows={1} />
        <LoadingCard rows={2} />
      </>
    );
  } else if (!user) {
    body = <SignInCard {...gate.signedOut.invite} next={routes.invite} />;
  } else if (error || !data) {
    body = <LoadError message={errorMessage(error)} onRetry={() => mutate()} />;
  } else {
    body = (
      <>
        {user.isGuest ? <GuestBanner next={routes.invite} /> : null}
        <LinkCard r={data} />
        <RewardCard r={data} />
        <SoFarCard r={data} />
        <ClaimCard
          r={data}
          guest={user.isGuest}
          onDone={() => {
            mutate();
            refreshSession();
          }}
        />
      </>
    );
  }
  return (
    <AccountFrame page="invite" title={c.title} lead={data ? c.lead(formatCredits(data.creditsEach)) : undefined}>
      {body}
    </AccountFrame>
  );
}
