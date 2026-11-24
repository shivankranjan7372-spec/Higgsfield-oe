import { shotListCsv, storyboard } from "@/server/cinema/storyboard";
import { badRequest, route } from "@/server/http";

/** GET /api/cinema/projects/:id/export?format=json|csv  Downloads the project or the shot list. */
export const GET = route<{ id: string }>(({ req, user, params }) => {
  const format = req.nextUrl.searchParams.get("format") ?? "json";
  if (format === "csv") {
    const { name, csv } = shotListCsv(user.id, params.id);
    return new Response(csv, {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}-shots.csv"`, "X-Content-Type-Options": "nosniff" },
    });
  }
  if (format !== "json") throw badRequest("Format must be json or csv.");
  const board = storyboard(user.id, params.id);
  const name = board.project.title.replace(/[^A-Za-z0-9 _-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "project";
  return new Response(JSON.stringify({ format: "parallax-cinema", version: 1, exportedAt: Date.now(), ...board }, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="${name}.json"` },
  });
});
