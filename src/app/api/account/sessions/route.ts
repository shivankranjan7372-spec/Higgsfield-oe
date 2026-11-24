import { currentToken } from "@/server/account";
import { listSessions, signOutOthers } from "@/server/account/profile";
import { route } from "@/server/http";

/** GET /api/account/sessions   Every signed-in session, newest first. */
export const GET = route(({ req, user }) => ({ sessions: listSessions(user.id, currentToken(req)) }));

/** DELETE /api/account/sessions   Signs out every session except this one. */
export const DELETE = route(({ req, user }) => ({ signedOut: signOutOthers(user.id, currentToken(req)) }));
