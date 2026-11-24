import { currentToken } from "@/server/account";
import { revokeSession } from "@/server/account/profile";
import { badRequest, route } from "@/server/http";

/** DELETE /api/account/sessions/:id   Signs out one other session. */
export const DELETE = route<{ id: string }>(({ req, user, params }) => {
  if (params.id.length > 64) throw badRequest("That session does not exist.");
  revokeSession(user.id, params.id, currentToken(req));
  return { revoked: true };
});
