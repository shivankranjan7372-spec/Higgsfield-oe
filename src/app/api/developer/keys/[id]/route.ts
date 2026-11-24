import { getKey, revokeKey, updateKey } from "@/server/developer/keys";
import { readJson, route } from "@/server/http";

/** GET /api/developer/keys/:id */
export const GET = route<{ id: string }>(({ user, params }) => ({ key: getKey(user.id, params.id) }));

/** PATCH /api/developer/keys/:id  { name?, scopes? } */
export const PATCH = route<{ id: string }>(async ({ req, user, params }) => ({ key: updateKey(user.id, params.id, await readJson(req)) }));

/** DELETE /api/developer/keys/:id  Revokes the key for good. */
export const DELETE = route<{ id: string }>(({ user, params }) => ({ key: revokeKey(user.id, params.id) }));
