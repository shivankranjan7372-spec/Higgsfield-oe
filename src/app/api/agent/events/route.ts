import { route } from "@/server/http";
import { openStream } from "@/server/agent/hub";
import { ensureAgent } from "@/server/agent/loop";

/** GET /api/agent/events  The member's Server-Sent Events stream for every chat. */
export const GET = route(({ req, user }) => {
  ensureAgent();
  return openStream(user.id, req.signal);
});
