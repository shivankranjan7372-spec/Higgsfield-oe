"use client";

import useSWR, { mutate as globalMutate } from "swr";
import type { Asset } from "@/lib/api";
import { api, fetcher } from "@/lib/api";

/* Shapes from docs/api/cinema.md. */

export interface Preset {
  id: string;
  label: string;
  phrase: string;
}

export interface CatalogModel {
  id: string;
  name: string;
  vendor: string;
  tagline?: string;
  aspects: string[];
  refSlots: number;
  canAnimate: boolean;
  canTextToVideo: boolean;
}

export type LookKey = "filmStock" | "grade" | "lensFamily" | "lighting";
export type ShotPresetKey = "size" | "angle" | "movement" | "lens" | "focus" | "lighting" | "mood";

export interface Catalog {
  presets: {
    look: Record<LookKey, Preset[]>;
    shot: Record<ShotPresetKey, Preset[]>;
    aspects: string[];
  };
  models: { still: CatalogModel[]; video: CatalogModel[] };
  defaults: { stillModelId: string; videoModelId: string; aspect: string; shotDuration: number };
}

export interface Project {
  id: string;
  title: string;
  logline: string;
  aspect: string;
  look: Record<LookKey, string>;
  stillModelId: string;
  videoModelId: string;
  createdAt: number;
  updatedAt: number;
  sceneCount?: number;
  shotCount?: number;
}

export type ElementKind = "character" | "location" | "prop";

export interface CinemaElement {
  id: string;
  projectId: string;
  kind: ElementKind;
  name: string;
  description: string;
  refAssetIds: string[];
  refs: { assetId: string; url: string }[];
  createdAt: number;
}

export type TakeMode = "still" | "animate" | "text";

export interface Take {
  id: string;
  shotId: string;
  mode: TakeMode;
  output: "image" | "video";
  sourceTakeId: string | null;
  jobId: string;
  status: "queued" | "running" | "succeeded" | "failed" | "canceled" | "removed";
  modelId: string;
  prompt: string;
  cost: number;
  error: { code: string; message: string } | null;
  asset: Asset | null;
  createdAt: number;
}

export interface Shot {
  id: string;
  projectId: string;
  sceneId: string;
  position: number;
  action: string;
  size: string;
  angle: string;
  movement: string;
  lens: string;
  focus: string;
  lighting: string;
  mood: string;
  duration: number;
  sound: string;
  castIds: string[];
  locationId: string | null;
  selectedTakeId: string | null;
  createdAt: number;
  updatedAt: number;
  status: "empty" | "generating" | "ready" | "failed";
  hasStill: boolean;
  hasVideo: boolean;
  selectedTake: Take | null;
  selectedBy: "member" | "auto" | null;
  takes?: Take[];
  number?: string;
  takeCount?: number;
}

export interface Scene {
  id: string;
  projectId: string;
  position: number;
  title: string;
  notes: string;
  number: number;
  plannedSeconds: number;
  shots: Shot[];
}

export interface Storyboard {
  project: Project;
  elements: CinemaElement[];
  scenes: Scene[];
  summary: {
    sceneCount: number;
    shotCount: number;
    plannedSeconds: number;
    cutSeconds: number;
    shotsWithStill: number;
    shotsWithVideo: number;
    generating: number;
  };
}

export interface Composed {
  modelId: string;
  mode: TakeMode;
  prompt: string;
  values: Record<string, unknown>;
  inputs: Record<string, unknown>;
  notes: string[];
  sourceTakeId: string | null;
  price: { total: number; perTake: number; takes: number };
}

export interface Batch {
  id: string;
  projectId: string;
  modelId: string;
  status: "running" | "done" | "canceled";
  quoted: number;
  counts: { total: number; waiting: number; submitted: number; finished: number; failed: number; canceled: number };
  createdAt: number;
  updatedAt: number;
}

export interface BatchQuote {
  quote: { modelId: string; count: number; total: number; balance: number; affordable: boolean; concurrency: number };
  batch: Batch | null;
}

export const PROJECTS = "/api/cinema/projects";
export const projectKey = (id: string) => `/api/cinema/projects/${id}`;
export const shotKey = (id: string) => `/api/cinema/shots/${id}`;

export function useCatalog() {
  return useSWR<Catalog>("/api/cinema/catalog", fetcher, { revalidateOnFocus: false });
}

export function useProjects(enabled: boolean) {
  return useSWR<{ projects: Project[] }>(enabled ? PROJECTS : null, fetcher);
}

export function useStoryboard(id: string | null) {
  return useSWR<Storyboard>(id ? projectKey(id) : null, fetcher, {
    refreshInterval: (data) => (data && data.summary.generating > 0 ? 1500 : 0),
  });
}

export function useShot(id: string | null) {
  return useSWR<{ shot: Shot }>(id ? shotKey(id) : null, fetcher, {
    refreshInterval: (data) => (data?.shot.status === "generating" ? 1200 : 0),
  });
}

/** Re-reads the project list and one storyboard after a change. */
export function refreshProject(id: string | null) {
  void globalMutate(PROJECTS);
  if (id) void globalMutate(projectKey(id));
}

export async function createProject(title: string, aspect?: string) {
  const { project } = await api<{ project: Project }>(PROJECTS, { method: "POST", body: { title, aspect } });
  return project;
}

/** The first scene of a fresh project, and a first shot in it, so the composer has a target. */
export async function firstShot(projectId: string, fields: Partial<Shot> = {}) {
  const board = await api<Storyboard>(projectKey(projectId));
  let scene = board.scenes[0];
  if (!scene) {
    const made = await api<{ scene: Scene }>(`${projectKey(projectId)}/scenes`, { method: "POST", body: {} });
    scene = { ...made.scene, shots: [] } as Scene;
  }
  const { shot } = await api<{ shot: Shot }>(`/api/cinema/scenes/${scene.id}/shots`, { method: "POST", body: fields });
  return shot;
}

/** The poster of a take, or the newest finished one of a shot. */
export function takePoster(take: Take | null | undefined): string | null {
  if (!take?.asset) return null;
  return take.asset.posterUrl ?? take.asset.url;
}

export function isWorking(take: Take) {
  return take.status === "queued" || take.status === "running";
}
