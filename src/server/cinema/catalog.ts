import "server-only";

import { models, type ModelDef } from "@/registry";
import { CATALOG } from "./presets";
import { DEFAULT_STILL_MODEL, DEFAULT_VIDEO_MODEL } from "./store";
import { canAnimate, canTextToVideo, isStillModel } from "./validate";

function brief(m: ModelDef) {
  const aspect = m.controls.find((c) => c.id === "aspect");
  return {
    id: m.id,
    name: m.name,
    vendor: m.vendor,
    tagline: m.tagline,
    aspects: aspect && aspect.type === "select" ? aspect.options.map((o) => o.value) : [],
    refSlots: m.slots.find((s) => s.id === "refs")?.max ?? 0,
    canAnimate: canAnimate(m),
    canTextToVideo: canTextToVideo(m),
  };
}

/** Presets and the models a project may use. The same for everyone. */
export function catalog() {
  return {
    presets: CATALOG,
    models: {
      still: models.filter(isStillModel).map(brief),
      video: models.filter((m) => canAnimate(m) || canTextToVideo(m)).map(brief),
    },
    defaults: { stillModelId: DEFAULT_STILL_MODEL, videoModelId: DEFAULT_VIDEO_MODEL, aspect: "16:9", shotDuration: 5 },
  };
}
