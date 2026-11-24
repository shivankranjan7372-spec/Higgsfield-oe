import "server-only";

import { all } from "@/server/db";
import { getJob, type Job } from "@/server/jobs";
import { composePrompt } from "./compose";
import { ANGLES, FOCUS, LENSES, LIGHTING_STYLES, MOODS, MOVEMENTS, SHOT_SIZES, presetById, type Preset } from "./presets";
import { elementsOf, ownedProject, scenesOf, shotsOfProject, toElement, toProject, toScene, toShotFields } from "./store";
import { shotState, toTake, type TakeRow } from "./takes";

/** The whole project in one read: scenes in order, shots in order, each with its state and selected take. */
export function storyboard(userId: string, projectId: string) {
  const project = ownedProject(userId, projectId);
  const elements = elementsOf(projectId);
  const shots = shotsOfProject(projectId);
  const takeRows = all<TakeRow>("SELECT * FROM cinema_takes WHERE project_id = ? ORDER BY created_at, id", projectId);

  // One job read per take; a removed job reads as null.
  const jobs = new Map<string, Job | null>();
  for (const t of takeRows) {
    try {
      jobs.set(t.job_id, getJob(userId, t.job_id));
    } catch {
      jobs.set(t.job_id, null);
    }
  }
  const takesByShot = new Map<string, ReturnType<typeof toTake>[]>();
  for (const t of takeRows) {
    const list = takesByShot.get(t.shot_id) ?? [];
    list.push(toTake(t, jobs.get(t.job_id) ?? null));
    takesByShot.set(t.shot_id, list);
  }

  let planned = 0;
  let cut = 0;
  const scenes = scenesOf(projectId).map((scene, si) => {
    let scenePlanned = 0;
    const sceneShots = shots
      .filter((s) => s.scene_id === scene.id)
      .map((s, i) => {
        const takes = takesByShot.get(s.id) ?? [];
        const state = shotState(s, takes);
        scenePlanned += s.duration;
        if (state.selectedTake?.output === "video") cut += state.selectedTake.asset?.duration ?? s.duration;
        return {
          ...toShotFields(s),
          number: `${si + 1}.${i + 1}`,
          ...state,
          takeCount: takes.length,
          prompt: composePrompt(project, s, elements, "animate"),
        };
      });
    planned += scenePlanned;
    return { ...toScene(scene), number: si + 1, plannedSeconds: round(scenePlanned), shots: sceneShots };
  });

  const allShots = scenes.flatMap((s) => s.shots);
  return {
    project: toProject(project),
    elements: elements.map(toElement),
    scenes,
    summary: {
      sceneCount: scenes.length,
      shotCount: allShots.length,
      /** Sum of planned shot durations. */
      plannedSeconds: round(planned),
      /** Length of the selected video takes joined together. */
      cutSeconds: round(cut),
      shotsWithStill: allShots.filter((s) => s.hasStill).length,
      shotsWithVideo: allShots.filter((s) => s.hasVideo).length,
      generating: allShots.filter((s) => s.status === "generating").length,
    },
  };
}

const round = (n: number) => Math.round(n * 10) / 10;

/* --------------------------------- export ---------------------------------- */

const label = (list: Preset[], id: string) => presetById(list, id)?.label ?? "";

/** CSV cells are quoted, and anything a spreadsheet would run as a formula is defused. */
function cell(v: unknown): string {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function shotListCsv(userId: string, projectId: string): { name: string; csv: string } {
  const board = storyboard(userId, projectId);
  const names = new Map(board.elements.map((e) => [e.id, e.name]));
  const head = ["Shot", "Scene", "Action", "Size", "Angle", "Movement", "Lens", "Depth of field", "Lighting", "Mood", "Seconds", "Sound", "Cast", "Location", "Status", "Selected take", "Selected file"];
  const lines = [head.map(cell).join(",")];
  for (const scene of board.scenes) {
    for (const s of scene.shots) {
      lines.push(
        [
          s.number, scene.title, s.action, label(SHOT_SIZES, s.size), label(ANGLES, s.angle), label(MOVEMENTS, s.movement), label(LENSES, s.lens),
          label(FOCUS, s.focus), label(LIGHTING_STYLES, s.lighting), label(MOODS, s.mood), s.duration, s.sound,
          s.castIds.map((id) => names.get(id) ?? "").filter(Boolean).join("; "), s.locationId ? (names.get(s.locationId) ?? "") : "",
          s.status, s.selectedTake?.id ?? "", s.selectedTake?.asset?.url ?? "",
        ].map(cell).join(","),
      );
    }
  }
  const name = board.project.title.replace(/[^A-Za-z0-9 _-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "project";
  return { name, csv: lines.join("\r\n") + "\r\n" };
}
