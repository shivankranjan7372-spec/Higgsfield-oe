/** Image models. Prices come from the Treg catalog and are never written here. */
import { aspect, compact, opt, resolution, select } from "./helpers";
import type { MediaSlot, ModelDef } from "./types";

const PROMPT = { required: true, maxLength: 4000, placeholder: "Describe the image: subject, setting, light, lens, mood." };

function refs(max: number, hint = "Images to edit, combine or borrow a look from."): MediaSlot {
  return { id: "refs", label: "References", hint, accept: ["image"], min: 0, max };
}

/* -------------------------------------------------------------------------- */
/* Google direct: the Gemini image family                                      */
/* -------------------------------------------------------------------------- */

const GEMINI_ASPECTS = ["1:1", "4:5", "3:4", "2:3", "9:16", "5:4", "4:3", "3:2", "16:9", "21:9"];

/** Google's partial-response mask. It drops a multi-megabyte field we never read. */
const GEMINI_FIELDS = "candidates(content(parts(text,inlineData)),finishReason),usageMetadata,modelVersion,responseId,promptFeedback";

interface GeminiImage {
  id: string;
  model: string;
  endpoint: string;
  name: string;
  tagline: string;
  badges?: string[];
  featured?: boolean;
  sizes: string[];
  defaultSize: string;
  maxRefs: number;
  eta: number;
}

function geminiImage(m: GeminiImage): ModelDef {
  return {
    id: m.id,
    kind: "image",
    name: m.name,
    vendor: "Google",
    tagline: m.tagline,
    badges: m.badges,
    featured: m.featured,
    status: "available",
    surfaces: ["image"],
    prompt: PROMPT,
    slots: [refs(m.maxRefs)],
    controls: [
      aspect(GEMINI_ASPECTS, "1:1"),
      resolution(m.sizes.map((s) => opt(s, s === "512" ? "512px" : s)), m.defaultSize, "Size"),
    ],
    batch: { max: 4, native: false },
    output: "image",
    eta: m.eta,
    build({ prompt, values, media }) {
      const parts: unknown[] = [{ text: prompt }];
      for (const ref of media.refs ?? []) parts.push({ fileData: { mimeType: ref.mime, fileUri: ref.url } });
      return {
        endpoint: m.endpoint,
        query: { model: m.model, fields: GEMINI_FIELDS },
        body: {
          contents: [{ parts }],
          generationConfig: {
            responseModalities: ["IMAGE"],
            imageConfig: { imageSize: values.resolution, aspectRatio: values.aspect },
          },
        },
      };
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Replicate: the GPT Image family and FLUX                                    */
/* -------------------------------------------------------------------------- */

const GPT_ASPECTS = ["1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16"];

interface GptImage {
  id: string;
  endpoint: string;
  name: string;
  tagline: string;
  badges?: string[];
  featured?: boolean;
  qualities: string[];
  eta: number;
}

const QUALITY_LABEL: Record<string, string> = { low: "Draft", medium: "Standard", high: "High", xhigh: "Ultra", max: "Max" };

function gptImage(m: GptImage): ModelDef {
  return {
    id: m.id,
    kind: "image",
    name: m.name,
    vendor: "OpenAI",
    tagline: m.tagline,
    badges: m.badges,
    featured: m.featured,
    status: "available",
    surfaces: ["image"],
    prompt: PROMPT,
    slots: [refs(4)],
    controls: [
      aspect(GPT_ASPECTS, "1:1"),
      select("quality", "Quality", m.qualities.map((q) => opt(q, QUALITY_LABEL[q] ?? q)), m.qualities.includes("medium") ? "medium" : m.qualities[0]),
      select("background", "Background", [opt("auto", "Auto"), opt("opaque", "Solid"), opt("transparent", "Transparent")], "auto", { advanced: true }),
    ],
    batch: { max: 4, native: true },
    output: "image",
    eta: m.eta,
    build({ prompt, values, media, count }) {
      const images = (media.refs ?? []).map((r) => r.url);
      return {
        endpoint: m.endpoint,
        body: {
          input: compact({
            prompt,
            quality: values.quality,
            aspect_ratio: values.aspect,
            number_of_images: count,
            output_format: "png",
            background: values.background,
            input_images: images.length ? images : undefined,
          }),
        },
      };
    },
  };
}

const fluxSchnell: ModelDef = {
  id: "flux-schnell",
  kind: "image",
  name: "FLUX Schnell",
  vendor: "Black Forest Labs",
  tagline: "Near-instant images for a fraction of a credit.",
  badges: ["Fast", "Budget"],
  status: "available",
  surfaces: ["image"],
  prompt: PROMPT,
  slots: [],
  controls: [aspect(["1:1", "4:5", "3:4", "2:3", "9:16", "5:4", "4:3", "3:2", "16:9", "21:9"], "1:1")],
  batch: { max: 4, native: true },
  output: "image",
  eta: 4,
  build({ prompt, values, count }) {
    return {
      endpoint: "replicate.image-gen.flux-schnell",
      body: { input: { prompt, num_outputs: count, aspect_ratio: values.aspect, output_format: "webp" } },
    };
  },
};

/* -------------------------------------------------------------------------- */
/* MiniMax direct                                                              */
/* -------------------------------------------------------------------------- */

const minimaxImage: ModelDef = {
  id: "minimax-image-01",
  kind: "image",
  name: "Image-01",
  vendor: "MiniMax",
  tagline: "Clean, low-cost stills in eight frame shapes.",
  badges: ["Budget"],
  status: "available",
  surfaces: ["image"],
  prompt: { ...PROMPT, maxLength: 1500 },
  slots: [],
  controls: [aspect(["1:1", "3:4", "2:3", "9:16", "4:3", "3:2", "16:9", "21:9"], "1:1")],
  batch: { max: 4, native: true },
  output: "image",
  eta: 15,
  build({ prompt, values, count }) {
    return {
      endpoint: "minimax.image-gen.from_text",
      body: { model: "image-01", prompt, aspect_ratio: values.aspect, response_format: "url", n: count },
    };
  },
};

export const imageModels: ModelDef[] = [
  geminiImage({
    id: "nano-banana-pro", model: "gemini-3-pro-image", endpoint: "google-ai.image-gen.gemini-3-pro-image",
    name: "Nano Banana Pro", tagline: "Studio-grade stills with accurate text, up to 4K.",
    badges: ["4K", "Text"], featured: true, sizes: ["1K", "2K", "4K"], defaultSize: "2K", maxRefs: 8, eta: 35,
  }),
  geminiImage({
    id: "nano-banana-2", model: "gemini-3.1-flash-image", endpoint: "google-ai.image-gen.gemini-3-1-flash-image",
    name: "Nano Banana 2", tagline: "Fast edits and consistent characters from references.",
    badges: ["4K", "Edit"], featured: true, sizes: ["512", "1K", "2K", "4K"], defaultSize: "1K", maxRefs: 6, eta: 18,
  }),
  gptImage({
    id: "gpt-image-2.5-sunburst", endpoint: "replicate.image-gen.gpt-image-2-5-sunburst",
    name: "GPT Image 2.5 Sunburst", tagline: "The richest GPT Image, strong on layout and lettering.",
    badges: ["Text"], featured: true, qualities: ["low", "medium", "high", "xhigh", "max"], eta: 60,
  }),
  gptImage({
    id: "gpt-image-2.5-flare", endpoint: "replicate.image-gen.gpt-image-2-5-flare",
    name: "GPT Image 2.5 Flare", tagline: "GPT Image 2.5 tuned for speed.",
    qualities: ["low", "medium", "high", "xhigh", "max"], eta: 40,
  }),
  gptImage({
    id: "gpt-image-2", endpoint: "replicate.image-gen.gpt-image-2",
    name: "GPT Image 2", tagline: "The previous GPT Image, dependable for edits.",
    qualities: ["low", "medium", "high"], eta: 45,
  }),
  geminiImage({
    id: "nano-banana-2-lite", model: "gemini-3.1-flash-lite-image", endpoint: "google-ai.image-gen.gemini-3-1-flash-lite-image",
    name: "Nano Banana 2 Lite", tagline: "The lightest Gemini image model, for quick ideas.",
    badges: ["Budget"], sizes: ["1K"], defaultSize: "1K", maxRefs: 3, eta: 12,
  }),
  fluxSchnell,
  minimaxImage,
];
