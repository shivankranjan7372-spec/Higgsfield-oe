"use client";

import { Check, CirclePlus, Info, Sparkles } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { pricingCopy as t, fill } from "@/content/pricing";
import { cn } from "@/ui";
import { money, yearlySaving, type Action, type Interval, type PlanCard as Plan } from "./billing";

/** The three looks the design draws. Cards take them in order; more cards reuse the plain one. */
export type Tone = "plain" | "lime" | "pink";

interface ToneStyle {
  head: CSSProperties;
  headRing: string;
  tagline: CSSProperties;
  accentText: string;
  accentIcon: string;
  line: string;
  corner: string;
  box?: CSSProperties;
  boxInner?: CSSProperties;
  boxTitle?: CSSProperties;
}

const TONES: Record<Tone, ToneStyle> = {
  plain: {
    head: { backgroundImage: "linear-gradient(160deg, #2E3135 0%, #212327 45%, #18191C 100%)" },
    headRing: "border border-border-subtle [box-shadow:#00000033_0px_8px_24px]",
    tagline: { backgroundImage: "linear-gradient(180deg, #FFFFFF80 0%, #FFFFFF66 100%)" },
    accentText: "text-text-primary",
    accentIcon: "text-text-primary",
    line: "linear-gradient(180deg, #00000000 0%, #FFFFFF 100%)",
    corner: "border-text-primary",
  },
  lime: {
    head: {
      backgroundImage:
        "radial-gradient(ellipse 90% 70% at 25% 0%, #F2FF8A 0%, #D9F93A00 70%), linear-gradient(180deg, #CDEE2E 0%, #A8C61C 45%, #6F8510 100%)",
    },
    headRing: "[box-shadow:#D1FE1759_0px_0px_48px_4px,#FFFFFF4D_0px_1px_2px_inset]",
    tagline: { backgroundImage: "linear-gradient(180deg, #FFFFFFB2 0%, #FFFFFF99 100%)" },
    accentText: "text-brand",
    accentIcon: "text-brand",
    line: "linear-gradient(180deg, #00000000 0%, #D1FE17 100%)",
    corner: "border-brand",
    box: {
      backgroundImage:
        "linear-gradient(180deg, #000000 0%, #0D1200 25%, #3C4100 50%, #606C00 75%, #849616 100%)",
      boxShadow: "#D1FE17 0px 0px 0px 3px inset, #DDF676B3 0px 0px 14px 2px inset, #D1FE1740 0px 0px 24px 0px",
    },
    boxInner: { backgroundImage: "linear-gradient(180deg, #2C331099 0%, #00000099 100%)" },
    boxTitle: { backgroundImage: "linear-gradient(180deg, #FEFA17 0%, #D1FE17 100%)" },
  },
  pink: {
    head: {
      backgroundImage:
        "radial-gradient(ellipse 90% 70% at 25% 0%, #FF9CCB 0%, #FF6FAE00 70%), linear-gradient(180deg, #FF4F9B 0%, #E62A78 45%, #A0104F 100%)",
    },
    headRing: "[box-shadow:#FF005B59_0px_0px_48px_4px,#FFFFFF4D_0px_1px_2px_inset]",
    tagline: { backgroundImage: "linear-gradient(180deg, #FFFFFFB2 0%, #FFFFFF99 100%)" },
    accentText: "text-promo",
    accentIcon: "text-promo",
    line: "linear-gradient(180deg, #00000000 0%, #FF005B 100%)",
    corner: "border-promo",
    box: {
      backgroundImage:
        "linear-gradient(180deg, #000000 0%, #270000 25%, #5D0024 50%, #7B002A 75%, #990030 100%)",
      boxShadow: "#F23590 0px 0px 0px 3px inset, #F23590B3 0px 0px 14px 2px inset, #FF005B40 0px 0px 24px 0px",
    },
    boxInner: { backgroundImage: "linear-gradient(180deg, #330A1E99 0%, #00000099 100%)" },
    boxTitle: { backgroundImage: "linear-gradient(180deg, #FF4F8F 0%, #FF005B 100%)" },
  },
};

const PRICE_STRIKE: CSSProperties = {
  backgroundImage: "linear-gradient(180deg, #FFFFFF80 0%, #99999940 100%)",
  textDecoration: "line-through 1px oklch(84.1% 0 0 / 37.5%)",
};
const PER: CSSProperties = { backgroundImage: "linear-gradient(180deg, #FFFFFF99 0%, #FFFFFF7A 100%)" };
const SAVE_PILL: CSSProperties = {
  backgroundImage:
    "radial-gradient(ellipse 60% 140% at 12% 76%, #B01DEF99 0%, #ED157200 100%), radial-gradient(ellipse 40% 90% at 73% 50%, #EF1DBA99 0%, #ED157200 100%)",
};

export function PlanCard({
  plan,
  tone,
  interval,
  action,
  busy,
  demo,
  onChoose,
}: {
  plan: Plan;
  tone: Tone;
  interval: Interval;
  action: Action;
  busy?: boolean;
  demo: boolean;
  onChoose: () => void;
}) {
  const s = TONES[tone];
  const yearly = interval === "year";
  const price = yearly ? plan.priceYearPerMonthCents : plan.priceMonthCents;
  const saving = yearlySaving(plan);
  const struck = yearly && plan.priceMonthCents > price;
  // Long amounts ("$129 $107.50") get a smaller size so the row stays on one line.
  const long = (struck ? money(plan.priceMonthCents).length : 0) + money(price).length > 10;
  const big = long ? "text-[28px] leading-[40px]" : "text-4xl leading-[40px]";
  const label =
    action.kind === "signin"
      ? fill(t.card.get, { plan: plan.name })
      : action.kind === "current"
        ? t.button.current
        : action.label;

  return (
    <article
      aria-label={`${plan.name} plan`}
      data-plan={plan.id}
      className="relative flex w-full max-w-[352px] flex-col gap-4 rounded-[32px] p-2 pb-2"
    >
      {/* Header: name, price, the button. */}
      <div className={cn("relative flex h-[248px] flex-col rounded-4xl px-4 pt-4", s.headRing)} style={s.head}>
        <div className="flex h-12 items-start gap-2">
          <h3 className="pl-[2px] text-4xl leading-[40px] font-medium tracking-[-0.0333em] text-text-primary">{plan.name}</h3>
          {plan.highlight ? (
            <span className="mt-2 flex h-6 min-w-0 items-center gap-1 rounded-full bg-[#00000026] px-2 [box-shadow:#FFFFFF1A_0px_-2px_4px_inset,#FFFFFF1A_0px_2px_4px_inset]">
              <Sparkles className="size-4 shrink-0 text-text-primary" strokeWidth={1.5} aria-hidden />
              <span className="truncate text-xs leading-4 font-semibold text-text-primary">{plan.highlight}</span>
            </span>
          ) : null}
        </div>
        <p className="h-4 truncate bg-clip-text pl-[2px] text-sm leading-4 font-medium text-transparent" style={s.tagline}>
          {plan.tagline}
        </p>
        <div className="mt-6 flex h-10 items-baseline gap-2 pl-[2px] whitespace-nowrap">
          <span className="flex items-baseline gap-[6px]">
            {struck ? (
              <s className={cn("bg-clip-text font-medium tracking-[-0.0333em] text-transparent", big)} style={PRICE_STRIKE}>
                <span className="sr-only">Was </span>
                {money(plan.priceMonthCents)}
              </s>
            ) : null}
            <span className={cn("font-medium tracking-[-0.0333em] text-text-primary", big)} data-price>
              {money(price)}
            </span>
          </span>
          <span className="bg-clip-text text-sm leading-5 font-medium whitespace-nowrap text-transparent" style={PER}>
            {yearly ? t.card.perMonthYearly : t.card.perMonthMonthly}
          </span>
        </div>
        <button
          type="button"
          onClick={onChoose}
          disabled={action.kind === "current" || busy}
          aria-label={action.kind === "signin" ? fill(t.button.signIn, { plan: plan.name }) : undefined}
          className="mt-3 flex h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-text-primary text-sm leading-4 font-semibold text-text-inverse transition-colors duration-150 [box-shadow:#00000033_-1px_-2px_6px_inset,#0000001F_0px_4px_16px] hover:bg-text-soft disabled:cursor-default disabled:bg-[#FFFFFFB2]"
        >
          <span className="truncate">{label}</span>
          {yearly && saving > 0 && action.kind !== "current" ? (
            <span
              className="flex h-5 shrink-0 items-center gap-[6px] rounded-full bg-[#FF0040] px-2 text-xs leading-4 font-semibold text-text-primary [box-shadow:#FFFFFF66_0px_-2px_2px_inset,#FFFFFF66_0px_2px_2px_inset]"
              style={SAVE_PILL}
            >
              <span>− {plan.yearlySavingPercent}%</span>
              <span className="h-[6px] w-px bg-text-primary opacity-50" aria-hidden />
              <span>Save {money(saving)}</span>
            </span>
          ) : null}
        </button>
        {demo ? (
          <p className="mt-auto mb-[7px] flex items-center gap-1 pl-2 text-xs leading-4 text-text-tab">
            <Info className="size-[14px] shrink-0" strokeWidth={1.5} aria-hidden />
            {t.card.demoNote}
          </p>
        ) : null}
      </div>

      {/* Credits each month. */}
      <div className="flex flex-col items-center px-4">
        <div className="flex h-8 w-full items-center gap-[10px]">
          <CirclePlus className={cn("size-5 shrink-0", s.accentIcon)} strokeWidth={1.5} aria-hidden />
          <p className="text-sm leading-5">
            <span className={cn("font-semibold", s.accentText)} data-credits>
              {plan.monthlyCredits.toLocaleString("en-US")} {t.card.creditsUnit}
            </span>
            <span className="text-text-tab"> {t.card.perMonth}</span>
          </p>
        </div>
        <Branch line={s.line} corner={s.corner} short>
          <span className="text-text-primary">{(plan.monthlyCredits * 12).toLocaleString("en-US")} credits</span>
          <span className="text-text-tab">a year, paid monthly</span>
        </Branch>
        <Branch line={s.line} corner={s.corner}>
          <span className="text-text-primary">{plan.concurrency} jobs</span>
          <span className="text-text-tab">running at once</span>
        </Branch>
      </div>

      {/* What the plan includes: the glowing box on the lime and pink cards. */}
      {s.box ? (
        <div className="relative flex flex-col overflow-hidden rounded-2xl" style={s.box}>
          <div className="flex h-8 items-start gap-[10px] pt-2 pl-4">
            <Sparkles className={cn("size-5", s.accentIcon)} strokeWidth={1.5} aria-hidden />
            <span className="bg-clip-text text-sm leading-5 font-semibold text-transparent" style={s.boxTitle}>
              {t.card.included}
            </span>
          </div>
          <div className="p-1">
            <ul className="rounded-2xl px-2 py-3 [box-shadow:#0000003D_0px_-2px_12px]" style={s.boxInner}>
              {plan.features.map((f) => (
                <Row key={f} icon={<Check className={cn("size-5", s.accentIcon)} strokeWidth={1.5} aria-hidden />}>
                  {f}
                </Row>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <Section title={t.card.included}>
          {plan.features.map((f) => (
            <Row key={f} icon={<Check className="size-5 text-text-secondary" strokeWidth={1.5} aria-hidden />}>
              {f}
            </Row>
          ))}
        </Section>
      )}

      <Section title={t.card.billing}>
        <Line label={t.card.billedMonthly} value={`${money(plan.priceMonthCents)} / month`} />
        <Line label={t.card.billedYearly} value={`${money(plan.priceYearCents)} / year`} />
        {saving > 0 ? (
          <Line label={t.card.yearlySaving} value={`${money(saving)} (${plan.yearlySavingPercent}%)`} />
        ) : null}
      </Section>
    </article>
  );
}

function Branch({ line, corner, short, children }: { line: string; corner: string; short?: boolean; children: ReactNode }) {
  return (
    <p className="relative flex h-8 w-full min-w-0 items-center gap-1 pl-[30px] text-sm leading-5">
      <span
        aria-hidden
        className={cn("absolute left-[10px] w-[2px] rounded-full", short ? "-top-[6px] h-[19px]" : "-top-3 h-[25px]")}
        style={{ backgroundImage: line }}
      />
      <span aria-hidden className={cn("absolute top-3 left-[10px] h-[5px] w-[10px] rounded-bl-[4.5px] border-b border-l", corner)} />
      {children}
    </p>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="relative flex flex-col gap-2 px-4 pt-2">
      <span aria-hidden className="absolute -top-2 right-0 left-0 h-px border-t border-border-subtle" />
      <h4 className="text-sm leading-5 font-normal text-[#FFFFFF66]">{title}</h4>
      <ul className="flex flex-col">{children}</ul>
    </div>
  );
}

function Row({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex min-h-8 items-center gap-[10px] text-sm leading-5 text-text-primary">
      <span className="flex size-5 shrink-0 items-center justify-center">{icon}</span>
      <span className="min-w-0">{children}</span>
    </li>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex h-8 items-center justify-between gap-3 text-sm leading-5">
      <span className="text-text-tab">{label}</span>
      <span className="text-text-primary tabular-nums">{value}</span>
    </li>
  );
}
