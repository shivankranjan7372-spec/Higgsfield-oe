"use client";

import { Pin, PinOff, Play } from "lucide-react";
import Link from "next/link";
import { appsCopy } from "@/content/apps";
import { routes } from "@/content/site";
import { Artwork, cn } from "@/ui";
import type { AppSummary } from "./types";

/* Both card looks share the dark plate: #131517, 16 radius, a faint inset light. */
const plate =
  "group relative flex flex-col overflow-clip rounded-2xl bg-[#131517] shadow-[#FFFFFF05_2px_2px_2px_inset] transition-colors duration-150 hover:bg-surface-secondary focus-within:bg-surface-secondary";

export function appHref(id: string) {
  return `${routes.apps}/${id}`;
}

function Badge({ app }: { app: AppSummary }) {
  if (app.status === "soon") {
    return (
      <span className="absolute bottom-2 left-2 flex h-[18px] items-start rounded-xs bg-surface-elevated px-1 font-display text-sm leading-[18px] font-bold text-text-primary uppercase">
        {appsCopy.soon}
      </span>
    );
  }
  if (!app.badge) return null;
  return (
    <span className="absolute bottom-2 left-2 flex h-[18px] items-start rounded-xs bg-brand px-1 font-display text-sm leading-[18px] font-bold text-black uppercase">
      {appsCopy.badge[app.badge] ?? app.badge}
    </span>
  );
}

export interface PinProps {
  /** Null when signed out: the button then asks to sign in. */
  onPin: (app: AppSummary) => void;
}

function PinButton({ app, onPin }: { app: AppSummary } & PinProps) {
  const pinned = app.pinned === true;
  const label = app.pinned === null ? appsCopy.pinSignIn : pinned ? appsCopy.unpin(app.name) : appsCopy.pin(app.name);
  const Icon = pinned ? PinOff : Pin;
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={app.pinned === null ? undefined : pinned}
      title={label}
      onClick={() => onPin(app)}
      className={cn(
        "absolute top-2 right-2 z-10 flex size-7 items-center justify-center rounded-md bg-[#00000080] text-text-primary backdrop-blur-sm transition duration-150 hover:bg-[#000000B3] focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100",
        pinned ? "opacity-100" : "opacity-0",
      )}
    >
      <Icon className="size-4" strokeWidth={1.5} aria-hidden />
    </button>
  );
}

/** The tall card of the first row: a 227-high picture, name, two lines, and a white "Try now". */
export function FeaturedCard({ app, onPin }: { app: AppSummary } & PinProps) {
  return (
    <li className={cn(plate, "h-[401px] w-[237px] shrink-0 desktop:w-auto")} data-app={app.id}>
      <div className="relative h-[227px] w-full shrink-0 overflow-clip rounded-t-xl">
        <Artwork name={`apps/${app.id}`} className={cn("size-full", app.status === "soon" && "opacity-50")} />
        <Badge app={app} />
      </div>
      <div className="flex flex-1 flex-col items-stretch justify-center gap-6 px-4">
        <div className="flex h-[68px] min-w-0 flex-col gap-1">
          <h3 className="truncate text-base leading-6 font-semibold text-text-primary">{app.name}</h3>
          <p className="line-clamp-2 text-sm leading-5 text-[#FFFFFF99]">{app.pitch}</p>
        </div>
        <Link
          href={appHref(app.id)}
          aria-label={`${appsCopy.tryNow}: ${app.name}`}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-text-primary text-sm leading-5 font-semibold text-[#131517] shadow-[#E6E6E6_0px_1px_0px_inset,#C1C1C1_0px_-2px_0px_inset,#00000026_10px_34px_24px,#C1C1C1_0px_-3px_0px] backdrop-blur-md transition-colors duration-150 hover:bg-text-soft"
        >
          <Play className="size-3 fill-current" strokeWidth={1.5} aria-hidden />
          {appsCopy.tryNow}
        </Link>
      </div>
      <PinButton app={app} onPin={onPin} />
    </li>
  );
}

/** The regular card: a 196-high picture inset by 16, then the name and two lines. */
export function AppCard({ app, onPin, fluid }: { app: AppSummary; fluid?: boolean } & PinProps) {
  const soon = app.status === "soon";
  return (
    <li className={cn(plate, "h-[330px] p-4", fluid ? "w-auto" : "w-[237px] shrink-0 desktop:w-auto")} data-app={app.id} title={soon ? (app.note ?? undefined) : undefined}>
      <div className="relative h-[196px] w-full shrink-0 overflow-clip rounded-xl">
        <Artwork name={`apps/${app.id}`} className={cn("size-full", soon && "opacity-50")} />
        <Badge app={app} />
      </div>
      <div className="flex min-w-0 flex-col gap-1 pt-4">
        <h3 className={cn("truncate text-base leading-6 font-semibold", soon ? "text-text-secondary" : "text-text-primary")}>
          <Link href={appHref(app.id)} className="outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:ring-2 focus-visible:after:ring-brand">
            {app.name}
          </Link>
        </h3>
        <p className="line-clamp-2 text-sm leading-5 text-[#FFFFFF99]">{soon && app.note ? app.note : app.pitch}</p>
      </div>
      <PinButton app={app} onPin={onPin} />
    </li>
  );
}

/** A grey card in the shape of a regular one, while the catalog loads. */
export function CardSkeleton({ tall, fluid }: { tall?: boolean; fluid?: boolean }) {
  return (
    <li aria-hidden className={cn("shimmer rounded-2xl bg-[#131517]", tall ? "h-[401px]" : "h-[330px]", fluid ? "w-auto" : "w-[237px] shrink-0 desktop:w-auto")} />
  );
}
