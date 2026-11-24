"use client";

import { CircleCheck, Info } from "lucide-react";
import { useState, type FormEvent } from "react";
import { mutate } from "swr";
import { formatCredits } from "@/config/economy";
import { pricingCopy as t, fill } from "@/content/pricing";
import { api, errorMessage } from "@/lib/api";
import { setBalance } from "@/lib/session";
import { Button, Dialog, DialogContent, Spinner } from "@/ui";
import { PLANS_KEY, SUB_KEY, day, money, type Interval, type PlanCard, type Subscription } from "./billing";

export interface CheckoutTarget {
  plan: PlanCard;
  interval: Interval;
  when: "now" | "period_end";
  /** True when the member already has a paid plan. */
  change: boolean;
}

interface ChangeResult {
  effective: "now" | "period_end";
  receiptId?: string | null;
  subscription: Subscription;
  balance?: number;
}

/** The checkout window: price, a promo code box, the demo notice, and confirm. */
export function CheckoutDialog({
  target,
  subscription,
  onOpenChange,
}: {
  target: CheckoutTarget | null;
  subscription: Subscription | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      {target ? (
        <DialogContent
          title={target.change ? t.checkout.changeTitle : t.checkout.title}
          className="max-w-[440px] pb-6"
          aria-describedby={undefined}
        >
          <CheckoutBody key={`${target.plan.id}-${target.interval}`} target={target} subscription={subscription} onClose={() => onOpenChange(false)} />
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function CheckoutBody({
  target,
  subscription,
  onClose,
}: {
  target: CheckoutTarget;
  subscription: Subscription | null;
  onClose: () => void;
}) {
  const { plan, interval, when } = target;
  const yearly = interval === "year";
  const total = yearly ? plan.priceYearCents : plan.priceMonthCents;
  const later = when === "period_end" && subscription?.currentPeriodEnd ? subscription.currentPeriodEnd : null;

  const [code, setCode] = useState("");
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoMsg, setPromoMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState<ChangeResult | null>(null);

  async function redeem(e: FormEvent) {
    e.preventDefault();
    if (!code.trim() || promoBusy) return;
    setPromoBusy(true);
    setPromoMsg(null);
    try {
      const r = await api<{ code: string; credits: number; balance: number }>("/api/billing/promo", {
        method: "POST",
        body: { code },
      });
      await setBalance(r.balance);
      setPromoMsg({ ok: true, text: fill(t.checkout.promoDone, { code: r.code, credits: formatCredits(r.credits) }) });
      setCode("");
    } catch (err) {
      setPromoMsg({ ok: false, text: errorMessage(err) });
    } finally {
      setPromoBusy(false);
    }
  }

  async function confirm() {
    setBusy(true);
    setProblem(null);
    try {
      const r = await api<ChangeResult>("/api/billing/subscription", {
        method: "POST",
        body: { planId: plan.id, interval },
      });
      if (typeof r.balance === "number") await setBalance(r.balance);
      await Promise.all([mutate(SUB_KEY), mutate(PLANS_KEY)]);
      setDone(r);
    } catch (err) {
      setProblem(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    const startsLater = done.effective === "period_end" && done.subscription.pendingChange;
    return (
      <div className="flex flex-col gap-4 px-6 pt-4" role="status">
        <div className="flex items-start gap-3 rounded-2xl bg-brand-tint p-4">
          <CircleCheck className="mt-[2px] size-5 shrink-0 text-brand" strokeWidth={1.5} aria-hidden />
          <div className="flex flex-col gap-1">
            <p className="text-base leading-6 font-semibold text-text-primary">
              {startsLater
                ? fill(t.checkout.doneLater, { plan: plan.name, date: day(done.subscription.pendingChange!.startsAt) })
                : fill(t.checkout.done, { plan: done.subscription.plan.name })}
            </p>
            <p className="text-sm leading-5 text-text-secondary">{t.checkout.doneBody}</p>
          </div>
        </div>
        <Button variant="lime" size="md" onClick={onClose}>
          {t.checkout.close}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-6 pt-4">
      <dl className="flex flex-col rounded-2xl border border-border-subtle bg-surface-primary px-4 py-2 text-sm leading-5">
        <Item label={t.checkout.plan} value={plan.name} />
        <Item label={t.checkout.billing} value={yearly ? t.checkout.yearly : t.checkout.monthly} />
        <Item label={t.checkout.credits} value={fill(t.checkout.creditsValue, { credits: plan.monthlyCredits.toLocaleString("en-US") })} />
        <Item label={t.checkout.jobs} value={String(plan.concurrency)} />
        <Item label={t.checkout.starts} value={later ? day(later) : t.checkout.now} />
        <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-border-subtle pt-3 pb-1">
          <dt className="font-semibold text-text-primary">
            {later ? fill(t.checkout.totalLater, { date: day(later) }) : t.checkout.total}
          </dt>
          <dd className="text-2xl leading-8 font-semibold text-text-primary tabular-nums" data-total>
            {money(total)}
            <span className="ml-1 text-sm leading-5 font-normal text-text-secondary">/ {yearly ? "year" : "month"}</span>
          </dd>
        </div>
      </dl>

      <p className="flex items-start gap-2 rounded-xl bg-border-subtle px-3 py-2 text-xs leading-[18px] text-text-nav" data-demo-note>
        <Info className="mt-[2px] size-[14px] shrink-0" strokeWidth={1.5} aria-hidden />
        {t.checkout.demo}
      </p>

      <form onSubmit={redeem} className="flex flex-col gap-2">
        <label htmlFor="promo-code" className="text-xs leading-4 font-medium text-text-secondary">
          {t.checkout.promoLabel}
        </label>
        <div className="flex gap-2">
          <input
            id="promo-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={t.checkout.promoPlaceholder}
            autoComplete="off"
            className="h-10 min-w-0 flex-1 rounded-lg border border-border-default bg-surface-field px-3 text-sm leading-5 text-text-primary uppercase placeholder:text-text-tertiary placeholder:normal-case"
          />
          <Button type="submit" variant="outline" size="md" disabled={!code.trim() || promoBusy}>
            {promoBusy ? <Spinner /> : t.checkout.promoApply}
          </Button>
        </div>
        {promoMsg ? (
          <p role={promoMsg.ok ? "status" : "alert"} className={promoMsg.ok ? "text-xs leading-4 text-brand" : "text-xs leading-4 text-danger"}>
            {promoMsg.text}
          </p>
        ) : (
          <p className="text-xs leading-4 text-text-tertiary">{t.checkout.promoNote}</p>
        )}
      </form>

      {problem ? (
        <p role="alert" className="rounded-lg bg-[#FF6B6B1A] px-3 py-2 text-sm leading-5 text-danger">
          {problem}
        </p>
      ) : null}

      <Button variant="lime" size="md" onClick={confirm} disabled={busy}>
        {busy ? <Spinner label="Confirming" /> : target.change ? t.checkout.confirmChange : fill(t.checkout.confirm, { plan: plan.name })}
      </Button>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex h-8 items-center justify-between gap-3">
      <dt className="text-text-secondary">{label}</dt>
      <dd className="text-right text-text-primary">{value}</dd>
    </div>
  );
}
