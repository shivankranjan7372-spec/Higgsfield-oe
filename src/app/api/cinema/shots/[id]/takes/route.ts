import { balance } from "@/server/credits";
import { generateTakes, shotWithTakes } from "@/server/cinema/takes";
import { ownedShot } from "@/server/cinema/store";
import { readJson, route } from "@/server/http";

/** GET /api/cinema/shots/:id/takes */
export const GET = route<{ id: string }>(({ user, params }) => ({ takes: shotWithTakes(ownedShot(user.id, params.id)).takes }));

/** POST /api/cinema/shots/:id/takes  { mode?, modelId?, count?, fromTakeId?, values? }  Starts new takes. */
export const POST = route<{ id: string }>(async ({ req, user, params }) => {
  const takes = generateTakes(user, params.id, await readJson(req));
  return { takes, balance: balance(user.id) };
});
