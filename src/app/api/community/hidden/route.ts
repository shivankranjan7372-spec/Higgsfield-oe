import { route } from "@/server/http";
import { listHidden } from "@/server/community/profiles";

/** GET /api/community/hidden  Members whose posts the viewer has hidden. */
export const GET = route(({ user }) => ({ members: listHidden(user) }));
