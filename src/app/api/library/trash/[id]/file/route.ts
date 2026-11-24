import { fileResponse } from "@/server/assets";
import { route } from "@/server/http";
import { trashedAsset } from "@/server/library/trash";

/** GET /api/library/trash/:id/file[?poster=1]  Preview of a file in the trash. Owner only. */
export const GET = route<{ id: string }>(({ req, user, params }) =>
  fileResponse(req, trashedAsset(user.id, params.id), { poster: req.nextUrl.searchParams.get("poster") === "1" }),
);
export const HEAD = GET;
