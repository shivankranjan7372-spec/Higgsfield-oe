import { publicRoute } from "@/server/http";
import { suggestions } from "@/server/notify";

/** GET /api/search/suggestions  ->  { popularModels, recentItems, recentSearches } */
export const GET = publicRoute(({ user }) => suggestions(user?.id ?? null));
