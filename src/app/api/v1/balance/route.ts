import { apiRoute } from "@/server/developer/api";
import { balanceOut } from "@/server/developer/service";

/** GET /api/v1/balance */
export const GET = apiRoute("getBalance", ({ user }) => balanceOut(user));
