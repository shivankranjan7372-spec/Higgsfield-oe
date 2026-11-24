import { apiRoute } from "@/server/developer/api";
import { findModel, modelDetail } from "@/server/developer/service";

/** GET /api/v1/models/:id  The model's controls and media slots. */
export const GET = apiRoute<{ id: string }>("getModel", ({ params }) => ({ model: modelDetail(findModel(params.id)) }));
