import { badRequest, intParam, publicRoute } from "@/server/http";
import { PERIODS, TABS, listFeed, type Period, type Tab } from "@/server/community/posts";
import { normalizeTag } from "@/server/community/shared";
import { getModel } from "@/registry";

const KINDS = ["image", "video", "audio"] as const;

/**
 * GET /api/explore?tab=trending|new|top|following&period=day|week|month|all&kind=&model=&tag=&limit=&cursor=
 * The public feed. Works signed out, except the `following` tab.
 */
export const GET = publicRoute(({ req, user }) => {
  const q = req.nextUrl.searchParams;
  const tab = (q.get("tab") ?? "trending") as Tab;
  if (!TABS.includes(tab)) throw badRequest("Unknown tab.");
  const period = (q.get("period") ?? "week") as Period;
  if (!PERIODS.includes(period)) throw badRequest("Unknown period.");
  const kind = KINDS.find((k) => k === q.get("kind"));
  if (q.get("kind") && !kind) throw badRequest("Unknown kind.");
  const model = q.get("model");
  if (model && !getModel(model)) throw badRequest("Unknown model.");
  const rawTag = q.get("tag");
  const tag = rawTag ? normalizeTag(rawTag) : null;
  if (rawTag && !tag) throw badRequest("Unknown tag.");
  return listFeed(user, {
    tab,
    period,
    kind,
    modelId: model ?? undefined,
    tag: tag ?? undefined,
    limit: intParam(req, "limit", 24, 1, 60),
    cursor: q.get("cursor"),
  });
});
