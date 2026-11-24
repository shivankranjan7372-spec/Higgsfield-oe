import { handleAvailable } from "@/server/account/profile";
import { route } from "@/server/http";

/** GET /api/account/handle?handle=   Is this handle valid and free? */
export const GET = route(({ req, user }) => handleAvailable(user, req.nextUrl.searchParams.get("handle") ?? ""));
