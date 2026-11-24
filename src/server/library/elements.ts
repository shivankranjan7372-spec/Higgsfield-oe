import "server-only";

import { toAsset, type Asset, type AssetRow } from "@/server/assets";
import { all, get, newId, parseJson, run, tx, type Param } from "@/server/db";
import { ApiError, badRequest, notFound } from "@/server/errors";
import { getModel, type MediaSlot } from "@/registry";
import { likePattern, marks } from "./common";

/**
 * Elements: named sets of the member's own reference images (a character, an object, a style,
 * a place) that can be dropped into a model's reference slot in one go.
 * The images are ordinary files; an element only points at them. A file in the trash is left
 * out of the element until it is restored; a file deleted for good leaves the element.
 */

export const ELEMENT_TYPES = ["character", "object", "style", "place"] as const;
export type ElementType = (typeof ELEMENT_TYPES)[number];
export const ELEMENT_SORTS = ["recent", "created", "name", "used", "popular"] as const;

export const LIMITS = { elements: 500, name: 60, description: 1000, tags: 10, tag: 30, images: 12 };

interface ElementRow {
  id: string;
  user_id: string;
  type: ElementType;
  name: string;
  description: string;
  tags: string;
  use_count: number;
  last_used_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface Element {
  id: string;
  type: ElementType;
  name: string;
  description: string;
  tags: string[];
  /** The first image, or null if every image is in the trash. */
  cover: Asset | null;
  /** In order. Files in the trash are left out. */
  assets: Asset[];
  assetIds: string[];
  useCount: number;
  lastUsedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

/* ------------------------------- validation ------------------------------- */

export interface ElementInput {
  type?: ElementType;
  name?: string;
  description?: string;
  tags?: string[];
  assetIds?: string[];
}

/** Checks a create or edit body. `full` means every required field must be there. */
export function elementInput(body: Record<string, unknown>, full: boolean): ElementInput {
  const out: ElementInput = {};
  if (body.type !== undefined || full) {
    const t = ELEMENT_TYPES.find((x) => x === body.type);
    if (!t) throw badRequest(`Pick a type: ${ELEMENT_TYPES.join(", ")}.`);
    out.type = t;
  }
  if (body.name !== undefined || full) {
    if (typeof body.name !== "string" || !body.name.trim()) throw badRequest("Give the element a name.");
    const name = body.name.trim().replace(/\s+/g, " ");
    if (name.length > LIMITS.name) throw badRequest(`Keep the name under ${LIMITS.name} characters.`);
    out.name = name;
  }
  if (body.description !== undefined) {
    if (typeof body.description !== "string") throw badRequest("The description must be text.");
    if (body.description.trim().length > LIMITS.description) throw badRequest(`Keep the description under ${LIMITS.description} characters.`);
    out.description = body.description.trim();
  }
  if (body.tags !== undefined) {
    if (!Array.isArray(body.tags)) throw badRequest("Tags must be a list of words.");
    const tags = new Set<string>();
    for (const t of body.tags) {
      if (typeof t !== "string") throw badRequest("Tags must be a list of words.");
      const tag = t.trim().toLowerCase().replace(/\s+/g, " ");
      if (!tag) continue;
      if (tag.length > LIMITS.tag) throw badRequest(`Keep each tag under ${LIMITS.tag} characters.`);
      tags.add(tag);
    }
    if (tags.size > LIMITS.tags) throw badRequest(`Use at most ${LIMITS.tags} tags.`);
    out.tags = [...tags];
  }
  if (body.assetIds !== undefined || full) {
    const v = body.assetIds;
    if (!Array.isArray(v) || v.length === 0) throw badRequest("Add at least one image to the element.");
    if (v.length > LIMITS.images) throw badRequest(`An element holds at most ${LIMITS.images} images.`);
    const ids = new Set<string>();
    for (const id of v) {
      if (typeof id !== "string" || !id || id.length > 64) throw badRequest("One of those images is not valid.");
      ids.add(id);
    }
    out.assetIds = [...ids];
  }
  return out;
}

/** Every id must be the member's own live image. */
function requireImages(userId: string, ids: string[]) {
  const rows = all<{ id: string; kind: string }>(
    `SELECT id, kind FROM assets WHERE user_id = ? AND deleted_at IS NULL AND id IN (${marks(ids.length)})`,
    userId,
    ...ids,
  );
  if (rows.length !== ids.length) throw notFound(ids.length === 1 ? "That image does not exist." : "Some of those images no longer exist.");
  if (rows.some((r) => r.kind !== "image")) throw badRequest("Elements take images only.");
}

/* --------------------------------- reading -------------------------------- */

function ownedRow(userId: string, id: string): ElementRow {
  const row = get<ElementRow>("SELECT * FROM elements WHERE id = ? AND user_id = ?", id, userId);
  if (!row) throw notFound("That element does not exist.");
  return row;
}

/** Live images of each element, in order. */
function imagesOf(userId: string, ids: string[]): Map<string, AssetRow[]> {
  const out = new Map<string, AssetRow[]>();
  if (ids.length === 0) return out;
  const rows = all<AssetRow & { element_id: string }>(
    `SELECT a.*, ea.element_id FROM element_assets ea JOIN assets a ON a.id = ea.asset_id
      WHERE ea.element_id IN (${marks(ids.length)}) AND a.user_id = ? AND a.deleted_at IS NULL
      ORDER BY ea.element_id, ea.position`,
    ...ids,
    userId,
  );
  for (const r of rows) {
    const list = out.get(r.element_id) ?? [];
    list.push(r);
    out.set(r.element_id, list);
  }
  return out;
}

function toElement(r: ElementRow, images: AssetRow[]): Element {
  const assets = images.map(toAsset);
  return {
    id: r.id,
    type: r.type,
    name: r.name,
    description: r.description,
    tags: parseJson<string[]>(r.tags, []),
    cover: assets[0] ?? null,
    assets,
    assetIds: assets.map((a) => a.id),
    useCount: r.use_count,
    lastUsedAt: r.last_used_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function getElement(userId: string, id: string): Element {
  const row = ownedRow(userId, id);
  return toElement(row, imagesOf(userId, [id]).get(id) ?? []);
}

export interface ElementQuery {
  type?: ElementType;
  q?: string;
  tag?: string;
  sort: (typeof ELEMENT_SORTS)[number];
  limit: number;
  offset: number;
}

export function listElements(userId: string, f: ElementQuery): { elements: Element[]; total: number; counts: Record<"all" | ElementType, number> } {
  const where = ["user_id = ?"];
  const params: Param[] = [userId];
  if (f.q) {
    const p = likePattern(f.q);
    where.push("(name LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\' OR tags LIKE ? ESCAPE '\\')");
    params.push(p, p, p);
  }
  if (f.tag) (where.push("EXISTS (SELECT 1 FROM json_each(elements.tags) WHERE value = ?)"), params.push(f.tag));

  const counts = { all: 0, character: 0, object: 0, style: 0, place: 0 };
  for (const r of all<{ type: ElementType; n: number }>(`SELECT type, COUNT(*) AS n FROM elements WHERE ${where.join(" AND ")} GROUP BY type`, ...params)) {
    if (r.type in counts) counts[r.type] = r.n;
    counts.all += r.n;
  }
  if (f.type) (where.push("type = ?"), params.push(f.type));
  const order = {
    recent: "updated_at DESC, id",
    created: "created_at DESC, id",
    name: "lower(name), id",
    used: "last_used_at IS NULL, last_used_at DESC, updated_at DESC, id",
    popular: "use_count DESC, last_used_at DESC, id",
  }[f.sort];
  const rows = all<ElementRow>(`SELECT * FROM elements WHERE ${where.join(" AND ")} ORDER BY ${order} LIMIT ? OFFSET ?`, ...params, f.limit, f.offset);
  const images = imagesOf(userId, rows.map((r) => r.id));
  return { elements: rows.map((r) => toElement(r, images.get(r.id) ?? [])), total: f.type ? counts[f.type] : counts.all, counts };
}

/* -------------------------------- changing -------------------------------- */

function setImages(elementId: string, ids: string[]) {
  run("DELETE FROM element_assets WHERE element_id = ?", elementId);
  ids.forEach((assetId, i) => run("INSERT INTO element_assets (element_id, asset_id, position) VALUES (?, ?, ?)", elementId, assetId, i));
}

export function createElement(userId: string, input: ElementInput): Element {
  return tx(() => {
    if (get<{ n: number }>("SELECT COUNT(*) AS n FROM elements WHERE user_id = ?", userId)!.n >= LIMITS.elements) {
      throw new ApiError(409, "limit_reached", `You can have up to ${LIMITS.elements} elements. Delete one first.`);
    }
    requireImages(userId, input.assetIds!);
    const id = newId("elm");
    const now = Date.now();
    run(
      "INSERT INTO elements (id, user_id, type, name, description, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      id,
      userId,
      input.type!,
      input.name!,
      input.description ?? "",
      JSON.stringify(input.tags ?? []),
      now,
      now,
    );
    setImages(id, input.assetIds!);
    return getElement(userId, id);
  });
}

export function updateElement(userId: string, id: string, input: ElementInput): Element {
  return tx(() => {
    ownedRow(userId, id);
    if (input.type !== undefined) run("UPDATE elements SET type = ? WHERE id = ?", input.type, id);
    if (input.name !== undefined) run("UPDATE elements SET name = ? WHERE id = ?", input.name, id);
    if (input.description !== undefined) run("UPDATE elements SET description = ? WHERE id = ?", input.description, id);
    if (input.tags !== undefined) run("UPDATE elements SET tags = ? WHERE id = ?", JSON.stringify(input.tags), id);
    if (input.assetIds !== undefined) {
      requireImages(userId, input.assetIds);
      // Images now in the trash were not shown to the member, so keep them at the end:
      // restoring them brings them back to the element.
      const hidden = all<{ asset_id: string }>(
        `SELECT ea.asset_id FROM element_assets ea JOIN library_trash t ON t.asset_id = ea.asset_id
          WHERE ea.element_id = ? AND t.user_id = ? ORDER BY ea.position`,
        id,
        userId,
      ).map((r) => r.asset_id);
      setImages(id, [...input.assetIds, ...hidden.filter((h) => !input.assetIds!.includes(h))]);
    }
    run("UPDATE elements SET updated_at = ? WHERE id = ?", Date.now(), id);
    return getElement(userId, id);
  });
}

/** Deletes the element. Its images stay in the library. */
export function deleteElement(userId: string, id: string) {
  tx(() => {
    ownedRow(userId, id);
    run("DELETE FROM element_assets WHERE element_id = ?", id);
    run("DELETE FROM elements WHERE id = ? AND user_id = ?", id, userId);
  });
}

/* -------------------------------- resolving ------------------------------- */

export interface Resolved {
  modelId: string;
  slot: { id: string; label: string; min: number; max: number };
  /** Ready for a reference slot, cut to the slot's maximum. */
  assetIds: string[];
  /** Ready to merge into `inputs` of `POST /api/jobs`. */
  inputs: Record<string, string[]>;
  /** Images left out because the slot is full. */
  dropped: string[];
  element: Element;
}

/**
 * Turns an element into file ids for one model's image slot. Picks the slot named `slotId`,
 * else the model's `refs` slot, else its first image slot. Counts as a use unless `dryRun`.
 */
export function resolveElement(userId: string, id: string, modelId: unknown, slotId: unknown, dryRun: boolean): Resolved {
  const model = typeof modelId === "string" ? getModel(modelId) : undefined;
  if (!model) throw badRequest("Pick a model first.");
  if (slotId !== undefined && slotId !== null && typeof slotId !== "string") throw badRequest("Unknown slot.");
  const imageSlots = model.slots.filter((s) => s.accept.includes("image") && s.max > 0);
  let slot: MediaSlot | undefined;
  if (typeof slotId === "string" && slotId) {
    slot = model.slots.find((s) => s.id === slotId);
    if (!slot) throw badRequest(`${model.name} has no "${slotId.slice(0, 40)}" slot.`);
    if (!slot.accept.includes("image") || slot.max < 1) throw badRequest(`"${slot.label}" does not take images.`);
  } else {
    slot = imageSlots.find((s) => s.id === "refs") ?? imageSlots[0];
    if (!slot) throw new ApiError(409, "no_reference_slot", `${model.name} does not take reference images.`);
  }
  return tx(() => {
    const element = getElement(userId, id);
    if (element.assetIds.length === 0) throw new ApiError(409, "element_empty", "This element has no images. Add one, or restore its images from the trash.");
    const assetIds = element.assetIds.slice(0, slot.max);
    if (!dryRun) {
      const now = Date.now();
      run("UPDATE elements SET use_count = use_count + 1, last_used_at = ? WHERE id = ? AND user_id = ?", now, id, userId);
      element.useCount += 1;
      element.lastUsedAt = now;
    }
    return {
      modelId: model.id,
      slot: { id: slot.id, label: slot.label, min: slot.min, max: slot.max },
      assetIds,
      inputs: { [slot.id]: assetIds },
      dropped: element.assetIds.slice(slot.max),
      element,
    };
  });
}
