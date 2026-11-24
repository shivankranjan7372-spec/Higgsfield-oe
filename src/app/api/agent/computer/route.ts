import { route } from "@/server/http";
import { computerStatus } from "@/server/agent/computer";
import { ensureAgent } from "@/server/agent/loop";

/** GET /api/agent/computer  The member's cloud computer status. */
export const GET = route(({ user }) => {
  ensureAgent();
  return { computer: computerStatus(user.id) };
});
