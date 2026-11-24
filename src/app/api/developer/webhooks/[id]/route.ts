import { deleteWebhook, getWebhook, updateWebhook } from "@/server/developer/webhooks";
import { readJson, route } from "@/server/http";

/** GET /api/developer/webhooks/:id */
export const GET = route<{ id: string }>(({ user, params }) => ({ webhook: getWebhook(user.id, params.id) }));

/** PATCH /api/developer/webhooks/:id  { url?, events?, description?, enabled? } */
export const PATCH = route<{ id: string }>(async ({ req, user, params }) => ({ webhook: await updateWebhook(user.id, params.id, await readJson(req)) }));

/** DELETE /api/developer/webhooks/:id  Removes the endpoint and its delivery log. */
export const DELETE = route<{ id: string }>(({ user, params }) => {
  deleteWebhook(user.id, params.id);
  return { ok: true };
});
