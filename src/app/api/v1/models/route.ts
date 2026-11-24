import { apiRoute } from "@/server/developer/api";
import { listModels } from "@/server/developer/service";

/** GET /api/v1/models?kind=&available=1 */
export const GET = apiRoute("listModels", ({ req }) => {
  const q = req.nextUrl.searchParams;
  return { models: listModels({ kind: q.get("kind"), available: q.get("available") === "1" }) };
});
