"use client";

import { Switch as S } from "radix-ui";
import { ArrowUpRight, RotateCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { mutate } from "swr";
import { LoginDialog } from "@/components/entry/login-dialog";
import { pricingCopy as t, fill } from "@/content/pricing";
import { routes } from "@/content/site";
import { api, errorMessage } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Button, buttonClass, cn } from "@/ui";
import { PLANS_KEY, SUB_KEY, actionFor, usePlans, useSubscription, type Interval, type PlanCard as Plan } from "./billing";
import { CheckoutDialog, type CheckoutTarget } from "./checkout-dialog";
import { CompareTable } from "./compare-table";
import { CurrentPlan } from "./current-plan";
import { Faq } from "./faq";
import { OfferBanner } from "./offer-banner";
import { PlanCard, type Tone } from "./plan-card";

const TONES: Tone[] = ["plain", "lime", "pink"];
const TITLE_GRAD = { backgroundImage: "linear-gradient(180deg, #FFFFFF 0%, #FFFFFFB2 100%)" };

export function PricingPage() {
  const { member, loading: sessionLoading } = useSession();
  const plans = usePlans();
  const subscription = useSubscription(!!member);
  const sub = member ? (subscription.data?.subscription ?? plans.data?.current ?? null) : null;

  const [interval, setInterval] = useState<Interval>("year");
  const [checkout, setCheckout] = useState<CheckoutTarget | null>(null);
  const [signIn, setSignIn] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);

  const all = plans.data?.plans ?? [];
  const paid = all.filter((p) => p.rank > 0);
  const maxSaving = Math.max(0, ...paid.map((p) => p.yearlySavingPercent));
  const demo = plans.data?.demoBilling ?? false;
  const isMember = !!member && !sessionLoading;

  async function choose(plan: Plan, at: Interval = interval) {
    const action = actionFor(plan, at, sub, isMember);
    if (action.kind === "signin") return setSignIn(true);
    if (action.kind === "current") return;
    if (action.kind === "resume") {
      setResumeError(null);
      try {
        await api("/api/billing/subscription/resume", { method: "POST" });
        await Promise.all([mutate(SUB_KEY), mutate(PLANS_KEY)]);
      } catch (e) {
        setResumeError(errorMessage(e));
      }
      return;
    }
    setCheckout({
      plan,
      interval: at,
      when: action.kind === "keep" ? "now" : action.when,
      change: !!sub && sub.status !== "free" && sub.plan.rank > 0,
    });
  }

  return (
    <div className="flex w-full flex-col px-4 pt-8 pb-8">
      <OfferBanner />

      {/* Heading and the billing period. */}
      <div className="mx-auto mt-8 flex w-full max-w-[1088px] flex-col gap-6 desktop:flex-row desktop:items-end desktop:justify-between">
        <div className="flex min-w-0 flex-col gap-3 pl-1">
          <h1
            className="bg-clip-text text-[32px] leading-10 font-semibold tracking-[-0.03em] text-transparent sm:text-[40px] sm:leading-[48px]"
            style={TITLE_GRAD}
          >
            {t.heading.title}
          </h1>
          <p className="text-sm leading-5 text-text-tab">
            {maxSaving > 0 ? fill(t.heading.sub, { saving: maxSaving }) : t.heading.subPlain}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <nav
            aria-label="Plan audience"
            className="flex h-10 items-center gap-1 rounded-full border border-border-default bg-border-subtle p-[3px] backdrop-blur-[12px] [box-shadow:#FFFFFF0D_0px_2px_3px_inset,#0000001F_0px_2px_4px_-0.5px]"
          >
            <span aria-current="page" className="flex h-8 items-center rounded-full bg-text-primary px-[12px] text-xs leading-4 font-medium text-text-inverse">
              {t.audience.individual}
            </span>
            <Link
              href={routes.enterprise}
              className="flex h-8 items-center rounded-full px-[12px] text-xs leading-4 font-medium text-text-tab transition-colors duration-150 hover:text-text-primary"
            >
              {t.audience.business}
            </Link>
          </nav>
          <PeriodSwitch interval={interval} onChange={setInterval} saving={maxSaving} />
        </div>
      </div>

      {sub && isMember ? (
        <div className="mt-8">
          <CurrentPlan sub={sub} />
        </div>
      ) : null}
      {resumeError ? (
        <p role="alert" className="mx-auto mt-3 w-full max-w-[1088px] text-sm leading-5 text-danger">
          {resumeError}
        </p>
      ) : null}

      {/* The plan cards. */}
      <div id="plans" className="mx-auto mt-12 sm:mt-20 flex w-full max-w-[1088px] scroll-mt-8 flex-wrap items-start justify-center gap-4">
        {plans.error ? (
          <div role="alert" className="flex w-full flex-col items-center gap-3 rounded-3xl border border-border-subtle bg-surface-primary px-6 py-12 text-center">
            <p className="text-base leading-6 font-semibold text-text-primary">{t.errors.plans}</p>
            <p className="text-sm leading-5 text-text-secondary">{errorMessage(plans.error)}</p>
            <Button variant="outline" size="md" onClick={() => plans.mutate()}>
              <RotateCw className="size-4" strokeWidth={1.5} aria-hidden />
              {t.errors.retry}
            </Button>
          </div>
        ) : !plans.data ? (
          [0, 1, 2].map((i) => (
            <div key={i} aria-hidden className="flex w-full max-w-[352px] flex-col gap-4 p-2" data-skeleton>
              <div className="shimmer h-[248px] rounded-4xl bg-surface-secondary" />
              <div className="shimmer mx-4 h-5 rounded-md bg-surface-secondary" />
              <div className="shimmer mx-4 h-5 w-1/2 rounded-md bg-surface-secondary" />
              <div className="shimmer h-[200px] rounded-2xl bg-surface-secondary" />
            </div>
          ))
        ) : (
          paid.map((p, i) => (
            <PlanCard
              key={p.id}
              plan={p}
              tone={TONES[i] ?? "plain"}
              interval={interval}
              action={actionFor(p, interval, sub, isMember)}
              demo={demo}
              onChoose={() => choose(p)}
            />
          ))
        )}
      </div>

      {/* The small print and the two help links. */}
      <div className="mx-auto mt-5 flex w-full max-w-[1088px] flex-col items-center gap-5 text-center text-xs leading-[18px] text-text-muted">
        <div>
          {t.note.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
        <nav aria-label="Plan help" className="flex flex-wrap justify-center gap-x-6 gap-y-2">
          <a href="#faq" className="flex items-center gap-1 transition-colors duration-150 hover:text-text-primary">
            {t.links.howPlans}
            <ArrowUpRight className="size-3" strokeWidth={1.5} aria-hidden />
          </a>
          <Link href={routes.wallet} className="flex items-center gap-[3px] transition-colors duration-150 hover:text-text-primary">
            {t.links.credits}
            <ArrowUpRight className="size-3" strokeWidth={1.5} aria-hidden />
          </Link>
        </nav>
      </div>

      {all.length > 0 ? (
        <div className="mt-20">
          <CompareTable
            plans={all}
            interval={interval}
            onInterval={setInterval}
            actionFor={(p) => actionFor(p, interval, sub, isMember)}
            onChoose={(p) => choose(p)}
            maxSaving={maxSaving}
          />
        </div>
      ) : null}

      <Faq />

      <div className="mt-10 flex items-center justify-center gap-4">
        <span className="text-sm leading-5 font-medium text-text-primary">{t.ready.lead}</span>
        <a href="#plans" className={buttonClass("lime", "md", "text-ink")}>
          {t.ready.cta}
        </a>
      </div>

      <CheckoutDialog target={checkout} subscription={sub} onOpenChange={(o) => (o ? null : setCheckout(null))} />
      <LoginDialog open={signIn} onOpenChange={setSignIn} mode="join" next={routes.pricing} />
    </div>
  );
}

function PeriodSwitch({ interval, onChange, saving }: { interval: Interval; onChange: (i: Interval) => void; saving: number }) {
  const yearly = interval === "year";
  return (
    <div
      role="group"
      aria-label="Billing period"
      className="flex h-10 items-center gap-2 rounded-full border border-border-subtle pr-[18px] pl-4 backdrop-blur-[12px] [box-shadow:#FFFFFF0D_0px_2px_3px_inset,#0000001F_0px_2px_4px_-0.5px]"
    >
      <button
        type="button"
        onClick={() => onChange("month")}
        className={cn("h-6 rounded-sm text-xs leading-4 font-semibold transition-colors duration-150", yearly ? "text-text-tab hover:text-text-primary" : "text-text-primary")}
      >
        {t.period.monthly}
      </button>
      <S.Root
        checked={yearly}
        onCheckedChange={(c) => onChange(c ? "year" : "month")}
        aria-label="Bill yearly"
        className="relative mx-[1px] h-[18px] w-8 shrink-0 rounded-full bg-toggle-track transition-colors duration-150 data-[state=checked]:bg-text-primary"
      >
        <S.Thumb className="block size-[14px] translate-x-[2px] rounded-full bg-text-primary [box-shadow:#00000052_0px_1px_12px] transition-transform duration-150 data-[state=checked]:translate-x-4 data-[state=checked]:bg-surface-primary" />
      </S.Root>
      <button
        type="button"
        onClick={() => onChange("year")}
        className={cn("h-6 rounded-sm text-xs leading-4 font-semibold transition-colors duration-150", yearly ? "text-text-primary" : "text-text-tab hover:text-text-primary")}
      >
        {t.period.annual}
      </button>
      {saving > 0 ? <span className="ml-1 text-xs leading-4 font-semibold text-[#FF0040]">{fill(t.period.save, { saving })}</span> : null}
    </div>
  );
}
