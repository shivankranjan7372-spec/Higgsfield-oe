import { readJson, route } from "@/server/http";
import { answerCard, ensureAgent } from "@/server/agent/loop";

/** POST /api/agent/approvals/:id  { decision: "allow"|"always"|"deny" } or { choice } for a question. */
export const POST = route<{ id: string }>(async ({ req, user, params }) => {
  ensureAgent();
  const body = await readJson(req);
  return answerCard(user.id, params.id, { decision: body.decision, choice: body.choice });
});
