import { openApiDocument } from "@/server/developer/openapi";
import { publicRoute } from "@/server/http";
import { publicOrigin } from "@/server/origin";

/** GET /api/v1/openapi.json  Built from the same route table the routes use. No key needed. */
export const GET = publicRoute(({ req }) => openApiDocument(publicOrigin(req)));
