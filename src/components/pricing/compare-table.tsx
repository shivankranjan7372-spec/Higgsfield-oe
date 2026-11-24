"use client";

import { Switch as S } from "radix-ui";
import { Check, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { pricingCopy as t, fill } from "@/content/pricing";
import { cn } from "@/ui";
import { money, type Action, type Interval, type PlanCard } from "./billing";

const HAIR = "border-b border-[#FFFFFF0F]";
const COLS = (n: number) => ({ gridTemplateColumns: `var(--label) repeat(${n}, minmax(0, 1fr))` });

/** Every plan side by side, all numbers from the server. Folds to 560 pixels until opened. */
export function CompareTable({
  plans,
  interval,
  onInterval,
  actionFor,
  onChoose,
  maxSaving,
}: {
  plans: PlanCard[];
  interval: Interval;
  onInterval: (i: Interval) => void;
  actionFor: (p: PlanCard) => Action;
  onChoose: (p: PlanCard) => void;
  maxSaving: number;
}) {
  const [open, setOpen] = useState(false);
  const yearly = interval === "year";
  const lastPaid = plans.length - 1;

  return (
    <section id="compare" aria-labelledby="compare-title" className="mx-auto flex w-full max-w-[1088px] flex-col items-center gap-8 pt-5">
      <div className="flex w-full flex-col gap-3">
        <h2 id="compare-title" className="text-[32px] leading-10 font-semibold tracking-[-0.03em] text-text-primary sm:text-[40px] sm:leading-[48px]">
          {t.compare.title}
        </h2>
        <p className="text-sm leading-5 text-text-muted">{t.compare.sub}</p>
      </div>

      <div className="relative w-full">
        <div className={cn("relative w-full overflow-hidden", open ? "" : "max-h-[560px]")}>
          <div className="w-full overflow-x-auto scroll-quiet rounded-t-3xl border border-[#FFFFFF0F] bg-page">
            <table className="grid w-full min-w-[720px] px-4 pt-4 [--label:150px] sm:min-w-[860px] sm:px-[23px] sm:[--label:244px]">
              <thead className="contents">
                <tr className={cn("grid", "border-b border-[#D9D9D90A]")} style={COLS(plans.length)}>
                  <th scope="col" className="flex items-end pb-4 text-left">
                    <label className="flex h-10 w-full max-w-[184px] items-center justify-center gap-2 sm:gap-3 rounded-md border border-[#FFFFFF14] backdrop-blur-[12px]">
                      <span className="text-sm leading-5 font-semibold text-text-primary">
                        {t.compare.annual}
                        {maxSaving > 0 ? <span className="ml-[3px] text-brand">{fill(t.compare.save, { saving: maxSaving })}</span> : null}
                      </span>
                      <S.Root
                        checked={yearly}
                        onCheckedChange={(c) => onInterval(c ? "year" : "month")}
                        aria-label="Annual billing"
                        className="relative h-6 w-9 shrink-0 rounded-full bg-toggle-track transition-colors duration-150 data-[state=checked]:bg-[#00C314]"
                      >
                        <S.Thumb className="block size-4 translate-x-[2px] rounded-full bg-text-primary [box-shadow:#0000001A_0px_10px_15px_-3px,#0000001A_0px_4px_6px_-4px] transition-transform duration-150 data-[state=checked]:translate-x-[18px]" />
                      </S.Root>
                    </label>
                  </th>
                  {plans.map((p, i) => {
                    const action = actionFor(p);
                    const price = p.rank === 0 ? null : yearly ? p.priceYearPerMonthCents : p.priceMonthCents;
                    return (
                      <th key={p.id} scope="col" className="flex flex-col items-start gap-4 px-2 pt-4 pb-4 text-left font-normal">
                        <span className="flex min-h-8 min-w-0 flex-wrap items-center gap-x-[6px] gap-y-1">
                          <span className="whitespace-nowrap text-2xl leading-8 font-bold tracking-[-0.01em] text-text-primary">{p.name}</span>
                          {p.highlight && i === lastPaid ? (
                            <span
                              className="flex h-4 items-center rounded-[2px] px-1 font-display text-2xs leading-3 font-bold whitespace-nowrap text-text-primary uppercase"
                              style={{ backgroundImage: "radial-gradient(ellipse 84% 180% at 50% 118%, #4FC9DC 0%, #32A2EE 50%, #167BFF 100%)" }}
                            >
                              {p.highlight}
                            </span>
                          ) : null}
                        </span>
                        <span className="flex flex-col text-sm leading-5">
                          <span className="text-text-primary">{price === null ? t.compare.free : fill(t.compare.perMonth, { price: money(price) })}</span>
                          <span className="text-text-muted">
                            {price === null ? t.compare.freeSub : yearly ? t.compare.billedYearly : t.compare.billedMonthly}
                          </span>
                        </span>
                        {p.rank > 0 ? (
                          <button
                            type="button"
                            onClick={() => onChoose(p)}
                            disabled={action.kind === "current"}
                            className={cn(
                              "flex h-10 w-full max-w-[183px] items-center justify-center rounded-xl text-sm leading-5 font-semibold transition-colors duration-150 disabled:opacity-60",
                              i === lastPaid
                                ? "bg-brand text-ink [box-shadow:#0000006E_0px_-3px_0px_inset] hover:bg-brand-glow"
                                : "border border-[#0000000F] bg-surface-tertiary text-text-primary backdrop-blur-[12px] hover:bg-surface-elevated",
                            )}
                            style={i === lastPaid ? { backgroundImage: "radial-gradient(circle farthest-corner at 50% 50%, #EFFE17 40%, #D1FE17 100%)" } : undefined}
                            aria-label={`${action.kind === "current" ? t.button.current : t.compare.get}: ${p.name}`}
                          >
                            {action.kind === "current" ? t.button.current : t.compare.get}
                          </button>
                        ) : null}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="contents">
                <Heading n={plans.length}>{t.compare.sections.credits}</Heading>
                <Row n={plans.length} label={t.compare.rows.monthlyCredits} sub={t.compare.rows.monthlyCreditsSub}>
                  {plans.map((p) => (p.monthlyCredits > 0 ? p.monthlyCredits.toLocaleString("en-US") : null))}
                </Row>
                <Row n={plans.length} label={t.compare.rows.monthlyPrice} sub={t.compare.rows.monthlyPriceSub}>
                  {plans.map((p) => (p.rank === 0 ? t.compare.free : money(p.priceMonthCents)))}
                </Row>
                <Row n={plans.length} label={t.compare.rows.yearlyPrice} sub={t.compare.rows.yearlyPriceSub}>
                  {plans.map((p) => (p.rank === 0 ? t.compare.free : money(p.priceYearCents)))}
                </Row>
                <Heading n={plans.length}>{t.compare.sections.making}</Heading>
                <Row n={plans.length} label={t.compare.rows.concurrency} sub={t.compare.rows.concurrencySub}>
                  {plans.map((p) => fill(t.compare.jobs, { n: p.concurrency }))}
                </Row>
                <Heading n={plans.length}>{t.compare.sections.included}</Heading>
                <tr className="grid py-3" style={COLS(plans.length)}>
                  <th scope="row" className="sr-only">
                    {t.compare.sections.included}
                  </th>
                  <td aria-hidden />
                  {plans.map((p) => (
                    <td key={p.id} className="px-2">
                      <ul className="flex flex-col gap-2">
                        {p.features.map((f) => (
                          <li key={f} className="flex items-start gap-2 text-xs leading-[18px] text-text-primary">
                            <Check className="mt-px size-4 shrink-0 text-text-secondary" strokeWidth={1.5} aria-hidden />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          {open ? null : (
            <div
              aria-hidden
              className="pointer-events-none absolute right-0 bottom-0 left-0 h-[240px]"
              style={{ backgroundImage: "linear-gradient(180deg, #0F111300 0%, #0F1113 70%)" }}
            />
          )}
        </div>
        <div className={cn("flex justify-center", open ? "pt-6" : "-mt-6")}>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="relative flex h-12 items-center justify-center rounded-xl border-2 border-border-default px-[14px] text-sm leading-5 font-semibold text-text-primary transition-colors duration-150 hover:bg-border-subtle"
          >
            {open ? t.compare.less : t.compare.more}
          </button>
        </div>
      </div>
    </section>
  );
}

function Heading({ n, children }: { n: number; children: ReactNode }) {
  return (
    <tr className="grid pt-6" style={COLS(n)}>
      <th scope="rowgroup" style={{ gridColumn: "1 / -1" }} className="h-7 text-left text-xl leading-7 font-bold text-text-primary">
        {children}
      </th>
    </tr>
  );
}

function Row({ n, label, sub, children }: { n: number; label: string; sub?: string; children: (string | null)[] }) {
  return (
    <tr className={cn("grid h-16", HAIR)} style={COLS(n)}>
      <th scope="row" className="flex flex-col justify-center gap-1 text-left font-normal">
        <span className="text-sm leading-5 text-text-primary">{label}</span>
        {sub ? <span className="text-xs leading-[18px] text-text-muted">{sub}</span> : null}
      </th>
      {children.map((c, i) => (
        <td key={i} className="flex items-center pl-2 text-xs leading-[18px] text-text-primary tabular-nums">
          {c === null ? (
            <>
              <X className="size-4 text-text-secondary" strokeWidth={1.5} aria-hidden />
              <span className="sr-only">{t.compare.none}</span>
            </>
          ) : (
            c
          )}
        </td>
      ))}
    </tr>
  );
}
