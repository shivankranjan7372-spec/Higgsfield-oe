import { listAssets, saveAsset, toAsset, UPLOAD_LIMIT } from "@/server/assets";
import { ApiError, badRequest, intParam, route } from "@/server/http";

const KINDS = ["image", "video", "audio"] as const;
const SOURCES = ["generated", "upload"] as const;
const LARGEST = Math.max(...Object.values(UPLOAD_LIMIT));

/** GET /api/assets?kind=&source=&favorite=1&folder=<id>|none&job=&limit=&before= */
export const GET = route(({ req, user }) => {
  const q = req.nextUrl.searchParams;
  const folder = q.get("folder");
  const assets = listAssets(user.id, {
    kind: KINDS.find((k) => k === q.get("kind")),
    source: SOURCES.find((s) => s === q.get("source")),
    favorite: q.get("favorite") === "1",
    folderId: folder === "none" ? null : (folder ?? undefined),
    jobId: q.get("job") ?? undefined,
    limit: intParam(req, "limit", 60, 1, 200),
    before: intParam(req, "before", 0, 0, Number.MAX_SAFE_INTEGER) || undefined,
  });
  return { assets: assets.map(toAsset) };
});

/**
 * POST /api/assets  (multipart form: `file`, optional `accept=image,video`)
 * Uploads reference media. The type is read from the bytes, never from the name.
 */
export const POST = route(async ({ req, user }) => {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > LARGEST + 1_000_000) throw new ApiError(413, "invalid_request", "That file is too large.");
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw badRequest("Send the file as multipart form data.");
  }
  const file = form.get("file");
  if (!(file instanceof File)) throw badRequest("Attach a file.");
  if (file.size > LARGEST) throw new ApiError(413, "invalid_request", "That file is too large.");
  const accept = String(form.get("accept") ?? "")
    .split(",")
    .map((part) => KINDS.find((k) => k === part.trim()))
    .filter((k) => k !== undefined);
  const row = await saveAsset({
    userId: user.id,
    bytes: Buffer.from(await file.arrayBuffer()),
    source: "upload",
    accept: accept.length > 0 ? accept : undefined,
    title: file.name,
  });
  return { asset: toAsset(row) };
});
