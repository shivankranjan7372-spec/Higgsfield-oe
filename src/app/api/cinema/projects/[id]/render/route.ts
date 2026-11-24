import { renderProject } from "@/server/cinema/render";
import { route } from "@/server/http";

/** POST /api/cinema/projects/:id/render  Joins the selected video takes into one video in the library. */
export const POST = route<{ id: string }>(({ user, params }) => renderProject(user.id, params.id));
