import { badRequest, intParam, readJson, route } from "@/server/http";
import { createElement, ELEMENT_SORTS, ELEMENT_TYPES, elementInput, listElements } from "@/server/library/elements";

/** GET /api/elements?type=&q=&tag=&sort=recent|created|name|used|popular&limit=&offset= */
export const GET = route(({ req, user }) => {
  const sp = req.nextUrl.searchParams;
  const typeRaw = sp.get("type");
  const type = ELEMENT_TYPES.find((t) => t === typeRaw);
  if (typeRaw && typeRaw !== "all" && !type) throw badRequest(`Unknown type "${typeRaw.slice(0, 40)}".`);
  const sortRaw = sp.get("sort");
  const sort = ELEMENT_SORTS.find((s) => s === sortRaw);
  if (sortRaw && !sort) throw badRequest(`Unknown sort "${sortRaw.slice(0, 40)}".`);
  const q = (sp.get("q") ?? "").trim();
  if (q.length > 200) throw badRequest("Keep the search under 200 characters.");
  const tag = (sp.get("tag") ?? "").trim().toLowerCase();
  return listElements(user.id, {
    type,
    q: q || undefined,
    tag: tag || undefined,
    sort: sort ?? "recent",
    limit: intParam(req, "limit", 60, 1, 200),
    offset: intParam(req, "offset", 0, 0, 100_000),
  });
});

/** POST /api/elements  { type, name, description?, tags?, assetIds } */
export const POST = route(async ({ req, user }) => ({ element: createElement(user.id, elementInput(await readJson(req), true)) }));
