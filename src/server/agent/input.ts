import "server-only";

import { badRequest } from "@/server/errors";
import { LLM_MODELS, type Mode } from "./config";
import { bool, idList, text } from "./util";

/** Request-body readers shared by the routes. Every field is checked here. */

export function readMessage(body: Record<string, unknown>) {
  const t = text(body.text, "Message", 20_000);
  const fileIds = idList(body.fileIds, "fileIds", 10);
  if (!t && fileIds.length === 0) throw badRequest("Write a message first.");
  const mode = body.mode == null ? "ask" : body.mode;
  if (mode !== "ask" && mode !== "auto") throw badRequest('mode must be "ask" or "auto".');
  const model = body.model == null ? "auto" : body.model;
  if (typeof model !== "string" || !LLM_MODELS.some((m) => m.id === model)) throw badRequest("Unknown assistant model.");
  return { text: t || "(see attached files)", fileIds, mode: mode as Mode, model };
}

export function readChatPatch(body: Record<string, unknown>) {
  const out: { title?: string; pinned?: boolean; projectId?: string | null; skillIds?: string[] } = {};
  if (body.title !== undefined) out.title = text(body.title, "Title", 80, { required: true });
  if (body.pinned !== undefined) out.pinned = bool(body.pinned, "pinned");
  if (body.projectId !== undefined) {
    if (body.projectId !== null && typeof body.projectId !== "string") throw badRequest("projectId must be an id or null.");
    out.projectId = body.projectId as string | null;
  }
  if (body.skillIds !== undefined) out.skillIds = idList(body.skillIds, "skillIds", 10);
  return out;
}

export function readProject(body: Record<string, unknown>, partial: boolean) {
  return {
    name: body.name === undefined && partial ? undefined : text(body.name, "Name", 80, { required: true }),
    instructions: body.instructions === undefined && partial ? undefined : text(body.instructions, "Instructions", 8_000),
    fileIds: body.fileIds === undefined && partial ? undefined : idList(body.fileIds, "fileIds", 50),
  };
}

export function readSkill(body: Record<string, unknown>, partial: boolean) {
  return {
    name: body.name === undefined && partial ? undefined : text(body.name, "Name", 80, { required: true }),
    description: body.description === undefined && partial ? undefined : text(body.description, "Description", 300),
    instructions: body.instructions === undefined && partial ? undefined : text(body.instructions, "Instructions", 8_000, { required: true }),
  };
}
