"use client";

import Link from "next/link";
import { feedSections, modelSection, type FeedSectionDef } from "@/content/home";
import { routes } from "@/content/site";
import { cn } from "@/ui";
import { useExploreModels, type ExploreModel } from "./feed";
import { FeedSection } from "./feed-section";
import { HeroCarousel } from "./hero-carousel";
import { PromoFeatures } from "./promo-features";
import { CanvasBanner, CinemaBanner, ContestBanner, McpShowcase, MoreFeatures } from "./showcase";

const WRAP = "mx-auto w-full max-w-[1440px] px-4";

function Section({ def, className }: { def: FeedSectionDef; className?: string }) {
  const actions = def.actions ? (
    <div className="flex shrink-0 items-center gap-[7px]">
      {def.actions.map((a) => (
        <Link
          key={a.label}
          href={a.href}
          className={cn(
            "inline-flex h-12 items-center justify-center rounded-xl px-5 text-lg leading-6 font-semibold tracking-[-0.0222em] text-text-inverse transition-[filter] duration-150 hover:brightness-105",
            a.tone === "lime"
              ? "bg-brand bg-[linear-gradient(180deg,#FFFF1400_0%,#FFFF14_100%)] shadow-[inset_0_-3px_0_#829B19,0_6px_4px_#00000040,0_32px_24px_#00000026]"
              : "bg-text-primary shadow-[inset_0_-3px_0_#00000052,0_6px_4px_#00000040,0_32px_24px_#00000026] hover:brightness-95",
          )}
        >
          {a.label}
        </Link>
      ))}
    </div>
  ) : undefined;
  return (
    <div className={cn(WRAP, className)}>
      <FeedSection {...def} headerExtra={actions} />
    </div>
  );
}

/** A grid of one popular model's work. Drawn only when that model has posts. */
function ModelSection({ model, className }: { model: ExploreModel | undefined; className?: string }) {
  if (!model) return null;
  return (
    <div className={cn(WRAP, className)}>
      <FeedSection
        id={`model-${model.id}`}
        title={model.name}
        sub={modelSection.sub(model.posts)}
        look="masonry"
        query={{ tab: "trending", model: model.id }}
        more={{ label: modelSection.more(model.name), href: `${routes.explore}?model=${encodeURIComponent(model.id)}` }}
        empty={{ line: "", cta: "", href: routes.explore }}
      />
    </div>
  );
}

/** The front door: featured studios, the offer, the open contest and the community's work. */
export function HomePage() {
  const { data } = useExploreModels();
  const top = data?.models ?? [];
  return (
    <div className="flex flex-col pb-16">
      <HeroCarousel />

      <div className={cn(WRAP, "mt-8 flex flex-col gap-6 pt-2")}>
        <PromoFeatures />
        <McpShowcase />
      </div>

      <div className={cn(WRAP, "mt-10 empty:hidden")}>
        <ContestBanner />
      </div>

      <Section def={feedSections.shorts} className="mt-8" />
      <Section def={feedSections.trending} className="mt-16" />
      <Section def={feedSections.fresh} className="mt-16" />
      <Section def={feedSections.video} className="mt-8" />
      <Section def={feedSections.image} className="mt-6" />

      <div className={cn(WRAP, "mt-16")}>
        <CanvasBanner />
      </div>

      <ModelSection model={top[0]} className="mt-6" />
      <ModelSection model={top[1]} className="mt-16" />

      <div className={cn(WRAP, "mt-16")}>
        <CinemaBanner />
      </div>

      <Section def={feedSections.month} className="mt-16" />
      <ModelSection model={top[2]} className="mt-16" />

      <div className={cn(WRAP, "mt-16")}>
        <MoreFeatures />
      </div>
    </div>
  );
}
