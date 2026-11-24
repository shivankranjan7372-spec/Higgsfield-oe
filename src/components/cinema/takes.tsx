"use client";

import { Check, Download, Film, LoaderCircle, Trash2, TriangleAlert } from "lucide-react";
import { mutate } from "swr";
import { cinema } from "@/content/cinema";
import { api } from "@/lib/api";
import { cn } from "@/ui";
import { isWorking, refreshProject, shotKey, type Take } from "./data";
import { useCinema } from "./state";
import { TakeMedia } from "./take-media";

const t = cinema.takes;

const actionClass =
  "flex h-7 items-center gap-1 rounded-md bg-surface-glass px-2 text-xs leading-4 font-medium text-text-primary backdrop-blur-md transition-colors duration-150 hover:bg-surface-elevated";

function TakeTile({ take, chosen }: { take: Take; chosen: boolean }) {
  const { shot, generate, report, busy } = useCinema();
  const done = take.status === "succeeded" && !!take.asset;

  async function choose() {
    if (!shot) return;
    try {
      await api(shotKey(shot.id), { method: "PATCH", body: { selectedTakeId: chosen ? null : take.id } });
      await mutate(shotKey(shot.id));
      refreshProject(shot.projectId);
    } catch (e) {
      report(e);
    }
  }

  async function remove() {
    if (!shot) return;
    try {
      await api(`/api/cinema/takes/${take.id}`, { method: "DELETE" });
      await mutate(shotKey(shot.id));
      refreshProject(shot.projectId);
    } catch (e) {
      report(e);
    }
  }

  return (
    <li
      className={cn(
        "group relative aspect-video w-[240px] shrink-0 overflow-clip rounded-xl bg-surface-secondary sm:w-[277px]",
        chosen && "outline-2 outline-offset-2 outline-brand",
      )}
      data-status={take.status}
    >
      {done ? (
        <TakeMedia take={take} className="size-full object-cover" />
      ) : isWorking(take) ? (
        <div className="shimmer flex size-full flex-col items-center justify-center gap-1 bg-surface-secondary text-xs leading-4 text-text-secondary">
          <LoaderCircle className="size-4 animate-spin" strokeWidth={1.5} aria-hidden />
          {take.status === "queued" ? t.queued : t.running}
        </div>
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-1 px-4 text-center text-xs leading-4 text-text-secondary">
          <TriangleAlert className="size-4 text-danger" strokeWidth={1.5} aria-hidden />
          <span className="font-medium text-text-primary">{t.failed}</span>
          <span className="line-clamp-2">{take.error?.message ?? ""}</span>
        </div>
      )}
      <span className="pointer-events-none absolute top-2 left-2 flex items-center gap-1 rounded-sm bg-surface-glass px-[6px] py-[2px] text-2xs leading-3 font-medium text-text-primary backdrop-blur-md">
        {take.output === "video" ? <Film className="size-3" strokeWidth={1.5} aria-hidden /> : null}
        {take.output === "video" ? t.video : t.still}
        {chosen ? <span className="text-brand">· {t.chosen}</span> : null}
      </span>
      <div className="absolute inset-x-2 bottom-2 flex flex-wrap justify-end gap-1 opacity-100 transition-opacity duration-150 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:opacity-100">
        {done ? (
          <button type="button" onClick={() => void choose()} aria-pressed={chosen} className={cn(actionClass, chosen && "text-brand")}>
            <Check className="size-4" strokeWidth={1.5} aria-hidden />
            {chosen ? t.chosen : t.choose}
          </button>
        ) : null}
        {done && take.output === "image" ? (
          <button type="button" disabled={busy} onClick={() => void generate({ mode: "animate", fromTakeId: take.id })} aria-label={t.animate} className={cn(actionClass, "w-7 justify-center px-0")}>
            <Film className="size-4" strokeWidth={1.5} aria-hidden />
          </button>
        ) : null}
        {done && take.asset ? (
          <a href={`${take.asset.url}?download=1`} aria-label={t.download} className={cn(actionClass, "w-7 justify-center px-0")}>
            <Download className="size-4" strokeWidth={1.5} aria-hidden />
          </a>
        ) : null}
        {!isWorking(take) ? (
          <button type="button" onClick={() => void remove()} aria-label={t.remove} className={cn(actionClass, "w-7 justify-center px-0 hover:text-danger")}>
            <Trash2 className="size-4" strokeWidth={1.5} aria-hidden />
          </button>
        ) : null}
      </div>
    </li>
  );
}

/** Every take of the open shot, newest first, with the chosen one outlined. */
export function Takes() {
  const { shot, shotLoading, shotId, allShots } = useCinema();
  const number = allShots.find((s) => s.id === shotId)?.number;
  if (!shotId) return null;
  const takes = [...(shot?.takes ?? [])].filter((k) => k.status !== "removed" && k.status !== "canceled").reverse();
  const chosenId = shot?.selectedBy === "member" ? shot.selectedTakeId : shot?.selectedTake?.id;

  return (
    <section aria-labelledby="cinema-takes" className="flex w-full max-w-[1150px] flex-col gap-3">
      <div className="flex items-baseline gap-2">
        <h2 id="cinema-takes" className="text-sm leading-5 font-semibold text-text-primary">
          {t.title}
          {number ? ` · ${cinema.posters.shot(number)}` : null}
        </h2>
        {shot?.selectedBy === "auto" ? <span className="text-xs leading-4 text-text-tertiary">{t.auto}</span> : null}
      </div>
      {shotLoading ? (
        <div className="flex gap-3">
          {[0, 1].map((i) => (
            <div key={i} className="shimmer aspect-video w-[240px] rounded-xl bg-surface-secondary sm:w-[277px]" />
          ))}
        </div>
      ) : takes.length === 0 ? (
        <p className="text-sm leading-5 text-text-secondary">{t.empty}</p>
      ) : (
        <ul aria-label={t.title} className="scroll-quiet flex gap-3 overflow-x-auto p-1">
          {takes.map((k) => (
            <TakeTile key={k.id} take={k} chosen={k.id === chosenId} />
          ))}
        </ul>
      )}
    </section>
  );
}
