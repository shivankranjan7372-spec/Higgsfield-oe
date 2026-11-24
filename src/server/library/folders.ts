import "server-only";

import { all, get, newId, run, tx } from "@/server/db";
import { ApiError, badRequest, notFound } from "@/server/errors";
import { idList, marks } from "./common";

/** Folders use the core `folders` table. A file sits in at most one folder (`assets.folder_id`). */

export const FOLDER_MAX = 500;
export const FOLDER_NAME_MAX = 80;

interface FolderRow {
  id: string;
  user_id: string;
  name: string;
  created_at: number;
}

export interface Folder {
  id: string;
  name: string;
  /** Files in the folder, not counting the trash. */
  count: number;
  /** Bytes of those files. */
  bytes: number;
  createdAt: number;
}

export function folderName(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw badRequest("Give the folder a name.");
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length > FOLDER_NAME_MAX) throw badRequest(`Keep the folder name under ${FOLDER_NAME_MAX} characters.`);
  return name;
}

function ownedFolder(userId: string, id: string): FolderRow {
  const row = get<FolderRow>("SELECT * FROM folders WHERE id = ? AND user_id = ?", id, userId);
  if (!row) throw notFound("That folder does not exist.");
  return row;
}

function nameTaken(userId: string, name: string, exceptId: string | null): boolean {
  return !!get("SELECT 1 FROM folders WHERE user_id = ? AND lower(name) = lower(?) AND id != ?", userId, name, exceptId ?? "");
}

export function listFolders(userId: string): { folders: Folder[]; unfiled: number } {
  const rows = all<FolderRow & { count: number; bytes: number }>(
    `SELECT f.*, COUNT(a.id) AS count, COALESCE(SUM(a.bytes), 0) AS bytes
       FROM folders f LEFT JOIN assets a ON a.folder_id = f.id AND a.user_id = f.user_id AND a.deleted_at IS NULL
      WHERE f.user_id = ?
      GROUP BY f.id
      ORDER BY lower(f.name), f.created_at`,
    userId,
  );
  const unfiled = get<{ n: number }>("SELECT COUNT(*) AS n FROM assets WHERE user_id = ? AND deleted_at IS NULL AND folder_id IS NULL", userId)!.n;
  return { folders: rows.map(toFolder), unfiled };
}

export function getFolder(userId: string, id: string): Folder {
  ownedFolder(userId, id);
  const row = get<FolderRow & { count: number; bytes: number }>(
    `SELECT f.*, COUNT(a.id) AS count, COALESCE(SUM(a.bytes), 0) AS bytes
       FROM folders f LEFT JOIN assets a ON a.folder_id = f.id AND a.user_id = f.user_id AND a.deleted_at IS NULL
      WHERE f.id = ? AND f.user_id = ? GROUP BY f.id`,
    id,
    userId,
  )!;
  return toFolder(row);
}

function toFolder(r: FolderRow & { count: number; bytes: number }): Folder {
  return { id: r.id, name: r.name, count: r.count, bytes: r.bytes, createdAt: r.created_at };
}

export function createFolder(userId: string, name: string): Folder {
  return tx(() => {
    if (get<{ n: number }>("SELECT COUNT(*) AS n FROM folders WHERE user_id = ?", userId)!.n >= FOLDER_MAX) {
      throw new ApiError(409, "limit_reached", `You can have up to ${FOLDER_MAX} folders. Delete one first.`);
    }
    if (nameTaken(userId, name, null)) throw new ApiError(409, "name_taken", "You already have a folder with that name.");
    const id = newId("fld");
    run("INSERT INTO folders (id, user_id, name, created_at) VALUES (?, ?, ?, ?)", id, userId, name, Date.now());
    return getFolder(userId, id);
  });
}

export function renameFolder(userId: string, id: string, name: string): Folder {
  return tx(() => {
    ownedFolder(userId, id);
    if (nameTaken(userId, name, id)) throw new ApiError(409, "name_taken", "You already have a folder with that name.");
    run("UPDATE folders SET name = ? WHERE id = ? AND user_id = ?", name, id, userId);
    return getFolder(userId, id);
  });
}

/** Deletes the folder. Its files, including any in the trash, go back to "no folder". */
export function deleteFolder(userId: string, id: string): { moved: number } {
  return tx(() => {
    ownedFolder(userId, id);
    const moved = run("UPDATE assets SET folder_id = NULL WHERE user_id = ? AND folder_id = ?", userId, id).changes;
    run("DELETE FROM folders WHERE id = ? AND user_id = ?", id, userId);
    return { moved };
  });
}

/**
 * Moves files into a folder, or out of any folder when `folderId` is null. All or nothing:
 * if one id is not the member's own live file, nothing moves.
 */
export function moveAssets(userId: string, rawIds: unknown, folderId: string | null): { moved: number } {
  const ids = idList(rawIds);
  return tx(() => {
    if (folderId !== null) ownedFolder(userId, folderId);
    requireLive(userId, ids);
    run(`UPDATE assets SET folder_id = ? WHERE user_id = ? AND id IN (${marks(ids.length)})`, folderId, userId, ...ids);
    return { moved: ids.length };
  });
}

/** Throws a 404 unless every id is the member's own file and not in the trash. */
export function requireLive(userId: string, ids: string[]) {
  const n = get<{ n: number }>(
    `SELECT COUNT(*) AS n FROM assets WHERE user_id = ? AND deleted_at IS NULL AND id IN (${marks(ids.length)})`,
    userId,
    ...ids,
  )!.n;
  if (n !== ids.length) {
    throw notFound(ids.length === 1 ? "That file does not exist." : "Some of those files no longer exist. Nothing was changed.");
  }
}
