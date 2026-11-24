"use client";

import { CircleAlert, Power, Star, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { LogoMark } from "@/components/brand/logo";
import { ads } from "@/content/ads";
import { useNow } from "@/lib/browser";
import { Artwork, Spinner, cn } from "@/ui";
import type { AdItem } from "./data";

export interface Shown {
  item: AdItem;
  formatName: string;
  output: string;
}

/** A round knob beside the screen: a grey rim, a dark face, a small white icon. */
function Knob({ size, face, className, children, ...rest }: { size: 34 | 38 | 44; face?: "dark" | "grey"; children: ReactNode } & ComponentProps<"button">) {
  const px = { 34: "size-[34px]", 38: "size-[38px]", 44: "size-[44px]" }[size];
  return (
    <button
      type="button"
      className={cn(
        "group flex shrink-0 items-center justify-center rounded-full bg-[linear-gradient(180deg,#34373C_0%,#0B0B0C_100%)] [box-shadow:#0000008C_0px_3px_8px] transition-[filter] duration-150 hover:brightness-125 disabled:opacity-40",
        px,
        className,
      )}
      {...rest}
    >
      <span
        className={cn(
          "mt-[2px] flex items-center justify-center rounded-full",
          face === "grey" ? "size-[25px] bg-[linear-gradient(180deg,#3A3D42_0%,#202226_100%)] text-text-secondary" : "size-[calc(100%-3px)] bg-[linear-gradient(180deg,#1E2023_0%,#050505_100%)] text-text-primary",
        )}
      >
        {children}
      </span>
    </button>
  );
}

function Progress({ shown }: { shown: Shown }) {
  const now = useNow();
  const job = shown.item.job ?? shown.item.speechJob;
  const running = shown.item.status === "running" && !!job?.startedAt;
  const share = running && now !== null && job && job.eta > 0 ? Math.min(0.95, Math.max(0.03, (now - job.startedAt! / 1000) / job.eta)) : 0.02;
  const label = shown.item.status === "waiting" ? ads.player.inLine : ads.player.making;
  return (
    <div className="shimmer absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface-secondary px-4 text-center">
      <Spinner className="text-text-tab" label={label} />
      <p className="text-sm leading-5 text-text-primary">{label}</p>
      <p className="text-xs leading-4 text-text-secondary">{shown.formatName}</p>
      <div className="absolute inset-x-0 bottom-0 h-[2px] bg-border-subtle">
        <div className="h-full bg-brand transition-[width] duration-1000 ease-linear" style={{ width: `${share * 100}%` }} data-testid="ads-progress" />
      </div>
    </div>
  );
}

function Screen({ shown, muted }: { shown: Shown | null; muted: boolean }) {
  if (!shown) {
    return (
      <>
        <Artwork name="ads/screen" className="absolute inset-0 size-full" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-[#00000059] px-6 text-center">
          <p className="font-display text-base leading-5 font-bold tracking-[-0.04em] text-text-primary uppercase">{ads.player.idle}</p>
          <p className="max-w-[300px] text-xs leading-4 text-text-tab">{ads.player.idleHint}</p>
        </div>
      </>
    );
  }
  const { item } = shown;
  if (item.status === "waiting" || item.status === "running") return <Progress shown={shown} />;
  if (item.status !== "succeeded" || !item.assets[0]) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface-secondary px-6 text-center" role="alert">
        <CircleAlert className="size-5 text-danger" strokeWidth={1.5} aria-hidden />
        <p className="line-clamp-2 text-sm leading-5 text-text-primary">{item.error?.message ?? ads.player.failed}</p>
        {item.status === "failed" ? <p className="text-xs leading-4 text-text-secondary">{ads.player.refunded}</p> : null}
      </div>
    );
  }
  const asset = item.assets[0];
  const alt = item.copy?.headline || shown.formatName;
  if (asset.kind === "video") {
    return (
      <video
        key={asset.id}
        src={asset.url}
        poster={asset.posterUrl ?? undefined}
        autoPlay
        loop
        playsInline
        muted={muted}
        aria-label={alt}
        className="absolute inset-0 size-full bg-black object-contain"
        data-testid="ads-video"
      />
    );
  }
  if (asset.kind === "audio") {
    return (
      <>
        <Artwork name="ads/screen-audio" className="absolute inset-0 size-full" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6">
          <p className="line-clamp-2 text-center text-sm leading-5 font-medium text-text-primary">{alt}</p>
          <audio key={asset.id} src={asset.url} controls muted={muted} className="w-full max-w-[320px]" data-testid="ads-audio" />
        </div>
      </>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img key={asset.id} src={asset.url} alt={alt} className="absolute inset-0 size-full bg-black object-contain" data-testid="ads-image" />
  );
}

/**
 * The little television at the top of the page. It shows the ad in hand: progress while it is
 * being made, the result once it is done. The knobs step through the campaign's ads, clear the
 * screen and switch the sound.
 */
export function Player({
  list,
  index,
  onIndex,
  onOff,
  muted,
  onMuted,
  onWinner,
}: {
  onWinner?: (item: AdItem) => void;
  list: Shown[];
  index: number;
  onIndex: (i: number) => void;
  onOff: () => void;
  muted: boolean;
  onMuted: (m: boolean) => void;
}) {
  const shown = list[index] ?? null;
  const many = list.length > 1;
  const prev = () => onIndex((index - 1 + list.length) % list.length);
  const next = () => onIndex((index + 1) % list.length);
  const prevKnob = (
    <Knob size={38} aria-label={ads.player.previous} disabled={!many} onClick={prev}>
      <SkipBack className="size-[14px] fill-current" strokeWidth={1.5} aria-hidden />
    </Knob>
  );
  const nextKnob = (
    <Knob size={38} aria-label={ads.player.next} disabled={!many} onClick={next}>
      <SkipForward className="size-[14px] fill-current" strokeWidth={1.5} aria-hidden />
    </Knob>
  );
  const offKnob = (
    <Knob size={44} aria-label={ads.player.off} disabled={!shown} onClick={onOff}>
      <Power className="size-4" strokeWidth={1.5} aria-hidden />
    </Knob>
  );
  const muteKnob = (
    <Knob size={34} face="grey" aria-label={muted ? ads.player.unmute : ads.player.mute} aria-pressed={!muted} onClick={() => onMuted(!muted)}>
      {muted ? <VolumeX className="size-[14px]" strokeWidth={1.5} aria-hidden /> : <Volume2 className="size-[14px]" strokeWidth={1.5} aria-hidden />}
    </Knob>
  );

  return (
    <section aria-label="Preview" className="relative w-full max-w-[672px] sm:aspect-[672/268]">
      {/* Soft light behind the knobs. */}
      <div aria-hidden className="absolute top-[38.4%] left-[6.4%] hidden h-[51.1%] w-[13.7%] bg-[radial-gradient(circle_farthest-corner_at_50%_50%,#8D95A414_0%,#8D95A406_45%,#8D95A400_100%)] sm:block" />
      <div aria-hidden className="absolute top-[11.94%] left-[78.27%] hidden h-[53.7%] w-[13.7%] bg-[radial-gradient(circle_farthest-corner_at_50%_50%,#8D95A417_0%,#8D95A406_45%,#8D95A400_100%)] sm:block" />
      {/* The set's dark bezel. */}
      <div aria-hidden className="absolute top-[4.48%] left-[16.22%] hidden h-[98.88%] w-[67.56%] rounded-[14px] bg-[linear-gradient(180deg,#0C0D0E_0%,#0E0F11_70%,#131416_100%)] [box-shadow:#00000080_0px_6px_18px] sm:block" />

      <div className="relative aspect-[423/238] w-full overflow-clip bg-surface-sunken sm:absolute sm:top-[9.33%] sm:left-[18.6%] sm:w-[62.95%]" data-testid="ads-screen">
        <Screen shown={shown} muted={muted} />
        {shown && many ? (
          <span className="absolute top-2 left-2 rounded-md bg-[#00000080] px-2 py-[2px] text-2xs leading-4 font-medium text-text-primary backdrop-blur-sm">
            {ads.player.of(index + 1, list.length)} · {shown.formatName}
          </span>
        ) : null}
        {shown?.item.status === "succeeded" && onWinner ? (
          <button
            type="button"
            aria-pressed={shown.item.winner}
            aria-label={shown.item.winner ? ads.player.unwin : ads.player.win}
            title={shown.item.winner ? ads.player.unwin : ads.player.win}
            onClick={() => onWinner(shown.item)}
            className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-md bg-[#00000080] text-text-primary backdrop-blur-sm transition-colors duration-150 hover:bg-[#000000B3]"
          >
            <Star className={cn("size-4", shown.item.winner && "fill-brand text-brand")} strokeWidth={1.5} aria-hidden />
          </button>
        ) : null}
      </div>

      {/* Badge and knobs, placed as drawn on wide screens. */}
      <div aria-hidden className="absolute top-[21.27%] left-[4.61%] hidden h-12 w-20 rounded-2xl bg-[linear-gradient(180deg,#080808_0%,#0E0E0E_65%,#232323_100%)] [box-shadow:#00000099_0px_1.65px_2.474px_inset] sm:block">
        <div className="absolute inset-1 rounded-xl border border-[#BBC4D233] bg-border-subtle [box-shadow:#FFFFFF0D_0px_0.66px_0.825px_inset,#0000007A_0px_1.237px_1.65px]" />
        <div className="absolute inset-x-1 top-[10px] flex flex-col items-center gap-[2px]">
          <LogoMark size={12} className="text-text-primary" />
          <span className="text-chrome font-display text-xs leading-[14px] font-bold tracking-[-0.04em] whitespace-nowrap uppercase">{ads.player.badge}</span>
        </div>
      </div>
      <div className="absolute top-[49.6%] left-[9.08%] hidden sm:block">{prevKnob}</div>
      <div className="absolute top-[64.55%] left-[12.05%] hidden sm:block">{nextKnob}</div>
      <div className="absolute top-[21.64%] left-[82.74%] hidden sm:block">{offKnob}</div>
      <div className="absolute top-[38.8%] left-[85.71%] hidden sm:block">{muteKnob}</div>

      {/* On a phone the knobs sit in a row under the screen. */}
      <div className="mt-3 flex items-center justify-center gap-3 sm:hidden">
        {prevKnob}
        {nextKnob}
        {offKnob}
        {muteKnob}
      </div>
    </section>
  );
}
