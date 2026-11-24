import { route } from "@/server/http";
import { listMemories } from "@/server/agent/library";

/** GET /api/agent/memory  What the assistant remembers about the member, newest first. */
export const GET = route(({ user }) => ({ memories: listMemories(user.id) }));
