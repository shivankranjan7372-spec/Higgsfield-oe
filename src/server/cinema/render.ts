import "server-only";

import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { assetById, assetFile, saveAsset, toAsset } from "@/server/assets";
import { ApiError } from "@/server/errors";
import { hasFfmpeg } from "@/server/media";
import { storyboard } from "./storyboard";

/**
 * Joins the selected video take of every shot, in storyboard order, into one MP4.
 * Clips are scaled and padded to the project's frame so mixed sizes join cleanly.
 * Sound is left out: not every clip has an audio track, and the concat filter needs
 * the same streams in every input.
 */

const LONG_SIDE = 1280;

function frameSize(aspect: string): { w: number; h: number } {
  const [a, b] = aspect.split(":").map(Number);
  const ratio = a > 0 && b > 0 ? a / b : 16 / 9;
  const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);
  return ratio >= 1 ? { w: LONG_SIDE, h: even(LONG_SIDE / ratio) } : { w: even(LONG_SIDE * ratio), h: LONG_SIDE };
}

function ffmpeg(args: string[]): Promise<boolean> {
  return new Promise((resolve) => execFile("ffmpeg", args, { timeout: 300_000, maxBuffer: 4_000_000 }, (err) => resolve(!err)));
}

export async function renderProject(userId: string, projectId: string) {
  const board = storyboard(userId, projectId);
  if (!(await hasFfmpeg())) {
    throw new ApiError(501, "render_unavailable", "Joining clips is not available on this server. Download the selected takes one by one instead.");
  }
  const shots = board.scenes.flatMap((s) => s.shots);
  const clips = shots
    .map((s) => (s.selectedTake?.output === "video" && s.selectedTake.asset ? assetById(s.selectedTake.asset.id) : undefined))
    .filter((a): a is NonNullable<typeof a> => !!a && a.user_id === userId);
  if (clips.length === 0) throw new ApiError(409, "nothing_to_render", "No shot has a finished video take yet. Animate a still first.");

  const { w, h } = frameSize(board.project.aspect);
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "parallax-cut-"));
  const out = path.join(dir, "cut.mp4");
  try {
    const inputs = clips.flatMap((c) => ["-i", assetFile(c)]);
    const scaled = clips.map((_, i) => `[${i}:v]scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=24,format=yuv420p[v${i}]`);
    const filter = `${scaled.join(";")};${clips.map((_, i) => `[v${i}]`).join("")}concat=n=${clips.length}:v=1:a=0[out]`;
    const ok = await ffmpeg(["-y", "-v", "error", ...inputs, "-filter_complex", filter, "-map", "[out]", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-movflags", "+faststart", out]);
    if (!ok || !fs.existsSync(out)) throw new ApiError(500, "render_failed", "The clips could not be joined. Try again, or pick other takes.");
    const bytes = await fs.promises.readFile(out);
    const row = await saveAsset({
      userId,
      bytes,
      source: "generated",
      accept: ["video"],
      title: `${board.project.title} (cut)`,
      params: { cinemaProjectId: projectId, shots: clips.length },
    });
    return { asset: toAsset(row), shotsUsed: clips.length, shotsSkipped: shots.length - clips.length };
  } finally {
    fs.promises.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
