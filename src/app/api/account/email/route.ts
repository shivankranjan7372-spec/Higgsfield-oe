import { publicUser } from "@/server/auth";
import { changeEmail } from "@/server/account/profile";
import { rateLimit, readJson, route } from "@/server/http";

/** POST /api/account/email  { email, password } */
export const POST = route(async ({ req, user }) => {
  rateLimit(`account-email:${user.id}`, 10, 3_600_000);
  const body = await readJson(req);
  return { user: publicUser(changeEmail(user, { email: body.email, password: body.password })) };
});
