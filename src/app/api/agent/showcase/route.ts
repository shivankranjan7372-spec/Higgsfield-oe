import { publicRoute } from "@/server/http";
import { SHOWCASE } from "@/server/agent/library";

/** GET /api/agent/showcase  Example prompts for the home screen. Works signed out. */
export const GET = publicRoute(() => ({ items: SHOWCASE, categories: ["All", ...new Set(SHOWCASE.map((s) => s.category))] }));
