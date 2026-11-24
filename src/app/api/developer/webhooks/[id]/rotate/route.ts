import { route } from "@/server/http";
import { rotateSecret } from "@/server/developer/webhooks";

/** POST /api/developer/webhooks/:id/rotate  A new signing secret, shown this once. The old one stops working at once. */
export const POST = route<{ id: string }>(({ user, params }) => rotateSecret(user.id, params.id));
