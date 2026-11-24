"use client";

import { LoaderCircle, TriangleAlert } from "lucide-react";
import { cinema } from "@/content/cinema";
import { Artwork, cn } from "@/ui";
import { type Shot } from "./data";
import { useCinema } from "./state";
import { TakeMedia } from "./take-media";

/** The sheen and edge light the design lays over every poster tile. */
function Sheen({ className }: { className?: string }) {
  return (
    <>
      <span aria-hidden className={cn("pointer-events-none absolute inset-0 opacity-60 [background-image:linear-gradient(0deg,#00000000_0%,#FFFFFF3D_100%)]", className)} />
      <span
        aria-hidden
        className={cn("pointer-events-none absolute inset-0 border border-transparent [mask-composite:exclude] [mask:linear-gradient(#000_0_0)_padding-box,linear-gradient(#000_0_0)]", className)}
        style={{ backgroundImage: "linear-gradient(180deg, #FFFFFF70 0%, #FFFFFF4C 48%, #FFFFFF1F 100%)", backgroundOrigin: "border-box" }}
      />
    </>
  );
}

function PosterBody({ shot, slot }: { shot: Shot | null; slot: string }) {
  if (!shot) return <Artwork name={slot} className="size-full" />;
  const take = shot.selectedTake ?? null;
  if (take?.asset) return <TakeMedia take={take} still className="size-full object-cover" />;
  return (
    <div className="flex size-full flex-col items-center justify-center gap-1 bg-surface-secondary px-3 text-center">
      {shot.status === "generating" ? (
        <div className="shimmer absolute inset-0 bg-surface-secondary" aria-hidden />
      ) : null}
      <span className="relative font-display text-sm leading-5 font-bold text-text-primary uppercase">{cinema.posters.shot(shot.number ?? "")}</span>
      <span className="relative flex items-center gap-1 text-xs leading-4 text-text-secondary">
        {shot.status === "generating" ? <LoaderCircle className="size-3 animate-spin" strokeWidth={2} aria-hidden /> : null}
        {shot.status === "failed" ? <TriangleAlert className="size-3 text-danger" strokeWidth={1.5} aria-hidden /> : null}
        {shot.status === "generating" ? cinema.takes.running : shot.status === "failed" ? cinema.takes.failed : cinema.posters.emptyShot}
      </span>
    </div>
  );
}

function Side({ shot, slot, side, live, onPick }: { shot: Shot | null; slot: string; side: "left" | "right"; live: boolean; onPick: (id: string) => void }) {
  const box = cn(
    "absolute top-[17px] h-[81px] w-[144px] overflow-clip rounded-[8px] bg-[#00000033] sm:top-[27px] sm:h-[112px] sm:w-[200px] sm:rounded-[11px]",
    side === "left" ? "left-0 sm:left-[66px]" : "right-0 sm:left-[421px] sm:right-auto",
  );
  if (live && shot) {
    return (
      <button type="button" onClick={() => onPick(shot.id)} aria-label={cinema.posters.pick(shot.number ?? "")} className={cn(box, "transition-[filter] duration-150 hover:brightness-125")}>
        <PosterBody shot={shot} slot={slot} />
        <Sheen className="rounded-[inherit]" />
      </button>
    );
  }
  return (
    <div className={box} aria-hidden>
      {live ? <div className="size-full bg-surface-secondary/60" /> : <Artwork name={slot} className="size-full" />}
      <Sheen className="rounded-[inherit]" />
    </div>
  );
}


/**
 * The row of three poster tiles and the headline over the composer. With a project open the
 * middle tile is the chosen shot and the side tiles are the shots before and after it.
 */
export function Stage() {
  const { allShots, shotId, setShotId, project } = useCinema();
  const i = allShots.findIndex((s) => s.id === shotId);
  const current = i >= 0 ? allShots[i] : null;
  const prev = i > 0 ? allShots[i - 1] : null;
  const next = i >= 0 && i < allShots.length - 1 ? allShots[i + 1] : null;
  const live = !!project;

  return (
    <div className="flex flex-col items-center px-4">
      <div className="relative h-[120px] w-[352px] max-w-full sm:h-[166px] sm:w-[687px]">
        <Side shot={prev} slot="cinema/poster-left" side="left" live={live} onPick={setShotId} />
        <Side shot={next} slot="cinema/poster-right" side="right" live={live} onPick={setShotId} />
        <div className="absolute top-[4px] left-1/2 z-10 h-[112px] w-[200px] -translate-x-1/2 overflow-clip rounded-[9px] bg-[#00000033] sm:top-[5px] sm:left-[205px] sm:h-[156px] sm:w-[277px] sm:translate-x-0 sm:rounded-xl">
          {live ? <PosterBody shot={current} slot="cinema/poster-centre" /> : <Artwork name="cinema/poster-centre" className="size-full" />}
          <Sheen className="rounded-[inherit]" />
        </div>
      </div>
      <h1
        className="mt-6 max-w-full truncate bg-clip-text pb-[2px] text-center font-display text-[28px] leading-[30px] font-bold tracking-[-0.04em] text-transparent uppercase sm:mt-10 sm:text-[40px] sm:leading-[36px]"
        style={{ backgroundImage: "linear-gradient(180deg, #FFFFFF 14%, #FFFFFF69 100%)" }}
      >
        {project ? project.title : cinema.headline}
      </h1>
    </div>
  );
}
