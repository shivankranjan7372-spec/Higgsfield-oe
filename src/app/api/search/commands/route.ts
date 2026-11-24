import { publicRoute } from "@/server/http";
import { commands } from "@/server/notify";

/** GET /api/search/commands?q=  ->  { commands }. Filtered to what this visitor can use. */
export const GET = publicRoute(({ req, user }) => ({
  commands: commands(!!user, (req.nextUrl.searchParams.get("q") ?? "").slice(0, 100)),
}));
