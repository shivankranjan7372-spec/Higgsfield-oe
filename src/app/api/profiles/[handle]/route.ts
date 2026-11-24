import { publicRoute } from "@/server/http";
import { getProfile } from "@/server/community/profiles";

/** GET /api/profiles/:handle  A member's public profile. Works signed out. */
export const GET = publicRoute<{ handle: string }>(({ user, params }) => ({ profile: getProfile(user, params.handle) }));
