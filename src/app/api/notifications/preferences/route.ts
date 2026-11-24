import { badRequest, readJson, route } from "@/server/http";
import { preferences, setPreferences } from "@/server/notify";

/** GET /api/notifications/preferences */
export const GET = route(({ user }) => ({ preferences: preferences(user.id) }));

/** PUT /api/notifications/preferences  { kinds: { like: false, ... } } */
export const PUT = route(async ({ req, user }) => {
  const body = await readJson(req);
  const kinds = body.kinds;
  if (!kinds || typeof kinds !== "object" || Array.isArray(kinds)) throw badRequest('Send { "kinds": { "<kind>": true | false } }.');
  return { preferences: setPreferences(user.id, kinds as Record<string, unknown>) };
});
