import { readJson, route } from "@/server/http";
import { listProducts, saveProduct } from "@/server/ads/library";

/** GET /api/ads/products?brandKitId= */
export const GET = route(({ req, user }) => ({ products: listProducts(user.id, req.nextUrl.searchParams.get("brandKitId")) }));

/** POST /api/ads/products  { name, description?, benefits?, audience?, price?, link?, imageIds?, brandKitId? } */
export const POST = route(async ({ req, user }) => ({ product: saveProduct(user.id, await readJson(req)) }));
