import "server-only";

import { run, tx } from "@/server/db";
import { badRequest } from "@/server/errors";
import { idList, marks } from "./common";
import { moveAssets, requireLive } from "./folders";
import { purgeAssets, restoreAssets, trashAssets } from "./trash";

export const BULK_ACTIONS = ["favorite", "move", "trash", "restore", "delete"] as const;
export type BulkAction = (typeof BULK_ACTIONS)[number];

/**
 * One call, up to 200 files, all or nothing. Each action checks every id first and
 * changes nothing if one fails.
 */
export function bulk(userId: string, body: Record<string, unknown>): { action: BulkAction; count: number } {
  const action = BULK_ACTIONS.find((a) => a === body.action);
  if (!action) throw badRequest(`Pick an action: ${BULK_ACTIONS.join(", ")}.`);
  switch (action) {
    case "favorite": {
      if (typeof body.favorite !== "boolean") throw badRequest("Say whether to favourite (true) or unfavourite (false).");
      const ids = idList(body.ids);
      const value = body.favorite ? 1 : 0;
      tx(() => {
        requireLive(userId, ids);
        run(`UPDATE assets SET favorite = ? WHERE user_id = ? AND id IN (${marks(ids.length)})`, value, userId, ...ids);
      });
      return { action, count: ids.length };
    }
    case "move": {
      if (body.folderId !== null && typeof body.folderId !== "string") throw badRequest("Pick a folder, or null for no folder.");
      return { action, count: moveAssets(userId, body.ids, body.folderId).moved };
    }
    case "trash":
      return { action, count: trashAssets(userId, body.ids).trashed };
    case "restore":
      return { action, count: restoreAssets(userId, body.ids).restored };
    case "delete":
      return { action, count: purgeAssets(userId, body.ids).deleted };
  }
}
