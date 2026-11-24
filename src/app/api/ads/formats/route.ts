import { publicRoute } from "@/server/http";
import { formatCatalog } from "@/server/ads/catalog";
import { copyWriter } from "@/server/ads/copy";

/** GET /api/ads/formats — the ad format catalog. Works signed out. */
export const GET = publicRoute(() => ({ formats: formatCatalog(), copyWriter: copyWriter().kind }));
