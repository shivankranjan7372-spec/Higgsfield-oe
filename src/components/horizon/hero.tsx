"use client";

import { Clapperboard, FileText } from "lucide-react";
import Link from "next/link";
import { horizonCopy } from "@/content/horizon";
import { Artwork } from "@/ui";
import { useLaunchNews, whiteButton } from "./news-button";
import { heroFill } from "./parts";

const copy = horizonCopy.hero;

/** The long fade from the picture into the black page under the hero copy. */
const fade = {
  backgroundImage:
    "linear-gradient(180deg, #00000000 0%, #00000013 11.79%, #00000027 21.38%, #0000003D 29.12%, #00000053 35.34%, #0000006A 40.37%, #00000080 44.56%, #00000096 48.24%, #000000AB 51.76%, #000000BF 55.44%, #000000D1 59.63%, #000000E0 64.66%, #000000ED 70.88%, #000000F7 78.62%, #000000FD 88.21%, #000000 100%)",
};

const badgeIcons = [FileText, Clapperboard];

export function HorizonHero() {
  const news = useLaunchNews();
  return (
    <section aria-labelledby="horizon-title" className="relative flex h-[640px] flex-col items-center justify-end overflow-hidden px-4 pb-10 desktop:h-[856px] desktop:px-16">
      <Artwork name={copy.art} className="absolute inset-0 size-full" />
      <div aria-hidden className="absolute inset-0 bg-[#00000033]" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-[416px]" style={fade} />

      <div className="relative flex w-full max-w-[1312px] flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-6">
          <p
            className="flex h-[34px] items-center gap-[10px] rounded-lg border border-[#C5C5C53D] bg-text-primary pr-[10px] pl-[6px] [box-shadow:#FFFFFF4C_0px_0px_6px_inset]"
            style={{ backgroundImage: "linear-gradient(180deg, #00000033 0%, #00000000 100%)" }}
          >
            {copy.badges.map((label, i) => {
              const Icon = badgeIcons[i];
              return (
                <span key={label} className="flex items-center gap-[10px]">
                  {i > 0 ? <span aria-hidden className="h-5 w-px bg-[#FFFFFFB2] [box-shadow:#00000026_-1px_0px_0px]" /> : null}
                  <span className="flex h-5 items-center">
                    <Icon size={20} strokeWidth={1.5} aria-hidden className="text-text-inverse" />
                    <span className="px-1 text-sm leading-5 font-medium whitespace-nowrap text-text-inverse desktop:text-base">{label}</span>
                  </span>
                </span>
              );
            })}
          </p>
          <div className="flex flex-col items-center gap-2 text-center">
            <h1
              id="horizon-title"
              className="bg-clip-text font-display text-[30px] leading-9 font-bold tracking-[-0.04em] text-transparent uppercase desktop:text-5xl desktop:leading-[56px]"
              style={heroFill}
            >
              {copy.title}
            </h1>
            <p className="text-sm leading-6 font-medium text-text-tab desktop:text-base">
              {copy.lead} <span className="text-[#FFFFFFE5]">{copy.leadStrong}</span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-4">
          {news.button}
          <Link href={copy.secondary.href} className={whiteButton}>
            {copy.secondary.label}
          </Link>
        </div>
        {news.noteLine}
      </div>
    </section>
  );
}
