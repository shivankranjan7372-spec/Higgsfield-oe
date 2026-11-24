"use client";

import { X } from "lucide-react";
import { useEffect } from "react";
import { LogoMark } from "@/components/brand/logo";
import { brand } from "@/config/brand";
import { promo } from "@/content/site";
import { useNow } from "@/lib/browser";
import { closeForGood, hideNow } from "@/lib/closable";
import { useSession } from "@/lib/session";
import { ButtonLink, IconButton } from "@/ui";

const END = Math.floor(Date.parse(promo.endsAt) / 1000);

/* The three light sources on the pink strip, as drawn. The flat pink underneath is `bg-promo`. */
const STRIP_LIGHT =
  "radial-gradient(ellipse 97% 107% at 73.2% 50% in oklab, #EF1DBA99 0%, #ED157200 100%), radial-gradient(ellipse 42.4% 46.9% at 84.6% 36.6% in oklab, #FFFFFF99 0%, #FFFFFF00 100%), radial-gradient(ellipse 69.9% 69.9% at 11.6% 76.1% in oklab, #B01DEF99 0%, #CE19B04C 50%, #ED157200 100%)";
const CHIP_LIGHT = "radial-gradient(ellipse 70% 100% at 26% 100% in oklab, #ED157233 0%, #ED157200 100%)";
const LABEL_LIGHT =
  "radial-gradient(ellipse 55% 95% at 73% 50% in oklab, #EF1DBA99 0%, #ED157200 100%), radial-gradient(ellipse 25% 42% at 85% 37% in oklab, #FFFFFF99 0%, #FFFFFF00 100%), radial-gradient(ellipse 33% 70% at 12% 76% in oklab, #B01DEF99 0%, #CE19B080 50%, #ED157200 100%)";
const LABEL_TEXT = "linear-gradient(in oklab 180deg, #FFFFFF 0%, #FFFFFFCC 100%)";

function Unit({ value, letter, tight }: { value: number | null; letter: string; tight?: boolean }) {
  return (
    <span className={tight ? "flex items-center gap-[2px]" : "flex items-center gap-[3px]"}>
      {/* Before the page is live the digits hold their place but stay unseen. */}
      <span className={value === null ? "invisible font-semibold text-text-primary" : "font-semibold text-text-primary"}>
        {String(value ?? 0).padStart(2, "0")}
      </span>
      <span className="font-medium text-[#FFFFFF66]">{letter}</span>
    </span>
  );
}

/**
 * The 40px offer strip above the nav. The countdown runs to a real deadline (see `promo` in
 * src/content/site.ts); at zero the strip removes itself. Closing it is remembered.
 */
export function PromoBanner() {
  const now = useNow();
  const { member } = useSession();
  const cta = member ? promo.memberCta : promo.cta;
  const left = now === null ? null : Math.max(0, END - now);
  const over = left === 0;

  useEffect(() => {
    if (over) hideNow("promo");
  }, [over]);

  if (!promo.enabled) return null;

  const days = left === null ? null : Math.floor(left / 86400);
  const hours = left === null ? null : Math.floor((left % 86400) / 3600);
  const minutes = left === null ? null : Math.floor((left % 3600) / 60);
  const seconds = left === null ? null : left % 60;

  return (
    <aside
      data-closable="promo"
      aria-label="Offer"
      className="flex h-10 shrink-0 items-center overflow-clip bg-promo pr-3 pl-4 [box-shadow:#FFFFFF33_0px_-2px_16px_inset,#FFFFFF33_0px_2px_16px_inset]"
      style={{ backgroundImage: STRIP_LIGHT }}
    >
      <div className="flex min-w-0 items-center gap-2">
        <div
          className="flex h-6 shrink-0 items-center gap-2 rounded-md bg-[#000000E6] pr-[10px] pl-[5px] [box-shadow:#0000001A_0px_2px_4px]"
          style={{ backgroundImage: CHIP_LIGHT }}
          role="timer"
          aria-label={left === null ? promo.countdownLabel : `${promo.countdownLabel} ${days} days ${hours} hours ${minutes} minutes`}
        >
          <span
            className="flex h-4 items-center overflow-clip rounded-xs bg-promo px-1 [box-shadow:#FFFFFF0D_0px_0px_0px_1px_inset,#FFFFFF66_0px_-2px_2px_inset,#FFFFFF66_0px_2px_2px_inset]"
            style={{ backgroundImage: LABEL_LIGHT }}
          >
            <span
              className="bg-clip-text text-xs leading-4 font-semibold whitespace-nowrap text-transparent"
              style={{ backgroundImage: LABEL_TEXT }}
            >
              {promo.countdownLabel}
            </span>
          </span>
          <span aria-hidden className="flex items-center gap-1 text-xs leading-4 whitespace-nowrap tabular-nums">
            {days === null || days > 0 ? <Unit value={days} letter="d" /> : null}
            <Unit value={hours} letter="h" />
            <Unit value={minutes} letter="m" />
            <Unit value={seconds} letter="s" tight />
          </span>
        </div>
        <p className="hidden min-w-0 items-center gap-[6px] text-sm leading-5 font-semibold text-text-primary md:flex">
          <span className="truncate">{promo.text}</span>
          <span className="flex shrink-0 items-center gap-[6px]">
            <LogoMark size={18} />
            {brand.name}
          </span>
        </p>
      </div>
      <ButtonLink href={cta.href} variant="white" size="pill-xs" className="ml-auto">
        {cta.label}
      </ButtonLink>
      <IconButton size={28} aria-label="Close this offer" className="ml-3 opacity-50 hover:opacity-100" onClick={() => closeForGood("promo")}>
        <X className="size-5" strokeWidth={1.5} aria-hidden />
      </IconButton>
    </aside>
  );
}
