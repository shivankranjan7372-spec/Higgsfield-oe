import { catalog } from "@/server/cinema/catalog";
import { publicRoute } from "@/server/http";

/** GET /api/cinema/catalog: presets and models. Works signed out. */
export const GET = publicRoute(() => catalog());
