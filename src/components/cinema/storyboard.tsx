"use client";

import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Copy, Download, Ellipsis, Film, LoaderCircle, Plus, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import useSWR, { mutate } from "swr";
import { formatCredits } from "@/config/economy";
import { cinema } from "@/content/cinema";
import { api, fetcher, type Asset } from "@/lib/api";
import { refreshSession } from "@/lib/session";
import { Button, MenuItem, Popover, PopoverContent, PopoverTrigger, buttonClass, cn } from "@/ui";
import { projectKey, refreshProject, type BatchQuote, type Scene, type Shot } from "./data";
import { useCinema } from "./state";
import { TakeMedia } from "./take-media";

const t = cinema.board;

function useAct() {
  const { project, report } = useCinema();
  return async (fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (e) {
      report(e);
    }
    refreshProject(project?.id ?? null);
  };
}

function ShotCard({ shot, scene, index }: { shot: Shot; scene: Scene; index: number }) {
  const { shotId, setShotId } = useCinema();
  const act = useAct();
  const [menu, setMenu] = useState(false);
  const active = shot.id === shotId;
  const ids = scene.shots.map((s) => s.id);

  function move(by: number) {
    const next = [...ids];
    const [it] = next.splice(index, 1);
    next.splice(index + by, 0, it);
    setMenu(false);
    void act(() => api(`/api/cinema/scenes/${scene.id}/shots/order`, { method: "PUT", body: { shotIds: next } }));
  }

  return (
    <li className="group relative w-[160px] shrink-0" data-shot={shot.id}>
      <button
        type="button"
        onClick={() => setShotId(shot.id)}
        aria-current={active ? "true" : undefined}
        aria-label={cinema.posters.pick(shot.number ?? "")}
        className={cn(
          "flex w-full flex-col gap-2 rounded-xl p-1 text-left transition-colors duration-150 hover:bg-border-subtle",
          active && "bg-border-subtle",
        )}
      >
        <span className={cn("relative block aspect-video w-full overflow-clip rounded-lg bg-surface-secondary", active && "outline-2 outline-brand")}>
          {shot.selectedTake?.asset ? (
            <TakeMedia take={shot.selectedTake} still className="size-full object-cover" />
          ) : shot.status === "generating" ? (
            <span className="shimmer absolute inset-0 bg-surface-secondary" />
          ) : null}
          <span className="absolute top-1 left-1 rounded-sm bg-surface-glass px-1 font-mono text-2xs leading-4 text-text-primary">{shot.number}</span>
          {shot.status === "generating" ? (
            <LoaderCircle className="absolute right-1 bottom-1 size-4 animate-spin text-text-primary" strokeWidth={1.5} aria-hidden />
          ) : null}
        </span>
        <span className="line-clamp-2 min-h-8 px-1 text-xs leading-4 text-text-secondary">{shot.action || cinema.posters.emptyShot}</span>
      </button>
      <Popover open={menu} onOpenChange={setMenu}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`${t.shotMenu}: ${shot.number}`}
            className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-md bg-surface-glass text-text-primary opacity-0 backdrop-blur-md transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 max-lg:opacity-100"
          >
            <Ellipsis className="size-4" strokeWidth={1.5} aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[190px]">
          <MenuItem icon={<ArrowLeft className="size-4" strokeWidth={1.5} />} disabled={index === 0} onClick={() => move(-1)}>
            {t.moveLeft}
          </MenuItem>
          <MenuItem icon={<ArrowRight className="size-4" strokeWidth={1.5} />} disabled={index === ids.length - 1} onClick={() => move(1)}>
            {t.moveRight}
          </MenuItem>
          <MenuItem
            icon={<Copy className="size-4" strokeWidth={1.5} />}
            onClick={() => {
              setMenu(false);
              void act(async () => {
                const r = await api<{ shot: Shot }>(`/api/cinema/shots/${shot.id}/duplicate`, { method: "POST" });
                setShotId(r.shot.id);
              });
            }}
          >
            {t.duplicate}
          </MenuItem>
          <MenuItem
            icon={<Trash2 className="size-4" strokeWidth={1.5} />}
            className="text-danger"
            onClick={() => {
              setMenu(false);
              void act(() => api(`/api/cinema/shots/${shot.id}`, { method: "DELETE" }));
            }}
          >
            {t.delete}
          </MenuItem>
        </PopoverContent>
      </Popover>
    </li>
  );
}

function SceneRow({ scene, index, ids }: { scene: Scene; index: number; ids: string[] }) {
  const { setShotId, project } = useCinema();
  const act = useAct();
  const [title, setTitle] = useState(scene.title);
  const [menu, setMenu] = useState(false);
  const [seen, setSeen] = useState(scene.title);
  if (seen !== scene.title) {
    setSeen(scene.title);
    setTitle(scene.title);
  }

  function move(by: number) {
    const next = [...ids];
    const [it] = next.splice(index, 1);
    next.splice(index + by, 0, it);
    setMenu(false);
    void act(async () => {
      const board = await api(`/api/cinema/projects/${project?.id}/scenes/order`, { method: "PUT", body: { sceneIds: next } });
      if (project) await mutate(projectKey(project.id), board, { revalidate: false });
    });
  }

  return (
    <li className="flex flex-col gap-2 rounded-2xl border border-border-subtle p-3" data-scene={scene.id}>
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs leading-4 text-text-tertiary">{scene.number}</span>
        <input
          aria-label={t.sceneTitle}
          value={title}
          maxLength={120}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title.trim() && title !== scene.title && void act(() => api(`/api/cinema/scenes/${scene.id}`, { method: "PATCH", body: { title: title.trim() } }))}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          className="h-7 min-w-0 flex-1 rounded-md bg-transparent px-1 text-sm leading-5 font-medium text-text-primary outline-none hover:bg-border-subtle focus:bg-border-subtle"
        />
        <span className="shrink-0 font-mono text-xs leading-4 text-text-tertiary">{scene.plannedSeconds} s</span>
        <Popover open={menu} onOpenChange={setMenu}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`${t.sceneMenu}: ${scene.title}`}
              className="flex size-7 shrink-0 items-center justify-center rounded-md text-text-secondary transition-colors duration-150 hover:bg-border-subtle hover:text-text-primary data-[state=open]:bg-border-subtle"
            >
              <Ellipsis className="size-4" strokeWidth={1.5} aria-hidden />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[190px]">
            <MenuItem icon={<ArrowUp className="size-4" strokeWidth={1.5} />} disabled={index === 0} onClick={() => move(-1)}>
              {t.moveUp}
            </MenuItem>
            <MenuItem icon={<ArrowDown className="size-4" strokeWidth={1.5} />} disabled={index === ids.length - 1} onClick={() => move(1)}>
              {t.moveDown}
            </MenuItem>
            <MenuItem
              icon={<Copy className="size-4" strokeWidth={1.5} />}
              onClick={() => {
                setMenu(false);
                void act(() => api(`/api/cinema/scenes/${scene.id}/duplicate`, { method: "POST" }));
              }}
            >
              {t.duplicate}
            </MenuItem>
            <MenuItem
              icon={<Trash2 className="size-4" strokeWidth={1.5} />}
              className="text-danger"
              disabled={ids.length <= 1}
              onClick={() => {
                setMenu(false);
                void act(() => api(`/api/cinema/scenes/${scene.id}`, { method: "DELETE" }));
              }}
            >
              {t.delete}
            </MenuItem>
          </PopoverContent>
        </Popover>
      </div>
      <ul className="scroll-quiet flex items-start gap-2 overflow-x-auto pb-1">
        {scene.shots.map((s, i) => (
          <ShotCard key={s.id} shot={s} scene={scene} index={i} />
        ))}
        <li className="w-[160px] shrink-0 p-1">
          <button
            type="button"
            onClick={() =>
              void act(async () => {
                const r = await api<{ shot: Shot }>(`/api/cinema/scenes/${scene.id}/shots`, { method: "POST", body: {} });
                setShotId(r.shot.id);
              })
            }
            className="flex aspect-video w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border-default text-xs leading-4 font-medium text-text-secondary transition-colors duration-150 hover:bg-border-subtle hover:text-text-primary"
          >
            <Plus className="size-4" strokeWidth={1.5} aria-hidden />
            {t.addShot}
          </button>
        </li>
      </ul>
    </li>
  );
}

function BatchButton({ projectId }: { projectId: string }) {
  const { report, stillModelId } = useCinema();
  const [open, setOpen] = useState(false);
  const key = `/api/cinema/projects/${projectId}/batch?modelId=${encodeURIComponent(stillModelId)}`;
  const q = useSWR<BatchQuote>(key, fetcher, {
    refreshInterval: (d) => (d?.batch && (d.batch.status === "running" || d.batch.counts.finished + d.batch.counts.failed < d.batch.counts.total) && d.batch.status !== "canceled" ? 1500 : 0),
  });
  const [busy, setBusy] = useState(false);
  const batch = q.data?.batch;
  const live = batch && batch.status !== "canceled" && batch.counts.finished + batch.counts.failed + batch.counts.canceled < batch.counts.total;

  async function start() {
    if (!q.data) return;
    setBusy(true);
    try {
      await api(`/api/cinema/projects/${projectId}/batch`, { method: "POST", body: { modelId: stillModelId, expectedTotal: q.data.quote.total } });
      setOpen(false);
      void refreshSession();
    } catch (e) {
      report(e);
    }
    setBusy(false);
    void q.mutate();
    refreshProject(projectId);
  }

  async function stop() {
    if (!batch) return;
    try {
      await api(`/api/cinema/batches/${batch.id}`, { method: "DELETE" });
    } catch (e) {
      report(e);
    }
    void q.mutate();
  }

  if (live && batch) {
    return (
      <div className="flex h-8 items-center gap-2 rounded-md bg-border-subtle px-3 text-xs leading-4 font-medium text-text-primary" role="status">
        <LoaderCircle className="size-4 animate-spin" strokeWidth={1.5} aria-hidden />
        {t.batchProgress(batch.counts.finished, batch.counts.total)}
        {batch.status === "running" ? (
          <button type="button" onClick={() => void stop()} className="ml-1 rounded-sm px-1 text-text-secondary hover:text-text-primary">
            {t.batchStop}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={(o) => (setOpen(o), o && void q.mutate())}>
      <PopoverTrigger asChild>
        <Button variant="soft" size="sm">
          <Sparkles className="size-4" strokeWidth={1.5} aria-hidden />
          {t.batch}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="flex w-[260px] flex-col gap-3 p-3">
        <span className="text-sm leading-5 font-semibold">{t.batchTitle}</span>
        {!q.data ? (
          <div className="shimmer h-10 rounded-md bg-border-subtle" />
        ) : q.data.quote.count === 0 ? (
          <p className="text-sm leading-5 text-text-secondary">{t.batchNothing}</p>
        ) : (
          <>
            <p className="text-sm leading-5 text-text-secondary">{t.batchBody(q.data.quote.count)}</p>
            <div className="flex items-center justify-between text-sm leading-5">
              <span className="text-text-secondary">{t.batchCost}</span>
              <span className="flex items-center gap-1 font-medium">
                <Sparkles className="size-3 fill-current" strokeWidth={1.5} aria-hidden />
                {formatCredits(q.data.quote.total)}
              </span>
            </div>
            <Button variant="lime" size="md" disabled={busy || !q.data.quote.affordable} onClick={() => void start()}>
              {busy ? <LoaderCircle className="size-4 animate-spin" strokeWidth={1.5} aria-hidden /> : null}
              {t.batchStart}
            </Button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

function ExportMenu({ projectId, hasVideo }: { projectId: string; hasVideo: boolean }) {
  const { report } = useCinema();
  const [rendering, setRendering] = useState(false);
  const [film, setFilm] = useState<{ asset: Asset; shotsUsed: number } | null>(null);

  async function render() {
    setRendering(true);
    setFilm(null);
    try {
      setFilm(await api<{ asset: Asset; shotsUsed: number }>(`/api/cinema/projects/${projectId}/render`, { method: "POST" }));
    } catch (e) {
      report(e);
    }
    setRendering(false);
  }

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm">
            <Download className="size-4" strokeWidth={1.5} aria-hidden />
            {t.export}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[230px]">
          <a href={`/api/cinema/projects/${projectId}/export?format=json`} download className="flex h-9 items-center rounded-md px-2 text-sm leading-5 font-medium hover:bg-border-subtle">
            {t.exportJson}
          </a>
          <a href={`/api/cinema/projects/${projectId}/export?format=csv`} download className="flex h-9 items-center rounded-md px-2 text-sm leading-5 font-medium hover:bg-border-subtle">
            {t.exportCsv}
          </a>
        </PopoverContent>
      </Popover>
      {hasVideo ? (
        <Button variant="outline" size="sm" disabled={rendering} onClick={() => void render()}>
          {rendering ? <LoaderCircle className="size-4 animate-spin" strokeWidth={1.5} aria-hidden /> : <Film className="size-4" strokeWidth={1.5} aria-hidden />}
          {rendering ? t.rendering : t.render}
        </Button>
      ) : null}
      {film ? (
        <p role="status" className="flex w-full items-center gap-2 text-xs leading-4 text-text-secondary">
          {t.rendered(film.shotsUsed)}
          <a href={film.asset.url} target="_blank" rel="noreferrer" className={buttonClass("ghost", "xs")}>
            {t.openFilm}
          </a>
        </p>
      ) : null}
    </>
  );
}

/** Every scene and its shots, with the tools that work on the whole project. */
export function Storyboard() {
  const { project, board } = useCinema();
  const act = useAct();
  const data = board.data;

  return (
    <section id="cinema-storyboard" aria-labelledby="cinema-board" className="flex w-full max-w-[1150px] scroll-mt-4 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="cinema-board" className="mr-auto text-sm leading-5 font-semibold text-text-primary">
          {t.title}
          {data ? <span className="ml-2 font-normal text-text-tertiary">{t.summary(data.summary.sceneCount, data.summary.shotCount, data.summary.plannedSeconds)}</span> : null}
        </h2>
        {project && data ? (
          <>
            <BatchButton projectId={project.id} />
            <ExportMenu projectId={project.id} hasVideo={data.summary.shotsWithVideo > 0} />
          </>
        ) : null}
      </div>
      {!project || !data ? (
        <div className="shimmer h-[160px] rounded-2xl bg-surface-secondary" />
      ) : (
        <>
          <ol className="flex flex-col gap-2">
            {data.scenes.map((s, i) => (
              <SceneRow key={s.id} scene={s} index={i} ids={data.scenes.map((x) => x.id)} />
            ))}
          </ol>
          <Button variant="soft" size="sm" className="self-start" onClick={() => void act(() => api(`/api/cinema/projects/${project.id}/scenes`, { method: "POST", body: {} }))}>
            <Plus className="size-4" strokeWidth={1.5} aria-hidden />
            {t.addScene}
          </Button>
        </>
      )}
    </section>
  );
}
