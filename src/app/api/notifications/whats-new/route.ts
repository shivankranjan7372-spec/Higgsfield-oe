import { publicRoute } from "@/server/http";
import { whatsNew } from "@/server/notify";

/** GET /api/notifications/whats-new  ->  { items, unseen }. Signed out, everything is unseen. */
export const GET = publicRoute(({ user }) => whatsNew(user?.id ?? null));
