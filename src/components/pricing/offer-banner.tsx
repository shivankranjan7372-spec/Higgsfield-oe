"use client";

import { Hourglass } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { brand } from "@/config/brand";
import { pricingCopy as t } from "@/content/pricing";
import { promo } from "@/content/site";
import { useNow } from "@/lib/browser";
import { Artwork } from "@/ui";

const END = Math.floor(Date.parse(promo.endsAt) / 1000);
const GRAD_WHITE = { backgroundImage: "linear-gradient(180deg, #FFFFFF 0%, #FFFFFFB2 100%)" };
const GRAD_UNIT = { backgroundImage: "linear-gradient(180deg, #FFFFFF 0%, #FFFFFF66 100%)" };
const GRAD_DIGIT = { backgroundImage: "linear-gradient(180deg, #FFFFFF 0%, #FFFFFF40 100%)" };
const BOX_FILL = {
  backgroundImage:
    "radial-gradient(ellipse 55% 95% at 73% 50%, #EF1DBA99 0%, #ED157200 100%), radial-gradient(ellipse 25% 42% at 85% 37%, #FFFFFF99 0%, #FFFFFF00 100%), radial-gradient(ellipse 33% 70% at 12% 76%, #B01DEF99 0%, #CE19B04C 50%, #ED157200 100%)",
};

/** The launch offer above the heading. Counts down to `promo.endsAt`; gone once it ends. */
export function OfferBanner() {
  const now = useNow();
  if (!promo.enabled) return null;
  if (now !== null && now >= END) return null;
  const left = now === null ? null : END - now;
  const units = [
    { label: t.offer.units.hours, value: left === null ? null : Math.floor(left / 3600) },
    { label: t.offer.units.minutes, value: left === null ? null : Math.floor((left % 3600) / 60) },
    { label: t.offer.units.seconds, value: left === null ? null : left % 60 },
  ];

  return (
    <section
      aria-label="Launch offer"
      className="relative mx-auto flex w-full max-w-[1088px] flex-col items-center justify-center gap-6 overflow-hidden rounded-4xl px-4 py-6 desktop:min-h-[174px] desktop:flex-row desktop:gap-[112px] desktop:px-0 desktop:py-0"
    >
      <Artwork
        name="pricing/offer-mark"
        className="pointer-events-none absolute top-0 left-1/2 hidden h-[170px] w-[473px] -translate-x-[calc(50%-71px)] opacity-[0.08] desktop:block"
      />
      <div className="relative flex w-full max-w-[688px] min-w-0 flex-col items-start gap-3">
        <div className="flex flex-col items-start gap-[2px]">
          <p className="font-display text-2xl leading-7 font-bold tracking-[-0.0375em] text-promo uppercase sm:text-[32px] sm:leading-9">
            {t.offer.lineOne}
          </p>
          <p className="flex flex-wrap items-center gap-[6px] font-display text-2xl leading-7 font-bold tracking-[-0.0375em] uppercase sm:text-[32px] sm:leading-9">
            <span className="bg-clip-text text-transparent" style={GRAD_WHITE}>
              {t.offer.lineTwoLead}
            </span>
            <span className="flex items-center gap-2 text-text-soft">
              <LogoMark size={32} className="size-6 sm:size-8" title={brand.name} />
              {promo.code}
            </span>
          </p>
        </div>
        <p className="text-sm leading-5 font-medium text-text-tab">
          {promo.text} {brand.name}. {t.offer.redeemHint}
        </p>
      </div>

      <div
        role="timer"
        aria-label={`${promo.countdownLabel} ${left === null ? "" : `${units[0].value} hours ${units[1].value} minutes`}`}
        className="relative flex h-[118px] w-[240px] shrink-0 flex-col items-center justify-center gap-[6px] overflow-hidden rounded-xl border border-[#D9D9D90A] [box-shadow:#00000026_10px_34px_24px]"
      >
        <div className="absolute inset-0 rounded-xl bg-promo backdrop-blur-[8px]" style={BOX_FILL} />
        <div className="absolute inset-0 rounded-xl [box-shadow:#ED157299_0px_-2px_20px_inset,#ED157266_0px_2px_10px_inset]" />
        <div className="relative flex h-6 items-center gap-[6px]">
          <Hourglass className="size-[14px] text-text-primary" strokeWidth={1.5} aria-hidden />
          <span className="bg-clip-text text-xs leading-4 font-medium text-transparent" style={GRAD_UNIT}>
            {t.offer.countdownLabel}
          </span>
        </div>
        <div className="relative flex h-[74px] items-center gap-1" aria-hidden>
          {units.map((u) => (
            <div
              key={u.label}
              className="relative flex h-[74px] w-[73px] flex-col items-center justify-center gap-1 overflow-hidden rounded-lg"
            >
              <div className="absolute inset-0 rounded-lg" style={{ backgroundImage: "linear-gradient(180deg, #0F111326 0%, #0F111366 100%)" }} />
              <span className="relative bg-clip-text font-display text-3xl leading-8 font-bold tracking-[-0.04em] text-transparent tabular-nums" style={GRAD_DIGIT}>
                {u.value === null ? "--" : String(u.value).padStart(2, "0")}
              </span>
              <span className="relative bg-clip-text text-xs leading-4 font-medium text-transparent" style={GRAD_UNIT}>
                {u.label}
              </span>
              <div className="absolute inset-0 rounded-lg [box-shadow:#0F111333_0px_-4px_32px_inset]" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
