import { route } from "@/server/http";
import { setPin } from "@/server/apps/service";

/** PUT /api/apps/:id/pin  Pins the app for this member. Safe to repeat. */
export const PUT = route<{ id: string }>(({ user, params }) => setPin(user.id, params.id, true));

/** DELETE /api/apps/:id/pin  Unpins it. Safe to repeat. */
export const DELETE = route<{ id: string }>(({ user, params }) => setPin(user.id, params.id, false));
