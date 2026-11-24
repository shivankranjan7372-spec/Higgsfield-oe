import { publicRoute } from "@/server/http";
import { recreate } from "@/server/community/posts";

/** GET /api/community/posts/:id/recreate  `{ modelId, prompt, values, droppedInputs }`, ready for POST /api/jobs. */
export const GET = publicRoute<{ id: string }>(({ user, params }) => recreate(user, params.id) as unknown as Record<string, unknown>);
