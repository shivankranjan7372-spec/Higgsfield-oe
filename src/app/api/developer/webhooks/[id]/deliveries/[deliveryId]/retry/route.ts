import { route } from "@/server/http";
import { retryDelivery } from "@/server/developer/webhooks";

/** POST /api/developer/webhooks/:id/deliveries/:deliveryId/retry  Queues a delivered or failed delivery again. */
export const POST = route<{ id: string; deliveryId: string }>(({ user, params }) => ({ delivery: retryDelivery(user.id, params.id, params.deliveryId) }));
