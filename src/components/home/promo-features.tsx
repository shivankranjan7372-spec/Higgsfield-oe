"use client";

import { Clapperboard, Cpu, Film, Layers, Plug, Sparkles } from "lucide-react";
import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";
import { featureTiles, promoCard, type FeatureTile } from "@/content/home";
import { promo, routes } from "@/content/site";
import { useNow } from "@/lib/browser";
import { useSession } from "@/lib/session";
import { cn } from "@/ui";

const ICONS: Record<FeatureTile["icon"], typeof Film> = {
  remix: Layers,
  video: Film,
  agent: Cpu,
  cinema: Clapperboard,
  mcp: Plug,
  horizon: Sparkles,
};

const LIME_BUTTON =
  "inline-flex h-10 items-center justify-center rounded-lg bg-brand bg-[linear-gradient(180deg,#FFFF1400_0%,#FFFF14_100%)] px-4 text-sm leading-4 font-semibold whitespace-nowrap text-text-inverse shadow-[inset_0_-3px_0_#829B19,0_32px_24px_#00000026] transition-[filter] duration-150 hover:brightness-105";

function Countdown({ endsAt }: { endsAt: number }) {
  const now = useNow();
  const left = now === null ? null : Math.max(0, endsAt - now);
  const h = left === null ? "--" : String(Math.floor(left / 3600));
  const m = left === null ? "--" : String(Math.floor((left % 3600) / 60)).padStart(2, "0");
  const s = left === null ? "--" : String(left % 60).padStart(2, "0");
  return (
    <div
      className="flex h-[22px] w-fit items-center gap-[6px] rounded-[7px] bg-black bg-[radial-gradient(circle_farthest-corner_at_57%_100%,#ED157233_0%,#ED157200_100%)] p-[3px] pr-[6px] shadow-[0_2px_2px_#00000014]"
      role="timer"
      aria-label={`${promoCard.timerLabel} ${h} hours ${m} minutes`}
    >
      <span
        className="flex h-4 items-center rounded-xs bg-promo px-1 text-xs leading-4 font-semibold text-text-primary shadow-[inset_0_0_0_1px_#FFFFFF0D,inset_0_-2px_2px_#FFFFFF66,inset_0_2px_2px_#FFFFFF66]"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 55% 95% at 73% 50%, #EF1DBA99 0%, #ED157200 100%), radial-gradient(ellipse 25% 42% at 85% 37%, #FFFFFF99 0%, #FFFFFF00 100%)",
        }}
      >
        {promoCard.timerLabel}
      </span>
      <span className="flex items-center gap-1 font-mono text-xs leading-4 font-semibold text-text-primary tabular-nums" aria-hidden>
        <span>
          {h}
          <span className="text-[#FFFFFF66]">h</span>
        </span>
        <span>
          {m}
          <span className="text-[#FFFFFF66]">m</span>
        </span>
        <span>
          {s}
          <span className="text-[#FFFFFF66]">s</span>
        </span>
      </span>
    </div>
  );
}

/** The pink offer card. Uses the real launch offer from site.ts and drops the timer once it ends. */
function PromoCard() {
  const now = useNow();
  const endsAt = Math.floor(Date.parse(promo.endsAt) / 1000);
  const live = promo.enabled && (now === null || now < endsAt);
  const { member } = useSession();
  // Someone with an account is not asked to make one: they go to the code field in their wallet.
  const words = live
    ? member
      ? { one: promoCard.lineOne, two: promoCard.lineTwo, body: promoCard.memberBody(promo.code), cta: promo.memberCta.label, href: promo.memberCta.href }
      : { one: promoCard.lineOne, two: promoCard.lineTwo, body: promoCard.body(promo.code), cta: promo.cta.label, href: promo.cta.href }
    : member
      ? { one: promoCard.after.lineOne, two: promoCard.after.lineTwo, body: promoCard.after.memberBody, cta: promoCard.after.memberCta, href: routes.image }
      : { one: promoCard.after.lineOne, two: promoCard.after.lineTwo, body: promoCard.after.body, cta: promoCard.after.cta, href: routes.join };

  return (
    <div className="relative w-full lg:w-[640px] lg:shrink-0">
      <div className="relative flex min-h-[272px] flex-col overflow-hidden rounded-2xl bg-surface-primary p-4 lg:h-[272px]">
        <div
          aria-hidden
          className="absolute inset-0 rounded-2xl"
          style={{
            backgroundImage:
              "linear-gradient(180deg, #D93E97 0.8%, #BB1F7B 3.8%, #9A015F 10%, #7C004A 20%, #65003B 30%, #51002F 40%, #420028 50%, #2C0013 60%, #1A0001 70%, #0C0000 80%, #050000 100%)",
          }}
        />
        <div className="relative flex flex-1 flex-col">
          {live ? <Countdown endsAt={endsAt} /> : <div className="h-[22px]" />}
          <h2 className="mt-5 flex flex-col font-display text-2xl leading-7 font-bold tracking-[-0.04em] uppercase sm:text-3xl sm:leading-8">
            <span className="flex items-center gap-[6px] text-text-primary">
              {words.one}
              <span
                aria-hidden
                className="flex size-7 items-center justify-center rounded-md shadow-[inset_0_0_0_1px_#FFFFFF33,inset_0_0_5.664px_0.944px_#FF84B9CC]"
                style={{ backgroundImage: "radial-gradient(ellipse 100% 140% at 50% 117%, #DC4F8C 0%, #ED3283 50%, #FF167B 100%)" }}
              >
                <LogoMark size={18} className="text-text-primary" />
              </span>
            </span>
            <span className="text-promo">{words.two}</span>
          </h2>
          <p className="mt-3 max-w-[480px] text-sm leading-5 text-[#DF99C5]">{words.body}</p>
          <div className="mt-auto pt-5">
            <Link href={words.href} className={LIME_BUTTON}>
              {words.cta}
            </Link>
          </div>
        </div>
      </div>
      {live && (
        <div aria-hidden className="absolute top-[6px] right-[-4px] hidden rotate-[8deg] rounded-xs bg-brand px-[6px] py-1 sm:block">
          <p className="flex flex-col text-right font-racing text-xl leading-4 tracking-[-0.02em] whitespace-nowrap text-text-inverse uppercase">{promoCard.sticker(promo.code).map((l) => <span key={l}>{l}</span>)}</p>
        </div>
      )}
    </div>
  );
}

function FeatureCard({ tile }: { tile: FeatureTile }) {
  const Icon = ICONS[tile.icon];
  return (
    <Link
      href={tile.href}
      className="group flex h-[130px] items-center justify-center rounded-2xl border border-border-subtle p-[2px] transition-colors duration-150 hover:border-border-default"
    >
      <span className="flex size-full flex-col justify-between overflow-hidden rounded-xl bg-surface-secondary-strong px-[14px] py-[14px] transition-colors duration-150 group-hover:bg-surface-tertiary">
        <Icon className="size-5 shrink-0 text-text-primary" strokeWidth={1.5} aria-hidden />
        <span className="flex min-w-0 flex-col gap-[3px]">
          <span className="flex h-6 min-w-0 items-center gap-1">
            <span className="truncate text-sm leading-6 font-semibold text-text-primary">{tile.title}</span>
            {tile.tag && (
              <span
                className={cn(
                  "flex h-[18px] shrink-0 items-center rounded-xs px-[7px] font-display text-xs leading-[18px] font-bold uppercase",
                  tile.tag.tone === "brand" ? "bg-brand text-ink" : "bg-[#5E6369] text-text-primary",
                )}
              >
                {tile.tag.label}
              </span>
            )}
          </span>
          <span className="line-clamp-2 text-xs leading-[18px] text-text-muted">{tile.sub}</span>
        </span>
      </span>
    </Link>
  );
}

/** The offer card and the six studio tiles beside it. */
export function PromoFeatures() {
  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:justify-between">
      <PromoCard />
      <nav aria-label="Studios" className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:w-[748px] lg:shrink-0 lg:gap-x-[12px] lg:gap-y-3">
        {featureTiles.map((t) => (
          <FeatureCard key={t.id} tile={t} />
        ))}
      </nav>
    </div>
  );
}

