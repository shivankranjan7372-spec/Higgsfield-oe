import { referralSummary } from "@/server/account/codes";
import { route } from "@/server/http";

/** GET /api/account/referral   This member's invite code and how it has done. */
export const GET = route(({ user }) => referralSummary(user.id));
