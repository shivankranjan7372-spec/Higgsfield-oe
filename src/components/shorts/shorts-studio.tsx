"use client";

import { CircleHelp, Clapperboard, Lightbulb } from "lucide-react";
import { Tabs } from "radix-ui";
import { useState } from "react";
import { mutate as mutateCache } from "swr";
import { shortIdeas, shortsCopy, SHORTS_SURFACE, type ShortIdea } from "@/content/shorts";
import { ApiError, api, errorMessage, type Asset, type Job } from "@/lib/api";
import { useQueryParam } from "@/lib/browser";
import { setBalance, useSession } from "@/lib/session";
import { isActive, jobsKey, useJobs } from "@/lib/studio";
import { Dialog, DialogContent, cn } from "@/ui";
import { CreateDialog } from "./create-dialog";
import { IdeaTile } from "./idea-tile";
import { DoneTile, FailedTile, PendingTile } from "./short-tile";
import { LIME_BUTTON, TILE, TILE_GRID } from "./styles";
import { useShorts } from "./use-shorts";
import { Viewer } from "./viewer";

const copy = shortsCopy;
type Tab = "ideas" | "mine";

/** The page's wordmark: the big chrome word and the spaced line under it, drawn in type. */
function Wordmark() {
  return (
    <h1 className="flex flex-col items-center select-none">
      <span className="bg-[linear-gradient(180deg,#F1EDFF_0%,#BBA8F4_34%,#8A70D2_58%,#ECE8F6_100%)] bg-clip-text font-display text-[68px] leading-[60px] font-bold tracking-[0.03em] text-transparent uppercase [filter:drop-shadow(0_2px_0_#FFFFFF33)_drop-shadow(0_6px_14px_#7C5CE040)] sm:text-[120px] sm:leading-[88px]">
        {copy.hero.word}
      </span>
      <span className="mt-2 bg-[linear-gradient(180deg,#CFC2FF_0%,#9178DE_100%)] bg-clip-text pl-[1em] font-display text-lg leading-6 font-bold tracking-[1em] text-transparent uppercase sm:text-[26px] sm:leading-[27px]">
        {copy.hero.sub}
      </span>
    </h1>
  );
}

function HowDialog({ open, onOpenChange, onStart }: { open: boolean; onOpenChange: (open: boolean) => void; onStart: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={copy.how.title} className="max-w-[480px]" aria-describedby={undefined}>
        <ol className="flex flex-col gap-4 px-6 pt-5">
          {copy.how.steps.map((step, i) => (
            <li key={step.title} className="flex gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-tint font-mono text-sm leading-5 text-brand">
                {i + 1}
              </span>
              <span className="flex min-w-0 flex-col gap-1">
                <span className="text-sm leading-5 font-semibold text-text-primary">{step.title}</span>
                <span className="text-sm leading-5 text-text-secondary">{step.body}</span>
              </span>
            </li>
          ))}
        </ol>
        <div className="flex justify-end px-6 pt-6 pb-6">
          <button type="button" onClick={onStart} className={LIME_BUTTON}>
            {copy.how.start}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EmptyMine({ signedIn, onStart }: { signedIn: boolean; onStart: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-border-subtle bg-surface-primary px-6 py-16 text-center">
      <Clapperboard className="size-6 text-text-tab" strokeWidth={1.5} aria-hidden />
      <p className="text-sm leading-5 font-semibold text-text-primary">{copy.mine.emptyTitle}</p>
      <p className="max-w-[360px] text-sm leading-5 text-text-secondary">{signedIn ? copy.mine.emptyBody : copy.mine.signedOut}</p>
      <button type="button" onClick={onStart} className={cn(LIME_BUTTON, "mt-2")}>
        {copy.mine.start}
      </button>
    </div>
  );
}

/** The Shorts studio: the hero, the two tabs (starter ideas, the member's own shorts), the form and the large view. */
export function ShortsStudio() {
  const shorts = useShorts();
  const { studio } = shorts;
  const { user } = useSession();
  const { jobs, loading } = useJobs(SHORTS_SURFACE);
  const handedPrompt = useQueryParam("prompt");

  const [tab, setTab] = useState<Tab | null>(null);
  const current: Tab = tab ?? (jobs.length ? "mine" : "ideas");
  const [formOpen, setFormOpen] = useState<boolean | null>(null);
  const creating = formOpen ?? !!handedPrompt;
  const [howOpen, setHowOpen] = useState(false);
  const [viewing, setViewing] = useState<{ jobId: string; assetId: string } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);

  const refresh = () => mutateCache(jobsKey(SHORTS_SURFACE));

  const openForm = () => {
    shorts.clearError();
    setHowOpen(false);
    setFormOpen(true);
  };

  function pickIdea(idea: ShortIdea) {
    studio.setPrompt(idea.prompt);
    openForm();
  }

  async function removeJob(job: Job) {
    setProblem(null);
    try {
      const res = await api<{ ok: true; balance: number }>(`/api/jobs/${job.id}`, { method: "DELETE" });
      await setBalance(res.balance);
      setViewing(null);
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 404)) setProblem(errorMessage(e));
      else setViewing(null);
    }
    await refresh();
  }

  async function favorite(asset: Asset) {
    setProblem(null);
    try {
      await api(`/api/assets/${asset.id}`, { method: "PATCH", body: { favorite: !asset.favorite } });
    } catch (e) {
      setProblem(errorMessage(e));
    }
    await refresh();
  }

  async function retry(job: Job) {
    setRetrying(job.id);
    const ok = await shorts.retry(job);
    setRetrying(null);
    if (!ok) openForm(); // the form shows the server's reason, with a way forward
  }

  const open = viewing ? jobs.find((j) => j.id === viewing.jobId) : undefined;
  const openAsset = open?.assets.find((a) => a.id === viewing?.assetId);

  return (
    <div className="scroll-quiet min-h-0 flex-1 overflow-x-hidden overflow-y-auto bg-[#060708]">
      <div className="flex flex-col items-center px-4 pb-16 sm:pt-12">
        {/* The hero, as drawn: wordmark, one line, two buttons. */}
        <section className="flex w-full flex-col items-center justify-center gap-6 pt-10 pb-6 sm:mt-4 sm:h-[307px] sm:pt-0 sm:pb-0">
          <div className="flex flex-col items-center gap-[19px]">
            <Wordmark />
            <p className="text-center text-sm leading-5 text-[#FFFFFF80]">{copy.hero.line}</p>
          </div>
          <div className="flex items-center gap-[10px]">
            <button type="button" onClick={openForm} className={cn(LIME_BUTTON, "w-[142px] px-0")}>
              {copy.hero.start}
            </button>
            <button
              type="button"
              onClick={() => setHowOpen(true)}
              className="inline-flex h-10 items-center gap-[6px] rounded-lg px-[6px] pr-3 text-sm leading-4 font-semibold text-text-primary backdrop-blur-[16px] transition-colors duration-150 hover:bg-border-subtle"
            >
              <CircleHelp className="size-5" strokeWidth={1.5} aria-hidden />
              {copy.hero.how}
            </button>
          </div>
        </section>

        <Tabs.Root value={current} onValueChange={(v) => setTab(v as Tab)} className="flex w-full max-w-[1280px] flex-col items-center">
          <div className="flex w-full pt-4 pb-4 xl:pl-3">
            <Tabs.List
              aria-label={copy.tabs.label}
              className="flex h-10 items-center gap-2 rounded-full border border-border-default px-[5px]"
            >
              {(
                [
                  ["ideas", copy.tabs.ideas, Lightbulb],
                  ["mine", copy.tabs.mine, Clapperboard],
                ] as const
              ).map(([value, label, Icon]) => (
                <Tabs.Trigger
                  key={value}
                  value={value}
                  className="inline-flex h-8 items-center gap-1 rounded-full px-4 text-xs leading-4 font-medium text-[#FFFFFF80] transition-colors duration-150 hover:text-text-primary data-[state=active]:bg-text-primary data-[state=active]:text-text-inverse"
                >
                  <Icon className="size-4" strokeWidth={1.5} aria-hidden />
                  {label}
                </Tabs.Trigger>
              ))}
            </Tabs.List>
          </div>

          <Tabs.Content value="ideas" className="w-full max-w-[1256px] outline-none">
            <ul aria-label={copy.tabs.ideas} className={TILE_GRID}>
              {shortIdeas.map((idea) => (
                <li key={idea.id}>
                  <IdeaTile idea={idea} onUse={pickIdea} />
                </li>
              ))}
            </ul>
          </Tabs.Content>

          <Tabs.Content value="mine" className="w-full max-w-[1256px] outline-none">
            {problem && !open ? (
              <p role="alert" className="pb-4 text-sm leading-5 text-danger">
                {problem}
              </p>
            ) : null}
            {loading ? (
              <ul aria-label={copy.mine.loading} className={TILE_GRID}>
                {Array.from({ length: 5 }, (_, i) => (
                  <li key={i} className={cn(TILE, "shimmer")} />
                ))}
              </ul>
            ) : jobs.length === 0 ? (
              <EmptyMine signedIn={!!user} onStart={openForm} />
            ) : (
              <ul aria-label={copy.mine.label} className={TILE_GRID}>
                {jobs.flatMap((job) => {
                  if (isActive(job)) {
                    return [
                      <li key={job.id}>
                        <PendingTile job={job} onCancel={() => void removeJob(job)} />
                      </li>,
                    ];
                  }
                  if (job.status === "failed") {
                    return [
                      <li key={job.id}>
                        <FailedTile job={job} busy={retrying === job.id} onRetry={() => void retry(job)} onRemove={() => void removeJob(job)} />
                      </li>,
                    ];
                  }
                  return job.assets.map((asset) => (
                    <li key={asset.id}>
                      <DoneTile job={job} asset={asset} onOpen={() => setViewing({ jobId: job.id, assetId: asset.id })} />
                    </li>
                  ));
                })}
              </ul>
            )}
          </Tabs.Content>
        </Tabs.Root>
      </div>

      <CreateDialog
        open={creating}
        onOpenChange={setFormOpen}
        shorts={shorts}
        onQueued={() => {
          setFormOpen(false);
          setTab("mine");
        }}
      />
      <HowDialog open={howOpen} onOpenChange={setHowOpen} onStart={openForm} />
      <Viewer
        item={open && openAsset ? { job: open, asset: openAsset } : null}
        problem={problem}
        onClose={() => {
          setViewing(null);
          setProblem(null);
        }}
        onFavorite={favorite}
        onRemove={removeJob}
        onReuse={(job) => {
          studio.load(job);
          setViewing(null);
          openForm();
        }}
      />
    </div>
  );
}
