import { publicRoute } from "@/server/http";
import { readApp } from "@/server/apps/service";

/** GET /api/apps/:id  One app with its form and the price of its defaults. */
export const GET = publicRoute<{ id: string }>(({ user, params }) => readApp(user?.id ?? null, params.id));
