import "server-only";

import { ownedAsset } from "@/server/assets";
import { all, get, newId, parseJson, run, tx } from "@/server/db";
import { ApiError, badRequest, notFound } from "@/server/errors";
import { ANGLES, ASPECTS, FILM_STOCKS, FOCUS, GRADES, LENSES, LENS_FAMILIES, LIGHTING_STYLES, MOODS, MOVEMENTS, SHOT_SIZES } from "./presets";
import { idList, motionModel, preset, requiredText, stillModel, text } from "./validate";

/**
 * Projects, scenes, shots and elements (cast, places, props). Every query filters by
 * user_id; a row that belongs to someone else reads as "does not exist".
 */

export const DEFAULT_STILL_MODEL = "nano-banana-2";
export const DEFAULT_VIDEO_MODEL = "veo-3.1-lite";

const LIMITS = { projects: 200, scenes: 100, shotsPerScene: 100, elements: 100, refs: 8 };

/* ---------------------------------- rows ---------------------------------- */

export interface ProjectRow {
  id: string;
  user_id: string;
  title: string;
  logline: string;
  aspect: string;
  look: string;
  image_model_id: string;
  video_model_id: string;
  created_at: number;
  updated_at: number;
}

export interface SceneRow {
  id: string;
  user_id: string;
  project_id: string;
  position: number;
  title: string;
  notes: string;
  created_at: number;
}

export interface ShotRow {
  id: string;
  user_id: string;
  project_id: string;
  scene_id: string;
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
  cast_ids: string;
  location_id: string | null;
  selected_take_id: string | null;
  created_at: number;
  updated_at: number;
}

export interface ElementRow {
  id: string;
  user_id: string;
  project_id: string;
  kind: ElementKind;
  name: string;
  description: string;
  ref_asset_ids: string;
  created_at: number;
}

export type ElementKind = "character" | "location" | "prop";
export const ELEMENT_KINDS: ElementKind[] = ["character", "location", "prop"];

export interface Look {
  filmStock: string;
  grade: string;
  lensFamily: string;
  lighting: string;
}

/* ------------------------------- API shapes -------------------------------- */

export function toProject(r: ProjectRow) {
  return {
    id: r.id,
    title: r.title,
    logline: r.logline,
    aspect: r.aspect,
    look: lookOf(r),
    stillModelId: r.image_model_id,
    videoModelId: r.video_model_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function lookOf(r: ProjectRow): Look {
  const l = parseJson<Partial<Look>>(r.look, {});
  return { filmStock: l.filmStock ?? "", grade: l.grade ?? "", lensFamily: l.lensFamily ?? "", lighting: l.lighting ?? "" };
}

export function toScene(r: SceneRow) {
  return { id: r.id, projectId: r.project_id, position: r.position, title: r.title, notes: r.notes, createdAt: r.created_at };
}

export function toShotFields(r: ShotRow) {
  return {
    id: r.id,
    projectId: r.project_id,
    sceneId: r.scene_id,
    position: r.position,
    action: r.action,
    size: r.size,
    angle: r.angle,
    movement: r.movement,
    lens: r.lens,
    focus: r.focus,
    lighting: r.lighting,
    mood: r.mood,
    duration: r.duration,
    sound: r.sound,
    castIds: parseJson<string[]>(r.cast_ids, []),
    locationId: r.location_id,
    selectedTakeId: r.selected_take_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function toElement(r: ElementRow) {
  const ids = parseJson<string[]>(r.ref_asset_ids, []);
  return {
    id: r.id,
    projectId: r.project_id,
    kind: r.kind,
    name: r.name,
    description: r.description,
    refAssetIds: ids,
    // Same-origin links only; the asset route checks ownership again.
    refs: ids.map((id) => ({ assetId: id, url: `/api/assets/${id}/file` })),
    createdAt: r.created_at,
  };
}

/* --------------------------------- loading --------------------------------- */

export function ownedProject(userId: string, id: string): ProjectRow {
  const row = get<ProjectRow>("SELECT * FROM cinema_projects WHERE id = ? AND user_id = ?", id, userId);
  if (!row) throw notFound("That project does not exist.");
  return row;
}

export function ownedScene(userId: string, id: string): SceneRow {
  const row = get<SceneRow>("SELECT * FROM cinema_scenes WHERE id = ? AND user_id = ?", id, userId);
  if (!row) throw notFound("That scene does not exist.");
  return row;
}

export function ownedShot(userId: string, id: string): ShotRow {
  const row = get<ShotRow>("SELECT * FROM cinema_shots WHERE id = ? AND user_id = ?", id, userId);
  if (!row) throw notFound("That shot does not exist.");
  return row;
}

export function ownedElement(userId: string, id: string): ElementRow {
  const row = get<ElementRow>("SELECT * FROM cinema_elements WHERE id = ? AND user_id = ?", id, userId);
  if (!row) throw notFound("That cast member, place or prop does not exist.");
  return row;
}

export function scenesOf(projectId: string): SceneRow[] {
  return all<SceneRow>("SELECT * FROM cinema_scenes WHERE project_id = ? ORDER BY position, created_at", projectId);
}

export function shotsOfProject(projectId: string): ShotRow[] {
  return all<ShotRow>("SELECT * FROM cinema_shots WHERE project_id = ? ORDER BY position, created_at", projectId);
}

export function shotsOfScene(sceneId: string): ShotRow[] {
  return all<ShotRow>("SELECT * FROM cinema_shots WHERE scene_id = ? ORDER BY position, created_at", sceneId);
}

export function elementsOf(projectId: string): ElementRow[] {
  return all<ElementRow>("SELECT * FROM cinema_elements WHERE project_id = ? ORDER BY kind, created_at", projectId);
}

function touch(projectId: string) {
  run("UPDATE cinema_projects SET updated_at = ? WHERE id = ?", Date.now(), projectId);
}

/* --------------------------------- projects -------------------------------- */

function readLook(body: Record<string, unknown>, current: Look): Look {
  const raw = body.look;
  if (raw === undefined) return current;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw badRequest("The look must be an object.");
  const l = raw as Record<string, unknown>;
  return {
    filmStock: preset(l, "filmStock", "Film stock", FILM_STOCKS) ?? current.filmStock,
    grade: preset(l, "grade", "Colour grade", GRADES) ?? current.grade,
    lensFamily: preset(l, "lensFamily", "Lens family", LENS_FAMILIES) ?? current.lensFamily,
    lighting: preset(l, "lighting", "Lighting style", LIGHTING_STYLES) ?? current.lighting,
  };
}

function readAspect(body: Record<string, unknown>): string | undefined {
  if (body.aspect === undefined) return undefined;
  if (typeof body.aspect !== "string" || !(ASPECTS as readonly string[]).includes(body.aspect)) {
    throw badRequest(`Pick an aspect ratio: ${ASPECTS.join(", ")}.`);
  }
  return body.aspect;
}

export function listProjects(userId: string) {
  const rows = all<ProjectRow & { scenes: number; shots: number }>(
    `SELECT p.*, (SELECT COUNT(*) FROM cinema_scenes s WHERE s.project_id = p.id) AS scenes,
                 (SELECT COUNT(*) FROM cinema_shots t WHERE t.project_id = p.id) AS shots
       FROM cinema_projects p WHERE p.user_id = ? ORDER BY p.updated_at DESC`,
    userId,
  );
  return rows.map((r) => ({ ...toProject(r), sceneCount: r.scenes, shotCount: r.shots }));
}

export function createProject(userId: string, body: Record<string, unknown>): ProjectRow {
  const count = get<{ n: number }>("SELECT COUNT(*) AS n FROM cinema_projects WHERE user_id = ?", userId)!.n;
  if (count >= LIMITS.projects) throw new ApiError(409, "limit_reached", `You can keep up to ${LIMITS.projects} projects. Delete one first.`);
  const title = requiredText(body, "title", "A title", 120);
  const logline = text(body, "logline", "The logline", 600) ?? "";
  const aspect = readAspect(body) ?? "16:9";
  const look = readLook(body, { filmStock: "", grade: "", lensFamily: "", lighting: "" });
  const still = body.stillModelId === undefined ? DEFAULT_STILL_MODEL : stillModel(body.stillModelId).id;
  const video = body.videoModelId === undefined ? DEFAULT_VIDEO_MODEL : motionModel(body.videoModelId).id;
  const id = newId("cpr");
  const now = Date.now();
  tx(() => {
    run(
      `INSERT INTO cinema_projects (id, user_id, title, logline, aspect, look, image_model_id, video_model_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id, userId, title, logline, aspect, JSON.stringify(look), still, video, now, now,
    );
    // A new project opens on one empty scene, so the first shot has somewhere to go.
    run("INSERT INTO cinema_scenes (id, user_id, project_id, position, title, created_at) VALUES (?, ?, ?, 0, 'Scene 1', ?)", newId("csc"), userId, id, now);
  });
  return ownedProject(userId, id);
}

export function updateProject(userId: string, id: string, body: Record<string, unknown>): ProjectRow {
  const row = ownedProject(userId, id);
  const title = body.title === undefined ? row.title : requiredText(body, "title", "A title", 120);
  const logline = text(body, "logline", "The logline", 600) ?? row.logline;
  const aspect = readAspect(body) ?? row.aspect;
  const look = readLook(body, lookOf(row));
  const still = body.stillModelId === undefined ? row.image_model_id : stillModel(body.stillModelId).id;
  const video = body.videoModelId === undefined ? row.video_model_id : motionModel(body.videoModelId).id;
  run(
    "UPDATE cinema_projects SET title = ?, logline = ?, aspect = ?, look = ?, image_model_id = ?, video_model_id = ?, updated_at = ? WHERE id = ?",
    title, logline, aspect, JSON.stringify(look), still, video, Date.now(), id,
  );
  return ownedProject(userId, id);
}

/** Deletes the plan. Generated files stay in the member's library. */
export function deleteProject(userId: string, id: string) {
  ownedProject(userId, id);
  tx(() => {
    run("UPDATE cinema_batch_items SET status = 'canceled' WHERE status = 'waiting' AND batch_id IN (SELECT id FROM cinema_batches WHERE project_id = ?)", id);
    run("DELETE FROM cinema_projects WHERE id = ? AND user_id = ?", id, userId);
  });
}

/* ---------------------------------- scenes --------------------------------- */

export function createScene(userId: string, projectId: string, body: Record<string, unknown>): SceneRow {
  ownedProject(userId, projectId);
  const existing = scenesOf(projectId);
  if (existing.length >= LIMITS.scenes) throw new ApiError(409, "limit_reached", `A project holds up to ${LIMITS.scenes} scenes.`);
  const title = text(body, "title", "The scene title", 120) || `Scene ${existing.length + 1}`;
  const notes = text(body, "notes", "The notes", 2000) ?? "";
  const id = newId("csc");
  const position = existing.length ? existing[existing.length - 1].position + 1 : 0;
  run("INSERT INTO cinema_scenes (id, user_id, project_id, position, title, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", id, userId, projectId, position, title, notes, Date.now());
  touch(projectId);
  return ownedScene(userId, id);
}

export function updateScene(userId: string, id: string, body: Record<string, unknown>): SceneRow {
  const row = ownedScene(userId, id);
  const title = text(body, "title", "The scene title", 120) ?? row.title;
  const notes = text(body, "notes", "The notes", 2000) ?? row.notes;
  run("UPDATE cinema_scenes SET title = ?, notes = ? WHERE id = ?", title, notes, id);
  touch(row.project_id);
  return ownedScene(userId, id);
}

export function deleteScene(userId: string, id: string) {
  const row = ownedScene(userId, id);
  run("DELETE FROM cinema_scenes WHERE id = ?", id);
  renumber("cinema_scenes", scenesOf(row.project_id).map((s) => s.id));
  touch(row.project_id);
}

/** Sets the order of all scenes. `ids` must be exactly the project's scenes. */
export function orderScenes(userId: string, projectId: string, ids: string[]) {
  ownedProject(userId, projectId);
  const current = scenesOf(projectId).map((s) => s.id);
  if (ids.length !== current.length || !current.every((id) => ids.includes(id))) {
    throw badRequest("Send every scene of the project once, in the new order.");
  }
  tx(() => renumber("cinema_scenes", ids));
  touch(projectId);
}

/** Copies a scene and its shots (not their takes) right after the original. */
export function duplicateScene(userId: string, id: string): SceneRow {
  const src = ownedScene(userId, id);
  if (scenesOf(src.project_id).length >= LIMITS.scenes) throw new ApiError(409, "limit_reached", `A project holds up to ${LIMITS.scenes} scenes.`);
  const copyId = newId("csc");
  tx(() => {
    const order = scenesOf(src.project_id).map((s) => s.id);
    run(
      "INSERT INTO cinema_scenes (id, user_id, project_id, position, title, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      copyId, userId, src.project_id, src.position + 1, `${src.title} (copy)`.slice(0, 120), src.notes, Date.now(),
    );
    order.splice(order.indexOf(src.id) + 1, 0, copyId);
    renumber("cinema_scenes", order);
    for (const shot of shotsOfScene(src.id)) copyShot(shot, copyId, shot.position);
  });
  touch(src.project_id);
  return ownedScene(userId, copyId);
}

function renumber(table: "cinema_scenes" | "cinema_shots", ids: string[]) {
  ids.forEach((id, i) => run(`UPDATE ${table} SET position = ? WHERE id = ?`, i, id));
}

/* ---------------------------------- shots ---------------------------------- */

interface ShotFields {
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
}

function readShot(userId: string, projectId: string, body: Record<string, unknown>, cur: ShotFields): ShotFields {
  let duration = cur.duration;
  if (body.duration !== undefined) {
    const n = Number(body.duration);
    if (typeof body.duration !== "number" || !Number.isFinite(n) || n < 1 || n > 60) throw badRequest("Duration must be between 1 and 60 seconds.");
    duration = Math.round(n * 10) / 10;
  }
  let castIds = idList(body, "castIds", "Cast", 12) ?? cur.castIds;
  if (body.castIds !== undefined) {
    for (const id of castIds) {
      const el = get<ElementRow>("SELECT * FROM cinema_elements WHERE id = ? AND user_id = ? AND project_id = ?", id, userId, projectId);
      if (!el) throw notFound("That cast member does not exist in this project.");
      if (el.kind === "location") throw badRequest(`${el.name} is a place. Set it as the location instead.`);
    }
    castIds = [...castIds];
  }
  let locationId = cur.locationId;
  if (body.locationId !== undefined) {
    if (body.locationId === null || body.locationId === "") locationId = null;
    else {
      if (typeof body.locationId !== "string") throw badRequest("Location must be an id.");
      const el = get<ElementRow>("SELECT * FROM cinema_elements WHERE id = ? AND user_id = ? AND project_id = ?", body.locationId, userId, projectId);
      if (!el) throw notFound("That location does not exist in this project.");
      if (el.kind !== "location") throw badRequest(`${el.name} is not a place.`);
      locationId = el.id;
    }
  }
  return {
    action: text(body, "action", "The action", 2000) ?? cur.action,
    size: preset(body, "size", "Shot size", SHOT_SIZES) ?? cur.size,
    angle: preset(body, "angle", "Camera angle", ANGLES) ?? cur.angle,
    movement: preset(body, "movement", "Camera movement", MOVEMENTS) ?? cur.movement,
    lens: preset(body, "lens", "Lens", LENSES) ?? cur.lens,
    focus: preset(body, "focus", "Depth of field", FOCUS) ?? cur.focus,
    lighting: preset(body, "lighting", "Lighting", LIGHTING_STYLES) ?? cur.lighting,
    mood: preset(body, "mood", "Mood", MOODS) ?? cur.mood,
    duration,
    sound: text(body, "sound", "The sound note", 1000) ?? cur.sound,
    castIds,
    locationId,
  };
}

const EMPTY_SHOT: ShotFields = { action: "", size: "", angle: "", movement: "", lens: "", focus: "", lighting: "", mood: "", duration: 5, sound: "", castIds: [], locationId: null };

function fieldsOf(r: ShotRow): ShotFields {
  const s = toShotFields(r);
  return { action: s.action, size: s.size, angle: s.angle, movement: s.movement, lens: s.lens, focus: s.focus, lighting: s.lighting, mood: s.mood, duration: s.duration, sound: s.sound, castIds: s.castIds, locationId: s.locationId };
}

export function createShot(userId: string, sceneId: string, body: Record<string, unknown>): ShotRow {
  const scene = ownedScene(userId, sceneId);
  const existing = shotsOfScene(sceneId);
  if (existing.length >= LIMITS.shotsPerScene) throw new ApiError(409, "limit_reached", `A scene holds up to ${LIMITS.shotsPerScene} shots.`);
  const f = readShot(userId, scene.project_id, body, EMPTY_SHOT);
  const id = newId("csh");
  const now = Date.now();
  const position = existing.length ? existing[existing.length - 1].position + 1 : 0;
  run(
    `INSERT INTO cinema_shots (id, user_id, project_id, scene_id, position, action, size, angle, movement, lens, focus, lighting, mood,
                               duration, sound, cast_ids, location_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, userId, scene.project_id, sceneId, position, f.action, f.size, f.angle, f.movement, f.lens, f.focus, f.lighting, f.mood,
    f.duration, f.sound, JSON.stringify(f.castIds), f.locationId, now, now,
  );
  touch(scene.project_id);
  return ownedShot(userId, id);
}

export function updateShot(userId: string, id: string, body: Record<string, unknown>): ShotRow {
  const row = ownedShot(userId, id);
  const f = readShot(userId, row.project_id, body, fieldsOf(row));
  let selected = row.selected_take_id;
  if (body.selectedTakeId !== undefined) {
    if (body.selectedTakeId === null) selected = null;
    else if (typeof body.selectedTakeId !== "string" || !get("SELECT 1 FROM cinema_takes WHERE id = ? AND shot_id = ? AND user_id = ?", body.selectedTakeId, id, userId)) {
      throw notFound("That take does not belong to this shot.");
    } else selected = body.selectedTakeId;
  }
  tx(() => {
    run(
      `UPDATE cinema_shots SET action = ?, size = ?, angle = ?, movement = ?, lens = ?, focus = ?, lighting = ?, mood = ?, duration = ?,
                               sound = ?, cast_ids = ?, location_id = ?, selected_take_id = ?, updated_at = ? WHERE id = ?`,
      f.action, f.size, f.angle, f.movement, f.lens, f.focus, f.lighting, f.mood, f.duration, f.sound, JSON.stringify(f.castIds), f.locationId, selected, Date.now(), id,
    );
    // Moving to another scene of the same project puts the shot at the end of that scene.
    if (body.sceneId !== undefined && body.sceneId !== row.scene_id) {
      if (typeof body.sceneId !== "string") throw badRequest("Scene must be an id.");
      const target = ownedScene(userId, body.sceneId);
      if (target.project_id !== row.project_id) throw notFound("That scene does not exist in this project.");
      const list = shotsOfScene(target.id);
      run("UPDATE cinema_shots SET scene_id = ?, position = ? WHERE id = ?", target.id, list.length ? list[list.length - 1].position + 1 : 0, id);
      renumber("cinema_shots", shotsOfScene(row.scene_id).map((s) => s.id));
    }
  });
  touch(row.project_id);
  return ownedShot(userId, id);
}

export function deleteShot(userId: string, id: string) {
  const row = ownedShot(userId, id);
  tx(() => {
    run("UPDATE cinema_batch_items SET status = 'canceled' WHERE shot_id = ? AND status = 'waiting'", id);
    run("DELETE FROM cinema_shots WHERE id = ?", id);
    renumber("cinema_shots", shotsOfScene(row.scene_id).map((s) => s.id));
  });
  touch(row.project_id);
}

export function orderShots(userId: string, sceneId: string, ids: string[]) {
  const scene = ownedScene(userId, sceneId);
  const current = shotsOfScene(sceneId).map((s) => s.id);
  if (ids.length !== current.length || !current.every((id) => ids.includes(id))) {
    throw badRequest("Send every shot of the scene once, in the new order.");
  }
  tx(() => renumber("cinema_shots", ids));
  touch(scene.project_id);
}

function copyShot(src: ShotRow, sceneId: string, position: number): string {
  const id = newId("csh");
  const now = Date.now();
  run(
    `INSERT INTO cinema_shots (id, user_id, project_id, scene_id, position, action, size, angle, movement, lens, focus, lighting, mood,
                               duration, sound, cast_ids, location_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, src.user_id, src.project_id, sceneId, position, src.action, src.size, src.angle, src.movement, src.lens, src.focus, src.lighting, src.mood,
    src.duration, src.sound, src.cast_ids, src.location_id, now, now,
  );
  return id;
}

/** Copies the shot's plan (not its takes) right after the original. */
export function duplicateShot(userId: string, id: string): ShotRow {
  const src = ownedShot(userId, id);
  if (shotsOfScene(src.scene_id).length >= LIMITS.shotsPerScene) throw new ApiError(409, "limit_reached", `A scene holds up to ${LIMITS.shotsPerScene} shots.`);
  let copyId = "";
  tx(() => {
    const order = shotsOfScene(src.scene_id).map((s) => s.id);
    copyId = copyShot(src, src.scene_id, src.position + 1);
    order.splice(order.indexOf(src.id) + 1, 0, copyId);
    renumber("cinema_shots", order);
  });
  touch(src.project_id);
  return ownedShot(userId, copyId);
}

/* --------------------------------- elements -------------------------------- */

function readRefs(userId: string, body: Record<string, unknown>): string[] | undefined {
  const ids = idList(body, "refAssetIds", "Reference images", LIMITS.refs);
  if (!ids) return ids;
  for (const id of ids) {
    const a = ownedAsset(userId, id);
    if (a.kind !== "image") throw badRequest("Reference files must be images.");
  }
  return ids;
}

export function createElement(userId: string, projectId: string, body: Record<string, unknown>): ElementRow {
  ownedProject(userId, projectId);
  if (elementsOf(projectId).length >= LIMITS.elements) throw new ApiError(409, "limit_reached", `A project holds up to ${LIMITS.elements} cast members, places and props.`);
  const kind = body.kind;
  if (typeof kind !== "string" || !ELEMENT_KINDS.includes(kind as ElementKind)) throw badRequest("Kind must be character, location or prop.");
  const name = requiredText(body, "name", "A name", 80);
  const description = text(body, "description", "The description", 1000) ?? "";
  const refs = readRefs(userId, body) ?? [];
  const id = newId("cel");
  run(
    "INSERT INTO cinema_elements (id, user_id, project_id, kind, name, description, ref_asset_ids, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    id, userId, projectId, kind, name, description, JSON.stringify(refs), Date.now(),
  );
  touch(projectId);
  return ownedElement(userId, id);
}

export function updateElement(userId: string, id: string, body: Record<string, unknown>): ElementRow {
  const row = ownedElement(userId, id);
  if (body.kind !== undefined && body.kind !== row.kind) throw badRequest("The kind cannot change. Make a new one instead.");
  const name = body.name === undefined ? row.name : requiredText(body, "name", "A name", 80);
  const description = text(body, "description", "The description", 1000) ?? row.description;
  const refs = readRefs(userId, body);
  run("UPDATE cinema_elements SET name = ?, description = ?, ref_asset_ids = ? WHERE id = ?", name, description, refs ? JSON.stringify(refs) : row.ref_asset_ids, id);
  touch(row.project_id);
  return ownedElement(userId, id);
}

/** Removes the element and takes it out of every shot that used it. */
export function deleteElement(userId: string, id: string) {
  const row = ownedElement(userId, id);
  tx(() => {
    for (const shot of shotsOfProject(row.project_id)) {
      const cast = parseJson<string[]>(shot.cast_ids, []);
      if (cast.includes(id) || shot.location_id === id) {
        run("UPDATE cinema_shots SET cast_ids = ?, location_id = ? WHERE id = ?", JSON.stringify(cast.filter((c) => c !== id)), shot.location_id === id ? null : shot.location_id, shot.id);
      }
    }
    run("DELETE FROM cinema_elements WHERE id = ?", id);
  });
  touch(row.project_id);
}
