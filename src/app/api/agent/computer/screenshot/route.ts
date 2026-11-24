import { notFound, route } from "@/server/http";
import { latestScreenshot } from "@/server/agent/computer";

/** GET /api/agent/computer/screenshot  The latest screenshot as PNG, or 404 before the first one. */
export const GET = route(({ user }) => {
  const png = latestScreenshot(user.id);
  if (!png) throw notFound("There is no screenshot yet.");
  return new Response(new Uint8Array(png), {
    headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=0, must-revalidate", "X-Content-Type-Options": "nosniff" },
  });
});
