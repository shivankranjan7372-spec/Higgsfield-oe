import { publicRoute } from "@/server/http";
import { postedModels } from "@/server/community/posts";

/** GET /api/explore/models  Models that have public posts, for the model filter. */
export const GET = publicRoute(() => ({ models: postedModels() }));
