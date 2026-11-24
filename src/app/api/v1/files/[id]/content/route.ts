import { fileResponse, ownedAsset } from "@/server/assets";
import { apiRoute } from "@/server/developer/api";

/** GET /api/v1/files/:id/content[?download=1]  The bytes. Honours Range. */
export const GET = apiRoute<{ id: string }>("getFileContent", ({ req, user, params }) =>
  fileResponse(req, ownedAsset(user.id, params.id), { download: req.nextUrl.searchParams.get("download") === "1" }),
);
