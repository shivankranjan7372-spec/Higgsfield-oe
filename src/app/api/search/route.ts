import { badRequest, intParam, publicRoute } from "@/server/http";
import { SEARCH_TYPES, search, searchEngine, type SearchType } from "@/server/notify";

/**
 * GET /api/search?q=&types=models,files,generations,folders,posts&limit=5
 * Grouped results. Signed out, only models and public posts are searched.
 */
export const GET = publicRoute(({ req, user }) => {
  const sp = req.nextUrl.searchParams;
  const q = (sp.get("q") ?? "").trim();
  if (!q) throw badRequest("Type something to search for.");
  if (q.length > 100) throw badRequest("Keep searches under 100 characters.");
  const raw = (sp.get("types") ?? "").split(",").map((t) => t.trim()).filter(Boolean);
  if (raw.some((t) => !(SEARCH_TYPES as readonly string[]).includes(t))) throw badRequest(`Search types are: ${SEARCH_TYPES.join(", ")}.`);
  const types = (raw.length ? raw : [...SEARCH_TYPES]) as SearchType[];
  const started = performance.now();
  const groups = search(user?.id ?? null, q, types, intParam(req, "limit", 5, 1, 20));
  return {
    query: q,
    groups,
    total: groups.reduce((n, g) => n + g.items.length, 0),
    engine: searchEngine(),
    tookMs: Math.round((performance.now() - started) * 10) / 10,
  };
});
