import { route } from "@/server/http";
import { librarySummary } from "@/server/library/listing";

/** GET /api/library/summary  Sidebar counts, storage by kind, models used. */
export const GET = route(({ user }) => ({ ...librarySummary(user.id) }));
