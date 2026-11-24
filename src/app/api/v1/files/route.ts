import { NextResponse } from "next/server";
import { apiRoute } from "@/server/developer/api";
import { LARGEST_UPLOAD, listFiles, uploadFile } from "@/server/developer/service";
import { ApiError, badRequest, intParam } from "@/server/http";

/** GET /api/v1/files?kind=&source=&limit=&before= */
export const GET = apiRoute("listFiles", ({ req, user }) => {
  const q = req.nextUrl.searchParams;
  return {
    files: listFiles(user.id, {
      kind: q.get("kind"),
      source: q.get("source"),
      limit: intParam(req, "limit", 50, 1, 200),
      before: intParam(req, "before", 0, 0, Number.MAX_SAFE_INTEGER) || undefined,
    }),
  };
});

/** POST /api/v1/files  (multipart form, field `file`). The type is read from the bytes. */
export const POST = apiRoute("uploadFile", async ({ req, user }) => {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > LARGEST_UPLOAD + 1_000_000) throw new ApiError(413, "invalid_request", "That file is too large.");
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw badRequest("Send the file as multipart form data.");
  }
  const file = form.get("file");
  if (!(file instanceof File)) throw badRequest("Attach a file in the field named file.");
  return NextResponse.json({ file: await uploadFile(user.id, file) }, { status: 201 });
});
