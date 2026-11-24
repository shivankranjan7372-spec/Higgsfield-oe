import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/server/auth";
import { accountOverview } from "@/server/account";
import { deleteAccount } from "@/server/account/profile";
import { clientKey, rateLimit, readJson, route } from "@/server/http";

/** GET /api/account   Profile, balance, subscription and preferences in one read. */
export const GET = route(({ user }) => accountOverview(user));

/** DELETE /api/account  { confirm: "DELETE", password }   password is not needed for guests. */
export const DELETE = route(async ({ req, user }) => {
  rateLimit(`account-delete:${clientKey(req)}`, 10, 3_600_000);
  const body = await readJson(req);
  deleteAccount(user, { password: body.password, confirm: body.confirm });
  (await cookies()).delete(SESSION_COOKIE);
  return { deleted: true };
});
