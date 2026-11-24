"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import useSWR, { mutate } from "swr";
import { api, ApiError, errorMessage, fetcher } from "@/lib/api";
import { ensureSession, setBalance, useSession } from "@/lib/session";
import { cinema } from "@/content/cinema";
import {
  createProject,
  firstShot,
  projectKey,
  refreshProject,
  shotKey,
  useCatalog,
  useProjects,
  useShot,
  useStoryboard,
  type Catalog,
  type CatalogModel,
  type Composed,
  type LookKey,
  type Project,
  type Shot,
  type Storyboard,
  type Take,
  type TakeMode,
} from "./data";

export type Output = "image" | "video";

/** The shot fields the composer edits. Before a project exists they live here, in the browser. */
export type ShotFields = Pick<Shot, "action" | "size" | "angle" | "movement" | "lens" | "focus" | "lighting" | "mood" | "duration" | "sound" | "castIds" | "locationId">;

const BLANK: ShotFields = {
  action: "",
  size: "",
  angle: "",
  movement: "",
  lens: "",
  focus: "",
  lighting: "",
  mood: "",
  duration: 5,
  sound: "",
  castIds: [],
  locationId: null,
};

const BLANK_LOOK: Record<LookKey, string> = { filmStock: "", grade: "", lensFamily: "", lighting: "" };

function useCinemaState() {
  const session = useSession();
  const catalog = useCatalog();
  const projects = useProjects(!!session.user);
  const [pickedProject, setProjectId] = useState<string | null>(null);
  const [pickedShot, setShotId] = useState<string | null>(null);
  const [noneChosen, setNoneChosen] = useState(false);
  const [output, setOutput] = useState<Output>("image");
  const [count, setCount] = useState(1);
  const [problem, setProblem] = useState<{ message: string; code: string; status: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<ShotFields>(BLANK);
  const [draftLook, setDraftLook] = useState<Record<LookKey, string>>(BLANK_LOOK);
  const [draftAspect, setDraftAspect] = useState("16:9");
  const [castOpen, setCastOpen] = useState(false);

  // The open project: the one picked if it still exists, else the most recent one.
  const list = projects.data?.projects;
  const projectId = !session.user
    ? null
    : !list
      ? pickedProject
      : pickedProject && list.some((p) => p.id === pickedProject)
        ? pickedProject
        : noneChosen
          ? null
          : (list[0]?.id ?? null);

  const board = useStoryboard(projectId);
  const allShots = useMemo(() => board.data?.scenes.flatMap((s) => s.shots) ?? [], [board.data]);

  // The open shot: the one picked if it is in this project, else the first.
  const shotId = !projectId ? null : !board.data ? pickedShot : pickedShot && allShots.some((s) => s.id === pickedShot) ? pickedShot : (allShots[0]?.id ?? null);

  const shotQuery = useShot(shotId);
  const shot = shotQuery.data?.shot ?? null;

  // When a take of the open shot settles, the storyboard (posters, cards) follows.
  const settled = `${shot?.id}:${shot?.status}:${shot?.takes?.length ?? 0}:${shot?.selectedTake?.id ?? ""}`;
  useEffect(() => {
    if (projectId) void mutate(projectKey(projectId));
  }, [settled, projectId]);
  const project: Project | null = board.data?.project ?? null;
  const fields: ShotFields = shot ?? draft;
  const look = project?.look ?? draftLook;
  const aspect = project?.aspect ?? draftAspect;

  const defaults = catalog.data?.defaults;
  const stillModelId = project?.stillModelId ?? defaults?.stillModelId ?? "";
  const videoModelId = project?.videoModelId ?? defaults?.videoModelId ?? "";
  const mode: TakeMode = output === "image" ? "still" : shot?.hasStill ? "animate" : "text";
  const modelId = output === "image" ? stillModelId : videoModelId;
  const model: CatalogModel | undefined = (output === "image" ? catalog.data?.models.still : catalog.data?.models.video)?.find(
    (m) => m.id === modelId,
  );

  const composeKey = shot
    ? `/api/cinema/shots/${shot.id}/compose?mode=${mode}&modelId=${encodeURIComponent(modelId)}&count=${count}&at=${shot.updatedAt}-${project?.updatedAt ?? 0}-${shot.takes?.length ?? 0}`
    : null;
  const composed = useSWR<Composed>(composeKey, fetcher, { keepPreviousData: true, shouldRetryOnError: false });

  // Before a shot exists there is nothing to compose, but the first take still has a price.
  const draftKey =
    !shot && modelId
      ? `/api/cinema/compose?mode=${mode}&modelId=${encodeURIComponent(modelId)}&aspect=${encodeURIComponent(aspect)}&duration=${fields.duration}&count=${count}`
      : null;
  const draftQuote = useSWR<Pick<Composed, "price">>(draftKey, fetcher, { keepPreviousData: true, shouldRetryOnError: false });
  /** What Generate will cost, in millicredits, or null while it is not known. */
  const price = (shot ? composed.data : draftQuote.data)?.price.total ?? null;

  const report = useCallback((e: unknown) => {
    if (e instanceof ApiError) setProblem({ message: e.message, code: e.code, status: e.status });
    else setProblem({ message: errorMessage(e), code: "error", status: 0 });
  }, []);

  const refreshShot = useCallback(
    (id: string | null = shotId) => {
      if (id) void mutate(shotKey(id));
      refreshProject(projectId);
    },
    [shotId, projectId],
  );

  /** Changes shot fields: on the server when there is a shot, else in the draft. */
  const patchShot = useCallback(
    async (patch: Partial<ShotFields>) => {
      if (!shot) {
        setDraft((d) => ({ ...d, ...patch }));
        return;
      }
      const key = shotKey(shot.id);
      void mutate(key, (prev: { shot: Shot } | undefined) => (prev ? { shot: { ...prev.shot, ...patch } } : prev), { revalidate: false });
      try {
        const r = await api<{ shot: Shot }>(key, { method: "PATCH", body: patch });
        void mutate(key, (prev: { shot: Shot } | undefined) => ({ shot: { ...prev?.shot, ...r.shot } }), { revalidate: false });
        if (projectId) void mutate(projectKey(projectId));
      } catch (e) {
        report(e);
        void mutate(key);
      }
    },
    [shot, projectId, report],
  );

  const patchProject = useCallback(
    async (patch: Partial<Pick<Project, "title" | "aspect" | "stillModelId" | "videoModelId">> & { look?: Partial<Record<LookKey, string>> }) => {
      if (!project) {
        if (patch.look) setDraftLook((l) => ({ ...l, ...patch.look }));
        if (patch.aspect) setDraftAspect(patch.aspect);
        return;
      }
      const key = projectKey(project.id);
      void mutate(
        key,
        (prev: Storyboard | undefined) =>
          prev ? { ...prev, project: { ...prev.project, ...patch, look: { ...prev.project.look, ...patch.look } } } : prev,
        { revalidate: false },
      );
      try {
        await api(key, { method: "PATCH", body: patch });
      } catch (e) {
        report(e);
      }
      refreshProject(project.id);
    },
    [project, report],
  );

  const openProject = useCallback((id: string | null) => {
    setNoneChosen(id === null);
    setProjectId(id);
    setShotId(null);
    setProblem(null);
  }, []);

  /** Makes a project (and its first shot) from whatever the composer holds now. */
  const startProject = useCallback(
    async (title: string = cinema.sidebar.newTitle, action?: string) => {
      await ensureSession();
      const lookPatch = Object.fromEntries(Object.entries(draftLook).filter(([, v]) => v));
      const made = await createProject(title, draftAspect);
      if (Object.keys(lookPatch).length) await api(projectKey(made.id), { method: "PATCH", body: { look: lookPatch } });
      const first = await firstShot(made.id, action === undefined ? draft : { ...draft, action });
      setDraft(BLANK);
      setDraftLook(BLANK_LOOK);
      await Promise.all([mutate(projectKey(made.id)), mutate("/api/cinema/projects")]);
      setNoneChosen(false);
      setProjectId(made.id);
      setShotId(first.id);
      return { project: made, shot: first };
    },
    [draft, draftLook, draftAspect],
  );

  const newProject = useCallback(async () => {
    setProblem(null);
    try {
      await startProject();
    } catch (e) {
      report(e);
    }
  }, [startProject, report]);

  const generate = useCallback(
    async (opts: { mode?: TakeMode; fromTakeId?: string; action?: string } = {}) => {
      setProblem(null);
      setBusy(true);
      try {
        let target = shot?.id ?? null;
        if (!target) {
          if (projectId) {
            const made = await firstShot(projectId, { ...draft, action: opts.action ?? draft.action });
            target = made.id;
            await mutate(projectKey(projectId));
            setShotId(made.id);
            setDraft(BLANK);
          } else {
            const { shot: made } = await startProject(undefined, opts.action);
            target = made.id;
          }
        } else if (opts.action !== undefined && opts.action !== shot?.action) {
          await api(shotKey(target), { method: "PATCH", body: { action: opts.action } });
        }
        const useMode = opts.mode ?? mode;
        const body: Record<string, unknown> = { mode: useMode, count, modelId: useMode === "still" ? stillModelId : videoModelId };
        if (opts.fromTakeId) body.fromTakeId = opts.fromTakeId;
        const r = await api<{ takes: Take[]; balance: number }>(`/api/cinema/shots/${target}/takes`, { method: "POST", body });
        void setBalance(r.balance);
        await mutate(shotKey(target));
        refreshProject(projectId);
      } catch (e) {
        report(e);
      } finally {
        setBusy(false);
      }
    },
    [shot, projectId, draft, mode, count, stillModelId, videoModelId, startProject, report],
  );

  return {
    session,
    catalog: catalog.data as Catalog | undefined,
    catalogError: catalog.error,
    projects,
    projectId,
    project,
    board,
    allShots,
    shotId,
    setShotId,
    shot,
    shotLoading: shotQuery.isLoading,
    fields,
    look,
    aspect,
    output,
    setOutput,
    mode,
    model,
    modelId,
    stillModelId,
    videoModelId,
    count,
    setCount,
    composed,
    price,
    problem,
    setProblem,
    report,
    busy,
    patchShot,
    patchProject,
    openProject,
    newProject,
    generate,
    refreshShot,
    castOpen,
    setCastOpen,
  };
}

export type CinemaState = ReturnType<typeof useCinemaState>;

const Ctx = createContext<CinemaState | null>(null);

export function CinemaProvider({ children }: { children: ReactNode }) {
  const state = useCinemaState();
  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export function useCinema(): CinemaState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCinema needs CinemaProvider");
  return v;
}
