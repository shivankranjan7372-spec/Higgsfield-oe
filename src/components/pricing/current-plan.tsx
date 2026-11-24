"use client";

import { useState } from "react";
import { mutate } from "swr";
import { pricingCopy as t, fill } from "@/content/pricing";
import { api, errorMessage } from "@/lib/api";
import { Button, Dialog, DialogClose, DialogContent, Spinner } from "@/ui";
import { PLANS_KEY, SUB_KEY, day, money, type Subscription } from "./billing";

/** The member's plan today, with cancel and resume. Changing plan is done on the cards. */
export function CurrentPlan({ sub }: { sub: Subscription }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function run(path: string) {
    setBusy(true);
    setProblem(null);
    try {
      await api(path, { method: "POST" });
      await Promise.all([mutate(SUB_KEY), mutate(PLANS_KEY)]);
      setAsking(false);
    } catch (e) {
      setProblem(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const paid = sub.status !== "free" && sub.plan.rank > 0;
  const interval = sub.interval === "year" ? t.current.yearly : t.current.monthly;

  return (
    <section
      aria-label={t.current.label}
      data-current-plan={sub.planId}
      className="mx-auto flex w-full max-w-[1088px] flex-col gap-3 rounded-2xl border border-border-subtle bg-surface-primary px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 flex-col gap-[2px]">
        <p className="text-xs leading-4 font-medium text-text-secondary">{t.current.label}</p>
        {paid ? (
          <>
            <p className="text-base leading-6 font-semibold text-text-primary">
              {sub.plan.name} <span className="font-normal text-text-secondary">· {interval}</span>
            </p>
            <p className="text-xs leading-[18px] text-text-nav">
              {sub.status === "canceling" && sub.currentPeriodEnd
                ? fill(t.current.ends, { date: day(sub.currentPeriodEnd) })
                : [
                    sub.renewsAt ? fill(t.current.renews, { date: day(sub.renewsAt) }) : null,
                    sub.nextChargeCents !== null ? fill(t.current.nextCharge, { amount: money(sub.nextChargeCents) }) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
              {sub.pendingChange
                ? ` ${fill(t.current.pending, {
                    plan: sub.pendingChange.planName,
                    interval: sub.pendingChange.interval === "year" ? t.current.yearly : t.current.monthly,
                    date: day(sub.pendingChange.startsAt),
                  })}`
                : null}
            </p>
          </>
        ) : (
          <p className="text-sm leading-5 text-text-primary">{t.current.free}</p>
        )}
        {problem ? (
          <p role="alert" className="text-xs leading-4 text-danger">
            {problem}
          </p>
        ) : null}
      </div>
      {paid ? (
        sub.status === "canceling" ? (
          <Button variant="lime" size="md" onClick={() => run("/api/billing/subscription/resume")} disabled={busy}>
            {busy ? <Spinner /> : t.current.resume}
          </Button>
        ) : (
          <Dialog open={asking} onOpenChange={setAsking}>
            <Button variant="outline" size="md" onClick={() => setAsking(true)}>
              {t.current.cancel}
            </Button>
            <DialogContent title={t.current.cancelTitle} className="max-w-[420px] pb-6" aria-describedby={undefined}>
              <p className="px-6 pt-3 text-sm leading-5 text-text-nav">
                {fill(t.current.cancelBody, { date: sub.currentPeriodEnd ? day(sub.currentPeriodEnd) : "" })}
              </p>
              {problem ? (
                <p role="alert" className="mx-6 mt-3 text-sm leading-5 text-danger">
                  {problem}
                </p>
              ) : null}
              <div className="flex flex-col-reverse gap-2 px-6 pt-5 sm:flex-row sm:justify-end">
                <DialogClose asChild>
                  <Button variant="soft" size="md">
                    {t.current.cancelKeep}
                  </Button>
                </DialogClose>
                <Button variant="white" size="md" onClick={() => run("/api/billing/subscription/cancel")} disabled={busy}>
                  {busy ? <Spinner /> : t.current.cancelConfirm}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )
      ) : null}
    </section>
  );
}
