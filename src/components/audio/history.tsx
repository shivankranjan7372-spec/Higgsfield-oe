"use client";

import { BookOpen, Folder, ListFilter } from "lucide-react";
import { useState } from "react";
import { LoginDialog } from "@/components/entry/login-dialog";
import { audioCopy, type AudioSurface } from "@/content/audio";
import { routes } from "@/content/site";
import type { Job } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Artwork, MenuItem, Popover, PopoverContent, PopoverTrigger, cn } from "@/ui";
import { DoneRow, EmptyResultRow, FailedRow, PendingRow } from "./track-row";

export type View = "history" | "how";
export type Filter = "all" | "favorites" | "speech" | "music";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: audioCopy.filterAll },
  { id: "favorites", label: audioCopy.filterFavorites },
  { id: "speech", label: audioCopy.filterSpeech },
  { id: "music", label: audioCopy.filterMusic },
];

/** The dark box everything on the right sits in. */
const frame = "rounded-xl border border-border-subtle bg-surface-shell";

/** "History | How it works": the glass pill marks the open one. */
function ViewSwitch({ view, onView }: { view: View; onView: (v: View) => void }) {
  const items: { id: View; label: string; icon: typeof Folder }[] = [
    { id: "history", label: audioCopy.history, icon: Folder },
    { id: "how", label: audioCopy.howItWorks, icon: BookOpen },
  ];
  return (
    <div role="group" aria-label="Right panel" className={cn(frame, "flex h-10 shrink-0 items-center gap-1 px-1")}>
      {items.map((item) => {
        const on = item.id === view;
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={on}
            onClick={() => onView(item.id)}
            className={cn(
              "relative flex h-7 items-center gap-1 rounded-md border px-[10px] text-xs leading-[18px] font-semibold transition-colors duration-150",
              on
                ? "border-border-subtle bg-surface-glass bg-linear-[150deg] from-[#FFFFFF0A] via-[#FFFFFF0F] to-[#FFFFFF05] text-text-primary [box-shadow:#FFFFFF0D_0px_2px_3px_inset,#0000001F_0px_2px_2px] backdrop-blur-md"
                : "border-transparent text-text-muted hover:text-text-primary",
            )}
          >
            <item.icon className="size-4" strokeWidth={1.5} aria-hidden />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function FilterMenu({ filter, onFilter }: { filter: Filter; onFilter: (f: Filter) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={`${audioCopy.filters}: ${FILTERS.find((f) => f.id === filter)?.label}`}
        className={cn(
          "flex h-8 shrink-0 items-center gap-[6px] rounded-lg border border-border-subtle bg-surface-shell px-3 text-xs leading-[18px] font-medium transition-colors duration-150 hover:bg-surface-secondary data-[state=open]:bg-surface-secondary",
          filter === "all" ? "text-text-muted" : "text-text-primary",
        )}
      >
        <ListFilter className="size-4" strokeWidth={1.5} aria-hidden />
        {audioCopy.filters}
        {filter !== "all" ? <span aria-hidden className="size-[6px] rounded-full bg-brand" /> : null}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[200px]">
        {FILTERS.map((f) => (
          <MenuItem
            key={f.id}
            selected={f.id === filter}
            onClick={() => {
              onFilter(f.id);
              setOpen(false);
            }}
          >
            {f.label}
          </MenuItem>
        ))}
      </PopoverContent>
    </Popover>
  );
}

/** The welcome: a headline and two explainer cards. Shown before the first track and under "How it works". */
export function Explainer({ surface }: { surface: AudioSurface }) {
  const hero = audioCopy[surface].hero;
  return (
    <div key={surface} className={cn(frame, "flex shrink-0 animate-fade-in flex-col items-center gap-[38px] px-4 pt-[42px] pb-8 lg:px-8")}>
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="font-display text-[28px] leading-[34px] font-bold tracking-[-0.04em] text-text-primary uppercase md:text-[40px] md:leading-[48px]">{hero.title}</h1>
        <p className="text-base leading-6 font-medium text-text-muted md:text-lg md:leading-[28px]">{hero.lead}</p>
      </div>
      <div className="grid w-full max-w-[924px] grid-cols-1 gap-5 xl:grid-cols-2">
        {hero.cards.map((card) => (
          <article key={card.title} className="flex flex-col items-center gap-6 overflow-clip rounded-4xl border border-[#D9D9D90A] bg-surface-sunken px-[17px] pt-5 pb-[17px]">
            <div className="flex w-full flex-col items-start gap-2 pl-2">
              <h2 className="text-2xl leading-[28px] font-medium tracking-[-0.0167em] text-text-primary">{card.title}</h2>
              <p className="max-w-[300px] text-base leading-6 font-medium text-text-secondary">{card.body}</p>
            </div>
            <Artwork name={card.art} className="aspect-[418/300] w-full rounded-xl" />
          </article>
        ))}
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <ul aria-label="Loading your audio" className="flex flex-col gap-2">
      {[0, 1, 2].map((i) => (
        <li key={i} className="shimmer h-16 rounded-2xl bg-surface-sunken" />
      ))}
    </ul>
  );
}

/** One line for visitors and guests, above whatever is on the right. */
function AccountNote() {
  const { user, member, loading } = useSession();
  const [open, setOpen] = useState(false);
  if (loading || member) return null;
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-xl border border-border-subtle bg-surface-shell px-4 py-2">
      <p className="min-w-0 text-xs leading-[18px] text-text-secondary">{user ? audioCopy.guestNote : audioCopy.visitorNote}</p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-7 shrink-0 items-center rounded-md bg-brand px-3 text-xs leading-4 font-semibold text-ink transition-colors duration-150 hover:bg-brand-pressed"
      >
        {user ? audioCopy.createAccount : audioCopy.signIn}
      </button>
      <LoginDialog open={open} onOpenChange={setOpen} mode={user ? "join" : "login"} next={routes.audio} />
    </div>
  );
}

function matches(job: Job, filter: Filter): boolean {
  if (filter === "speech" || filter === "music") return job.surface === filter;
  if (filter === "favorites") return job.status === "succeeded" && job.assets.some((a) => a.favorite);
  return true;
}

/**
 * The right side: the view switch and filter, then either the member's tracks or the
 * explainer. With nothing made yet, "History" shows the explainer too.
 */
export function AudioHistory({
  surface,
  jobs,
  loading,
  onUse,
}: {
  surface: AudioSurface;
  jobs: Job[];
  loading: boolean;
  onUse: (job: Job) => void;
}) {
  const [view, setView] = useState<View>("history");
  const [filter, setFilter] = useState<Filter>("all");
  const shown = jobs.filter((j) => matches(j, filter));
  const empty = !loading && jobs.length === 0;

  return (
    <section aria-label={audioCopy.history} className="flex min-w-0 flex-1 flex-col gap-[18px] lg:min-h-0">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <ViewSwitch view={view} onView={setView} />
        {view === "history" && !empty ? <FilterMenu filter={filter} onFilter={setFilter} /> : null}
      </div>
      <div className="scroll-quiet flex min-h-0 flex-1 flex-col gap-3 lg:overflow-y-auto">
        {view === "how" || empty ? (
          <Explainer surface={surface} />
        ) : loading ? (
          <Skeleton />
        ) : shown.length === 0 ? (
          <div className={cn(frame, "flex flex-col items-center gap-3 px-4 py-16 text-center")}>
            <p className="text-sm leading-5 text-text-secondary">{filter === "favorites" ? audioCopy.noFavorites : audioCopy.noMatches}</p>
            <button
              type="button"
              onClick={() => setFilter("all")}
              className="inline-flex h-8 items-center rounded-md bg-border-subtle px-3 text-xs leading-4 font-medium text-text-primary transition-colors duration-150 hover:bg-border-default"
            >
              {audioCopy.showAll}
            </button>
          </div>
        ) : (
          <ul aria-label={audioCopy.listLabel} className="flex animate-fade-in flex-col gap-2 pb-4">
            {shown.flatMap((job) => {
              if (job.status === "queued" || job.status === "running") return [<PendingRow key={job.id} job={job} />];
              if (job.status === "failed") return [<FailedRow key={job.id} job={job} onUse={onUse} />];
              if (job.status !== "succeeded") return [];
              if (job.assets.length === 0) return [<EmptyResultRow key={job.id} job={job} onUse={onUse} />];
              const assets = filter === "favorites" ? job.assets.filter((a) => a.favorite) : job.assets;
              return assets.map((asset) => <DoneRow key={asset.id} job={job} asset={asset} onUse={onUse} />);
            })}
          </ul>
        )}
        <AccountNote />
      </div>
    </section>
  );
}
