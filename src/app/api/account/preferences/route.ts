import { DEFAULTS, LANGUAGES, NOTICES, getPreferences, setPreferences } from "@/server/account/prefs";
import { readJson, route } from "@/server/http";

/** GET /api/account/preferences */
export const GET = route(({ user }) => ({ preferences: getPreferences(user.id), defaults: DEFAULTS, options: { languages: LANGUAGES, notices: NOTICES } }));

/** PATCH /api/account/preferences  { defaultPrivacy?, language?, theme?, notices? } */
export const PATCH = route(async ({ req, user }) => ({ preferences: setPreferences(user.id, await readJson(req, 8_000)) }));
