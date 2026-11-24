import { route } from "@/server/http";
import { pinnedApps } from "@/server/apps/service";

/** GET /api/apps/pinned  The member's pinned apps, most recently pinned first. */
export const GET = route(({ user }) => ({ apps: pinnedApps(user.id) }));
