import { batchView, cancelBatch } from "@/server/cinema/batch";
import { route } from "@/server/http";

/** GET /api/cinema/batches/:id  Progress. */
export const GET = route<{ id: string }>(({ user, params }) => ({ batch: batchView(user.id, params.id) }));

/** DELETE /api/cinema/batches/:id  Stops feeding new stills. */
export const DELETE = route<{ id: string }>(({ user, params }) => ({ batch: cancelBatch(user.id, params.id) }));
