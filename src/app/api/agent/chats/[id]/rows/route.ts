import { intParam, route } from "@/server/http";
import { ensureAgent } from "@/server/agent/loop";
import { ownedChat, rowsAfter, toChat } from "@/server/agent/transcript";

/**
 * GET /api/agent/chats/:id/rows?after=<updatedSeq>&limit=
 * Rows changed after `after`, oldest change first. Upsert them by `seq`.
 */
export const GET = route<{ id: string }>(({ req, user, params }) => {
  ensureAgent();
  const chat = ownedChat(user.id, params.id);
  const rows = rowsAfter(chat.id, intParam(req, "after", 0, 0, Number.MAX_SAFE_INTEGER), intParam(req, "limit", 200, 1, 500));
  return { chat: toChat(chat), rows, rev: rows.length ? rows[rows.length - 1].updatedSeq : intParam(req, "after", 0, 0, Number.MAX_SAFE_INTEGER) };
});
