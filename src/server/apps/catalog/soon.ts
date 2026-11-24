/**
 * Tools that need a kind of model Parallax does not run yet (video in, masks, face identity,
 * upscalers). They are listed so screens can show them greyed out. They cannot run.
 */
import type { AppDef } from "../types";
import { app, input } from "./helpers";

const NOTE_VIDEO = "Needs a video-editing model. Coming with the video tools.";

function soon(id: string, name: string, category: AppDef["category"], pitch: string, tags: string[], note: string, result: AppDef["result"] = "image", inputs = [input("file", result === "video" ? "Video" : "Photo", "file")]): AppDef {
  return app({ id, name, category, pitch, tags, modelId: null, status: "soon", note, template: "", result, inputs });
}

export const soonApps: AppDef[] = [
  soon("upscale", "Upscale", "image-tool", "Sharpen and enlarge a picture up to 4x.", ["upscale", "enhance"], "Needs an upscaling model."),
  soon("remove-background", "Remove background", "image-tool", "Cut the subject out onto a transparent background.", ["background", "cutout"], "Needs a background-removal model."),
  soon("face-swap", "Face swap", "image-tool", "Put one face onto another photo.", ["face", "swap"], "Needs a face-identity model."),
  soon("inpaint", "Paint to edit", "image-tool", "Brush over an area and describe what goes there.", ["mask", "edit"], "Needs a model that takes a mask."),
  soon("layers", "Split into layers", "image-tool", "Separate a picture into editable layers.", ["layers", "edit"], "Needs a layer-decomposition model."),
  soon("video-upscale", "Video upscale", "video-tool", "Make a clip sharper and larger.", ["upscale", "video"], NOTE_VIDEO, "video"),
  soon("video-extend", "Extend a clip", "video-tool", "Continue a clip past its last frame.", ["extend", "video"], NOTE_VIDEO, "video"),
  soon("video-face-swap", "Video face swap", "video-tool", "Replace a face across a whole clip.", ["face", "swap", "video"], NOTE_VIDEO, "video"),
  soon("lip-sync", "Lip sync", "video-tool", "Match a person's lips to new audio.", ["voice", "talking"], "Needs a lip-sync model.", "video"),
  soon("motion-transfer", "Motion transfer", "video-tool", "Copy the moves from one video onto your character.", ["motion", "dance"], NOTE_VIDEO, "video"),
  soon("video-background", "Video background removal", "video-tool", "Cut a moving subject out of its background.", ["background", "video"], NOTE_VIDEO, "video"),
  soon("reframe", "Change aspect ratio", "video-tool", "Change a clip's shape, keeping the action in frame.", ["aspect", "video"], NOTE_VIDEO, "video"),
  soon("fps-boost", "Smooth motion", "video-tool", "Raise a clip's frame rate for smoother motion.", ["frame rate", "video"], NOTE_VIDEO, "video"),
];
