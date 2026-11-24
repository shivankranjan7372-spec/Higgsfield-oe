import { usage } from "@/server/developer/usage";
import { intParam, route } from "@/server/http";

/** GET /api/developer/usage?key=&limit=&before=  Request log, newest first, plus per-key totals. */
export const GET = route(({ req, user }) =>
  usage(user.id, {
    keyId: req.nextUrl.searchParams.get("key") || undefined,
    limit: intParam(req, "limit", 50, 1, 200),
    before: intParam(req, "before", 0, 0, Number.MAX_SAFE_INTEGER) || undefined,
  }),
);
