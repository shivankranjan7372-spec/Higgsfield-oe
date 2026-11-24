import { publicRoute } from "@/server/http";
import { catalogReport } from "@/server/apps/service";

/** GET /api/apps/check  The result of the catalog check, for tests and operators. */
export const GET = publicRoute(() => catalogReport());
