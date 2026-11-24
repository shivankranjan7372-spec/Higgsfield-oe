"use client";

import { Flame } from "lucide-react";
import { formatCredits } from "@/config/economy";
import { ads } from "@/content/ads";
import { Artwork } from "@/ui";
import type { AdFormat } from "./data";

/**
 * "Start from a style": one tall tile per style in the catalog. Choosing a tile puts that
 * style in the composer (and a starter line in an empty script box).
 */
export function Trending({ formats, loading, failed, onRetry, onChoose }: { formats: AdFormat[]; loading: boolean; failed: boolean; onRetry: () => void; onChoose: (f: AdFormat) => void }) {
  const shown = formats.filter((f) => f.available);
  return (
    <section aria-labelledby="ads-trending" className="flex w-full flex-col items-center gap-4 pb-10">
      <h2 id="ads-trending" className="flex h-5 items-center gap-2">
        <Flame className="size-4 fill-brand text-brand" strokeWidth={1.5} aria-hidden />
        <span className="bg-[radial-gradient(circle_farthest-corner_at_50%_50%,#FFFFFF_0%,#CCCCCC_50%,#999999_100%)] bg-clip-text text-base leading-5 font-semibold tracking-[-0.025em] text-transparent">
          {ads.trending.title}
        </span>
      </h2>
      {failed ? (
        <p role="alert" className="flex items-center gap-2 text-sm leading-5 text-text-secondary">
          {ads.trending.loadError}
          <button type="button" onClick={onRetry} className="font-medium text-text-primary hover:underline">
            {ads.sidebar.retry}
          </button>
        </p>
      ) : (
        <ul className="grid w-full grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {loading
            ? [0, 1, 2, 3].map((i) => <li key={i} className="shimmer aspect-[245/351] rounded-2xl border border-border-subtle bg-surface-secondary" />)
            : shown.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => onChoose(f)}
                    aria-label={`${ads.trending.choose}: ${f.name}`}
                    className="group relative block aspect-[245/351] w-full overflow-clip rounded-2xl border border-border-subtle bg-surface-secondary text-left"
                  >
                    <Artwork name={`ads/style-${f.id}`} className="absolute inset-0 size-full transition-transform duration-300 ease-out-soft group-hover:scale-[1.03]" />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,#00000000_39.24%,#131416CC_87.22%)]" />
                    <div className="absolute inset-0 rounded-2xl [box-shadow:#FFFFFF1A_0px_-8px_36px_inset]" />
                    <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 p-3 sm:p-4">
                      <span className="text-sm leading-5 font-semibold text-text-primary">{f.name}</span>
                      <span className="line-clamp-2 text-xs leading-4 text-text-tab">{f.platform.label}</span>
                      {f.pricePerAd !== null ? <span className="text-2xs leading-3 font-medium text-brand">{formatCredits(f.pricePerAd)} {ads.pickers.perAd}</span> : null}
                    </div>
                  </button>
                </li>
              ))}
        </ul>
      )}
    </section>
  );
}
