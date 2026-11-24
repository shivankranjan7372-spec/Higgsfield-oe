"use client";

import {
  AudioLines,
  Clapperboard,
  Compass,
  Folder,
  ImagePlus,
  LayoutGrid,
  Megaphone,
  Music,
  Repeat2,
  Smartphone,
  Trophy,
  Video,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { forwardRef, type ReactNode } from "react";
import { VendorGlyph } from "@/components/brand/logo";
import { modelFlags, navMenus, type FeatureIcon, type MenuId } from "@/content/shell";
import { modelsFor, type ModelDef } from "@/registry";
import { Tag, cn } from "@/ui";

const icons: Record<FeatureIcon, LucideIcon> = {
  image: ImagePlus,
  canvas: Workflow,
  apps: LayoutGrid,
  library: Folder,
  explore: Compass,
  video: Video,
  cinema: Clapperboard,
  remix: Repeat2,
  shorts: Smartphone,
  ads: Megaphone,
  speech: AudioLines,
  music: Music,
  contests: Trophy,
};

/** The models a menu lists: every registry model of its surfaces, once each, in registry order. */
export function menuModels(id: MenuId): ModelDef[] {
  const seen = new Set<string>();
  const out: ModelDef[] = [];
  for (const s of navMenus[id].surfaces) {
    for (const m of modelsFor(s)) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        out.push(m);
      }
    }
  }
  return out;
}

/** One 64px row: a 48px tile on the left, a name and a line under it. */
function Row({
  href,
  tile,
  corner,
  title,
  tag,
  sub,
  onPick,
  wide,
}: {
  href: string;
  tile: ReactNode;
  corner?: "top" | null;
  title: string;
  tag?: ReactNode;
  sub: string;
  onPick: () => void;
  wide?: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={onPick}
      className={cn(
        "group flex h-16 shrink-0 items-center gap-3 rounded-2xl p-2 pr-3 transition-colors duration-150 hover:bg-border-subtle focus-visible:-outline-offset-2",
        wide ? "min-w-[476px]" : "min-w-[393px]",
      )}
    >
      <span
        className={cn(
          "relative flex size-12 shrink-0 items-center justify-center rounded-xl bg-surface-secondary-strong text-text-primary transition-colors duration-150 group-hover:bg-surface-tertiary",
          corner === "top" && "border border-[#FF005B3D]",
        )}
      >
        {tile}
        {corner === "top" ? (
          <span className="absolute -top-[7px] left-1 flex h-[18px] w-[38px] items-start justify-center rounded-xs bg-promo whitespace-nowrap font-display text-xs leading-[18px] font-bold text-text-primary uppercase">
            {modelFlags.featured}
          </span>
        ) : null}
      </span>
      <span className="flex min-w-0 flex-col gap-[3px]">
        <span className="flex items-center gap-[6px]">
          <span className="truncate font-display text-sm leading-5 font-medium text-text-soft">{title}</span>
          {tag}
        </span>
        <span className="max-w-[400px] truncate text-sm leading-5 text-text-muted">{sub}</span>
      </span>
    </Link>
  );
}

/**
 * The big menu under Image, Video or Audio: our own pages on the left, the
 * registry's models on the right. Each model row opens its studio with `?model=<id>`.
 */
export const NavMenuPanel = forwardRef<HTMLDivElement, { id: MenuId; label: string; onPick: () => void; domId: string }>(
  function NavMenuPanel({ id, label, onPick, domId }, ref) {
    const spec = navMenus[id];
    const list = menuModels(id);
    return (
      <div
        ref={ref}
        id={domId}
        role="region"
        aria-label={label}
        className="flex max-h-[min(802px,calc(100dvh-112px))] max-w-[calc(100vw-32px)] animate-rise-in overflow-y-auto rounded-4xl border border-[#D9D9D90A] bg-surface-menu [box-shadow:#0000004C_0px_20px_25px_-5px,#0000004C_0px_8px_10px_-6px] scroll-quiet"
      >
        <div className="flex shrink-0 flex-col pt-3 pb-2 pl-3" role="group" aria-label={spec.featuresLabel}>
          <div className="flex h-5 shrink-0 items-start pl-2 text-sm leading-5 text-text-muted">{spec.featuresLabel}</div>
          {spec.features.map((f) => {
            const Icon = icons[f.icon];
            return (
              <Row
                key={f.label}
                href={f.href}
                tile={<Icon className="size-6" strokeWidth={1.5} aria-hidden />}
                title={f.label}
                sub={f.blurb}
                onPick={onPick}
              />
            );
          })}
        </div>
        {list.length > 0 ? (
          <div className="flex shrink-0 flex-col pt-3 pr-3 pb-2" role="group" aria-label={spec.modelsLabel}>
            <div className="flex h-5 shrink-0 items-start pl-2 text-sm leading-5 text-text-muted">{spec.modelsLabel}</div>
            {list.map((m) => (
              <Row
                key={m.id}
                wide
                href={`${spec.studio}?model=${encodeURIComponent(m.id)}`}
                tile={
                  <span className="flex size-6 items-center justify-center">
                    <VendorGlyph vendor={m.vendor} className="scale-150" />
                  </span>
                }
                corner={m.featured && m.status === "available" ? "top" : null}
                title={m.name}
                tag={
                  m.status !== "available" ? (
                    <Tag tone="neutral">{m.status === "soon" ? modelFlags.soon : modelFlags.offline}</Tag>
                  ) : null
                }
                sub={m.status !== "available" && m.statusNote ? m.statusNote : m.tagline}
                onPick={onPick}
              />
            ))}
          </div>
        ) : null}
      </div>
    );
  },
);
