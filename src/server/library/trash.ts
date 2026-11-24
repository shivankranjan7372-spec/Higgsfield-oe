import "server-only";

import fs from "node:fs";
import { assetFile, toAsset, type Asset, type AssetRow } from "@/server/assets";
import { all, get, run, tx } from "@/server/db";
import { notFound } from "@/server/errors";
import { decodeCursor, encodeCursor, idList, marks, TRASH_MS } from "./common";
import { requireLive } from "./folders";

/**
 * The trash. The core `removeAsset` deletes files at once; here a file is only hidden
 * (`assets.deleted_at` set, so every core read and the generator treat it as gone) and a
 * `library_trash` row remembers it can come back. Deleting for good removes the files and
 * the trash row; the asset row stays marked deleted, the same as a core delete.
 */

export interface TrashedAsset extends Asset {
  trashedAt: number;
  /** When it will be deleted for good unless restored. */
  expiresAt: number;
  /** Thumbnail and preview links that work while the file is in the trash. */
  trashUrl: string;
  trashPosterUrl: string | null;
}

type TrashRow = AssetRow & { trashed_at: number };

function toTrashed(r: TrashRow): TrashedAsset {
  const base = `/api/library/trash/${r.id}/file`;
  return {
    ...toAsset(r),
    trashedAt: r.trashed_at,
    expiresAt: r.trashed_at + TRASH_MS,
    trashUrl: base,
    trashPosterUrl: r.poster_path ? `${base}?poster=1` : null,
  };
}

/** Moves live files to the trash. All or nothing. */
export function trashAssets(userId: string, rawIds: unknown): { trashed: number } {
  const ids = idList(rawIds);
  return tx(() => {
    requireLive(userId, ids);
    const now = Date.now();
    // Unpublish and forget the provider copy, as the core delete does.
    run(`UPDATE assets SET deleted_at = ?, is_public = 0, remote_url = NULL WHERE user_id = ? AND id IN (${marks(ids.length)})`, now, userId, ...ids);
    for (const id of ids) run("INSERT OR REPLACE INTO library_trash (asset_id, user_id, trashed_at) VALUES (?, ?, ?)", id, userId, now);
    return { trashed: ids.length };
  });
}

function requireTrashed(userId: string, ids: string[]) {
  const n = get<{ n: number }>(`SELECT COUNT(*) AS n FROM library_trash WHERE user_id = ? AND asset_id IN (${marks(ids.length)})`, userId, ...ids)!.n;
  if (n !== ids.length) {
    throw notFound(ids.length === 1 ? "That file is not in the trash." : "Some of those files are not in the trash. Nothing was changed.");
  }
}

/** Brings files back from the trash, into the folder they were in (if it still exists). */
export function restoreAssets(userId: string, rawIds: unknown): { restored: number } {
  const ids = idList(rawIds);
  return tx(() => {
    requireTrashed(userId, ids);
    run(`UPDATE assets SET deleted_at = NULL WHERE user_id = ? AND id IN (${marks(ids.length)})`, userId, ...ids);
    run(`DELETE FROM library_trash WHERE user_id = ? AND asset_id IN (${marks(ids.length)})`, userId, ...ids);
    return { restored: ids.length };
  });
}

export function restoreAll(userId: string): { restored: number } {
  return tx(() => {
    const restored = run(
      "UPDATE assets SET deleted_at = NULL WHERE user_id = ? AND id IN (SELECT asset_id FROM library_trash WHERE user_id = ?)",
      userId,
      userId,
    ).changes;
    run("DELETE FROM library_trash WHERE user_id = ?", userId);
    return { restored };
  });
}

/**
 * Deletes files for good: from the trash, or straight from the library. All or nothing.
 * Disk files are removed after the rows commit, so a failed call never loses a file.
 */
export function purgeAssets(userId: string, rawIds: unknown): { deleted: number } {
  const ids = idList(rawIds);
  const rows = tx(() => {
    const rows = all<AssetRow>(
      `SELECT a.* FROM assets a
        WHERE a.user_id = ? AND a.id IN (${marks(ids.length)})
          AND (a.deleted_at IS NULL OR a.id IN (SELECT asset_id FROM library_trash WHERE user_id = ?))`,
      userId,
      ...ids,
      userId,
    );
    if (rows.length !== ids.length) {
      throw notFound(ids.length === 1 ? "That file does not exist." : "Some of those files no longer exist. Nothing was changed.");
    }
    return forget(userId, rows);
  });
  removeFiles(rows);
  return { deleted: rows.length };
}

/** Deletes everything in the trash for good. */
export function emptyTrash(userId: string): { deleted: number } {
  const rows = tx(() => forget(userId, all<AssetRow>("SELECT a.* FROM assets a JOIN library_trash t ON t.asset_id = a.id WHERE t.user_id = ? AND a.user_id = ?", userId, userId)));
  removeFiles(rows);
  return { deleted: rows.length };
}

/** Deletes trash older than 30 days. Called lazily whenever the member's trash or library summary is read. */
export function expireTrash(userId: string, now = Date.now()): number {
  const rows = tx(() =>
    forget(
      userId,
      all<AssetRow>(
        "SELECT a.* FROM assets a JOIN library_trash t ON t.asset_id = a.id WHERE t.user_id = ? AND a.user_id = ? AND t.trashed_at <= ?",
        userId,
        userId,
        now - TRASH_MS,
      ),
    ),
  );
  removeFiles(rows);
  return rows.length;
}

/** Marks rows deleted for good, inside the caller's transaction. */
function forget(userId: string, rows: AssetRow[]): AssetRow[] {
  if (rows.length === 0) return rows;
  const ids = rows.map((r) => r.id);
  const now = Date.now();
  for (let i = 0; i < ids.length; i += 200) {
    const part = ids.slice(i, i + 200);
    run(
      `UPDATE assets SET deleted_at = COALESCE(deleted_at, ?), is_public = 0, remote_url = NULL, folder_id = NULL WHERE user_id = ? AND id IN (${marks(part.length)})`,
      now,
      userId,
      ...part,
    );
    run(`DELETE FROM library_trash WHERE user_id = ? AND asset_id IN (${marks(part.length)})`, userId, ...part);
    run(`DELETE FROM element_assets WHERE asset_id IN (${marks(part.length)})`, ...part);
  }
  return rows;
}

function removeFiles(rows: AssetRow[]) {
  for (const row of rows) {
    for (const rel of [row.path, row.poster_path]) {
      if (!rel) continue;
      try {
        fs.rm(assetFile({ ...row, path: rel }), { force: true }, () => {});
      } catch {
        /* a path outside the data folder is never touched */
      }
    }
  }
}

export interface TrashPage {
  assets: TrashedAsset[];
  nextCursor: string | null;
  count: number;
  bytes: number;
  retentionDays: number;
}

/** Newest-trashed first. Expires old trash first. */
export function listTrash(userId: string, limit: number, cursor: string | null): TrashPage {
  expireTrash(userId);
  const at = decodeCursor(cursor);
  const rows = all<TrashRow>(
    `SELECT a.*, t.trashed_at FROM library_trash t JOIN assets a ON a.id = t.asset_id
      WHERE t.user_id = ? AND a.user_id = ?
        ${at ? "AND (t.trashed_at < ? OR (t.trashed_at = ? AND a.seq < ?))" : ""}
      ORDER BY t.trashed_at DESC, a.seq DESC LIMIT ?`,
    userId,
    userId,
    ...(at ? [Number(at[0]), Number(at[0]), at[1]] : []),
    limit + 1,
  );
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  const totals = get<{ n: number; bytes: number }>(
    "SELECT COUNT(*) AS n, COALESCE(SUM(a.bytes), 0) AS bytes FROM library_trash t JOIN assets a ON a.id = t.asset_id WHERE t.user_id = ?",
    userId,
  )!;
  return {
    assets: page.map(toTrashed),
    nextCursor: rows.length > limit && last ? encodeCursor(last.trashed_at, last.seq) : null,
    count: totals.n,
    bytes: totals.bytes,
    retentionDays: TRASH_MS / 86_400_000,
  };
}

/** A trashed file of this member, for the preview link. */
export function trashedAsset(userId: string, id: string): AssetRow {
  const row = get<AssetRow>(
    "SELECT a.* FROM assets a JOIN library_trash t ON t.asset_id = a.id WHERE a.id = ? AND a.user_id = ? AND t.user_id = ?",
    id,
    userId,
    userId,
  );
  if (!row) throw notFound("That file is not in the trash.");
  return row;
}
