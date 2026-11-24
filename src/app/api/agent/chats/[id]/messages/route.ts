import { readJson, route } from "@/server/http";
import { publicOrigin } from "@/server/origin";
import { readMessage } from "@/server/agent/input";
import { ensureAgent, postMessage } from "@/server/agent/loop";

/**
 * POST /api/agent/chats/:id/messages  { text, fileIds?, mode?: "ask"|"auto", model? }
 * Queues a turn. The reply arrives as rows on the event stream and from /rows.
 */
export const POST = route<{ id: string }>(async ({ req, user, params }) => {
  ensureAgent();
  return postMessage(user, params.id, readMessage(await readJson(req, 100_000)), publicOrigin(req));
});
