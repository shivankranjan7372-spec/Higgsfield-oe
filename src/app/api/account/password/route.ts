import { currentToken } from "@/server/account";
import { changePassword } from "@/server/account/profile";
import { rateLimit, readJson, route } from "@/server/http";

/** POST /api/account/password  { currentPassword, newPassword }   Also signs out every other session. */
export const POST = route(async ({ req, user }) => {
  rateLimit(`account-password:${user.id}`, 10, 3_600_000);
  const body = await readJson(req);
  const signedOut = changePassword(user, { currentPassword: body.currentPassword, newPassword: body.newPassword }, currentToken(req));
  return { changed: true, signedOut };
});
