import { fileResponse, visibleAsset } from "@/server/assets";
import { publicRoute } from "@/server/http";

/**
 * GET /api/assets/:id/file[?poster=1][&download=1]
 * The file itself. Private to its owner unless the asset was published.
 */
export const GET = publicRoute<{ id: string }>(({ req, user, params }) => {
  const q = req.nextUrl.searchParams;
  return fileResponse(req, visibleAsset(user?.id ?? null, params.id), { poster: q.get("poster") === "1", download: q.get("download") === "1" });
});
