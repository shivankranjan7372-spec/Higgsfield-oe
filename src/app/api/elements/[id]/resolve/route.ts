import { readJson, route } from "@/server/http";
import { resolveElement } from "@/server/library/elements";

/** POST /api/elements/:id/resolve  { modelId, slot?, dryRun? }  File ids for the model's reference slot. */
export const POST = route<{ id: string }>(async ({ req, user, params }) => {
  const body = await readJson(req);
  return { ...resolveElement(user.id, params.id, body.modelId, body.slot, body.dryRun === true) };
});
