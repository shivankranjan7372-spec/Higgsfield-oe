/**
 * Video models. Capabilities (lengths, sizes, frames, sound) come from each provider's
 * live capability list; prices come from the Treg catalog and are never written here.
 */
import { aspect, audio, compact, duration, opt, resolution, toggle } from "./helpers";
import type { BuildContext, Control, MediaSlot, ModelDef } from "./types";

const PROMPT = { required: true, maxLength: 2500, placeholder: "Describe the shot: subject, action, camera, light." };

const START: MediaSlot = { id: "start", label: "Start frame", hint: "The first frame of the shot.", accept: ["image"], min: 0, max: 1 };
const END: MediaSlot = { id: "end", label: "End frame", hint: "The shot lands on this image.", accept: ["image"], min: 0, max: 1 };

/* -------------------------------------------------------------------------- */
/* OpenRouter video: one request shape for many labs                           */
/* -------------------------------------------------------------------------- */

interface RouterVideo {
  id: string;
  /** The provider's model slug, sent as `model`. Price rows match on it. */
  slug: string;
  /** Treg endpoint id, or a pair when text and image starts are priced as separate endpoints. */
  endpoint: string | { text: string; image: string };
  name: string;
  vendor: string;
  tagline: string;
  badges?: string[];
  featured?: boolean;
  durations: number[] | { min: number; max: number };
  defaultDuration: number;
  resolutions: string[];
  defaultResolution: string;
  aspects: string[];
  frames: "both" | "first" | "none";
  /** Whether the model can make sound, and so takes a `generate_audio` flag. */
  sound: boolean;
  eta: number;
  status?: ModelDef["status"];
  statusNote?: string;
}

function routerVideo(m: RouterVideo): ModelDef {
  const controls: Control[] = [
    aspect(m.aspects),
    duration(m.durations, m.defaultDuration),
    resolution(m.resolutions, m.defaultResolution),
  ];
  if (m.sound) controls.push(audio(true));

  return {
    id: m.id,
    kind: "video",
    name: m.name,
    vendor: m.vendor,
    tagline: m.tagline,
    badges: m.badges,
    featured: m.featured,
    status: m.status ?? "available",
    statusNote: m.statusNote,
    surfaces: ["video"],
    prompt: PROMPT,
    slots: m.frames === "both" ? [START, END] : m.frames === "first" ? [START] : [],
    controls,
    batch: { max: 4, native: false },
    output: "video",
    eta: m.eta,
    build({ prompt, values, media }: BuildContext) {
      const frames: unknown[] = [];
      const first = media.start?.[0];
      const last = media.end?.[0];
      if (first) frames.push({ type: "image_url", image_url: { url: first.url }, frame_type: "first_frame" });
      if (last) frames.push({ type: "image_url", image_url: { url: last.url }, frame_type: "last_frame" });
      const endpoint = typeof m.endpoint === "string" ? m.endpoint : first ? m.endpoint.image : m.endpoint.text;
      return {
        endpoint,
        body: compact({
          model: m.slug,
          prompt,
          duration: Number(values.duration),
          resolution: values.resolution,
          aspect_ratio: values.aspect,
          generate_audio: m.sound ? Boolean(values.audio) : undefined,
          frame_images: frames.length ? frames : undefined,
        }),
      };
    },
  };
}

const WIDE_TALL = ["16:9", "9:16"];
const WIDE_TALL_SQUARE = ["16:9", "9:16", "1:1"];
const FIVE = ["16:9", "9:16", "1:1", "4:3", "3:4"];

const routerModels: ModelDef[] = [
  routerVideo({
    id: "veo-3.1", slug: "google/veo-3.1", endpoint: "openrouter.x.google-veo-3-1",
    name: "Veo 3.1", vendor: "Google", tagline: "Flagship realism with native sound, up to 4K.",
    badges: ["4K", "Sound"], featured: true,
    durations: [4, 6, 8], defaultDuration: 8, resolutions: ["720p", "1080p", "4K"], defaultResolution: "1080p",
    aspects: WIDE_TALL, frames: "both", sound: true, eta: 150,
  }),
  routerVideo({
    id: "veo-3.1-fast", slug: "google/veo-3.1-fast", endpoint: "openrouter.x.google-veo-3-1-fast",
    name: "Veo 3.1 Fast", vendor: "Google", tagline: "Most of Veo's look at a fraction of the price.",
    badges: ["4K", "Sound"],
    durations: [4, 6, 8], defaultDuration: 8, resolutions: ["720p", "1080p", "4K"], defaultResolution: "720p",
    aspects: WIDE_TALL, frames: "both", sound: true, eta: 90,
  }),
  routerVideo({
    id: "veo-3.1-lite", slug: "google/veo-3.1-lite", endpoint: "openrouter.x.google-veo-3-1-lite",
    name: "Veo 3.1 Lite", vendor: "Google", tagline: "The cheapest way to draft a shot with sound.",
    badges: ["Budget", "Sound"],
    durations: [4, 6, 8], defaultDuration: 4, resolutions: ["720p", "1080p"], defaultResolution: "720p",
    aspects: WIDE_TALL, frames: "both", sound: true, eta: 70,
  }),
  routerVideo({
    id: "seedance-2.5", slug: "bytedance/seedance-2.5", endpoint: "openrouter.video-gen.seedance-2-5",
    name: "Seedance 2.5", vendor: "ByteDance", tagline: "Long, coherent takes up to 30 seconds with sound.",
    badges: ["30s", "Sound"], featured: true,
    durations: { min: 4, max: 30 }, defaultDuration: 5, resolutions: ["480p", "720p"], defaultResolution: "720p",
    aspects: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"], frames: "both", sound: true, eta: 120,
  }),
  routerVideo({
    id: "kling-3-pro", slug: "kwaivgi/kling-v3.0-pro", endpoint: "openrouter.x.kwaivgi-kling-v3-0-pro",
    name: "Kling 3.0 Pro", vendor: "Kuaishou", tagline: "Strong motion and character acting, with sound.",
    badges: ["Sound"], featured: true,
    durations: { min: 3, max: 15 }, defaultDuration: 5, resolutions: ["720p"], defaultResolution: "720p",
    aspects: WIDE_TALL_SQUARE, frames: "both", sound: true, eta: 150,
  }),
  routerVideo({
    id: "kling-3-std", slug: "kwaivgi/kling-v3.0-std", endpoint: "openrouter.x.kwaivgi-kling-v3-0-std",
    name: "Kling 3.0 Standard", vendor: "Kuaishou", tagline: "Kling motion at a lower price.",
    badges: ["Sound"],
    durations: { min: 3, max: 15 }, defaultDuration: 5, resolutions: ["720p"], defaultResolution: "720p",
    aspects: WIDE_TALL_SQUARE, frames: "both", sound: true, eta: 120,
  }),
  routerVideo({
    id: "kling-o1", slug: "kwaivgi/kling-video-o1", endpoint: "openrouter.x.kwaivgi-kling-video-o1",
    name: "Kling O1", vendor: "Kuaishou", tagline: "Reasoning-led shots that follow complex direction.",
    durations: [5, 10], defaultDuration: 5, resolutions: ["720p"], defaultResolution: "720p",
    aspects: WIDE_TALL_SQUARE, frames: "both", sound: true, eta: 150,
  }),
  routerVideo({
    id: "wan-3", slug: "alibaba/wan-3.0",
    endpoint: { text: "openrouter.video-gen.wan-3-0.from_text", image: "openrouter.video-gen.wan-3-0.from_image" },
    name: "Wan 3.0", vendor: "Alibaba", tagline: "Flexible lengths from 2 to 30 seconds, up to 1080p.",
    badges: ["30s", "Sound"],
    durations: { min: 2, max: 30 }, defaultDuration: 5, resolutions: ["480p", "720p", "1080p"], defaultResolution: "720p",
    aspects: FIVE, frames: "both", sound: true, eta: 120,
  }),
  routerVideo({
    id: "wan-3-prime", slug: "alibaba/wan-3.0-prime", endpoint: "openrouter.x.alibaba-wan-3-0-prime",
    name: "Wan 3.0 Prime", vendor: "Alibaba", tagline: "The higher-fidelity Wan 3.0.",
    badges: ["30s", "Sound"],
    durations: { min: 2, max: 30 }, defaultDuration: 5, resolutions: ["480p", "720p", "1080p"], defaultResolution: "720p",
    aspects: FIVE, frames: "both", sound: true, eta: 150,
  }),
  routerVideo({
    id: "wan-2.7", slug: "alibaba/wan-2.7", endpoint: "openrouter.x.alibaba-wan-2-7",
    name: "Wan 2.7", vendor: "Alibaba", tagline: "A dependable all-rounder, one price at any size.",
    badges: ["Sound"],
    durations: { min: 2, max: 10 }, defaultDuration: 5, resolutions: ["720p", "1080p"], defaultResolution: "1080p",
    aspects: FIVE, frames: "both", sound: true, eta: 110,
  }),
  routerVideo({
    id: "wan-2.6", slug: "alibaba/wan-2.6", endpoint: "openrouter.x.alibaba-wan-2-6",
    name: "Wan 2.6", vendor: "Alibaba", tagline: "The earlier Wan, still good for quick drafts.",
    badges: ["Sound"],
    durations: [5, 10], defaultDuration: 5, resolutions: ["720p", "1080p"], defaultResolution: "720p",
    aspects: WIDE_TALL, frames: "first", sound: true, eta: 110,
  }),
  routerVideo({
    id: "happyhorse-1.1", slug: "alibaba/happyhorse-1.1", endpoint: "openrouter.x.alibaba-happyhorse-1-1",
    name: "HappyHorse 1.1", vendor: "Alibaba", tagline: "Stylised, lively motion in seven frame shapes.",
    durations: { min: 3, max: 15 }, defaultDuration: 5, resolutions: ["720p", "1080p"], defaultResolution: "720p",
    aspects: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9", "9:21"], frames: "first", sound: false, eta: 110,
  }),
  routerVideo({
    id: "happyhorse-1.0", slug: "alibaba/happyhorse-1.0", endpoint: "openrouter.x.alibaba-happyhorse-1-0",
    name: "HappyHorse 1.0", vendor: "Alibaba", tagline: "The first HappyHorse.",
    durations: { min: 3, max: 15 }, defaultDuration: 5, resolutions: ["720p", "1080p"], defaultResolution: "720p",
    aspects: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9", "9:21"], frames: "first", sound: false, eta: 110,
  }),
  routerVideo({
    id: "flux-3-video", slug: "black-forest-labs/flux-3-video", endpoint: "openrouter.x.black-forest-labs-flux-3-video",
    name: "FLUX 3 Video", vendor: "Black Forest Labs", tagline: "Photographic detail from the FLUX image family.",
    badges: ["Sound"],
    durations: { min: 5, max: 20 }, defaultDuration: 5, resolutions: ["720p", "1080p"], defaultResolution: "720p",
    aspects: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"], frames: "both", sound: true, eta: 180,
  }),
  routerVideo({
    id: "runway-gen-4.5", slug: "runway/gen-4.5", endpoint: "openrouter.x.runway-gen-4-5",
    name: "Gen-4.5", vendor: "Runway", tagline: "Cinematic, controllable motion from a start frame or text.",
    durations: { min: 2, max: 10 }, defaultDuration: 5, resolutions: ["720p"], defaultResolution: "720p",
    aspects: WIDE_TALL, frames: "first", sound: false, eta: 120,
  }),
  routerVideo({
    id: "runway-aleph-2", slug: "runway/aleph-2", endpoint: "openrouter.x.runway-aleph-2",
    name: "Aleph 2", vendor: "Runway", tagline: "Edits existing footage in place.",
    durations: { min: 2, max: 10 }, defaultDuration: 5, resolutions: ["720p"], defaultResolution: "720p",
    aspects: WIDE_TALL, frames: "none", sound: false, eta: 180,
    status: "soon", statusNote: "A video editing model. It arrives with the video tools.",
  }),
  routerVideo({
    id: "sora-2-pro", slug: "openai/sora-2-pro", endpoint: "openrouter.x.openai-sora-2-pro",
    name: "Sora 2 Pro", vendor: "OpenAI", tagline: "Physically grounded scenes with synced sound.",
    durations: [4, 8, 12], defaultDuration: 8, resolutions: ["720p", "1080p"], defaultResolution: "720p",
    aspects: WIDE_TALL, frames: "first", sound: false, eta: 240,
    status: "offline", statusNote: "The upstream provider is not serving this model right now.",
  }),
];

/* -------------------------------------------------------------------------- */
/* Replicate                                                                   */
/* -------------------------------------------------------------------------- */

const seedance1Lite: ModelDef = {
  id: "seedance-1-lite",
  kind: "video",
  name: "Seedance 1 Lite",
  vendor: "ByteDance",
  tagline: "Very cheap silent drafts, up to 1080p.",
  badges: ["Budget"],
  status: "available",
  surfaces: ["video"],
  prompt: PROMPT,
  slots: [START],
  controls: [aspect(["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"]), duration({ min: 4, max: 12 }, 5), resolution(["480p", "720p", "1080p"], "720p")],
  batch: { max: 4, native: false },
  output: "video",
  eta: 60,
  build({ prompt, values, media }) {
    return {
      endpoint: "replicate.video-gen.seedance-1-lite",
      body: {
        input: compact({
          prompt,
          duration: Number(values.duration),
          resolution: values.resolution,
          aspect_ratio: values.aspect,
          image: media.start?.[0]?.url,
        }),
      },
    };
  },
};

/* -------------------------------------------------------------------------- */
/* MiniMax direct                                                              */
/* -------------------------------------------------------------------------- */

interface Hailuo {
  id: string;
  model: string;
  name: string;
  tagline: string;
  badges?: string[];
  /** Whether the model can start from text alone. */
  text: boolean;
  /** Whether the 512P draft size exists (image starts only). */
  draft: boolean;
}

function hailuo(m: Hailuo): ModelDef {
  const sizes = [
    ...(m.draft ? [opt("512P", "512p", { hint: "Needs a start frame.", when: { "slot:start": "filled" } })] : []),
    opt("768P", "768p"),
    opt("1080P", "1080p", { hint: "6 seconds only.", when: { duration: "6" } }),
  ];
  return {
    id: m.id,
    kind: "video",
    name: m.name,
    vendor: "MiniMax",
    tagline: m.tagline,
    badges: m.badges,
    status: "available",
    surfaces: ["video"],
    prompt: { ...PROMPT, required: m.text },
    slots: [{ ...START, min: m.text ? 0 : 1 }],
    controls: [
      duration([6, 10], 6),
      resolution(sizes, "768P"),
      toggle("enhance", "Enhance prompt", true, { hint: "Let the model rewrite the prompt for a better result.", advanced: true }),
    ],
    batch: { max: 4, native: false },
    output: "video",
    eta: 150,
    build({ prompt, values, media }) {
      const first = media.start?.[0];
      return {
        endpoint: first ? "minimax.video-gen.from_image" : "minimax.video-gen.from_text",
        body: compact({
          model: m.model,
          first_frame_image: first?.url,
          prompt: prompt || undefined,
          duration: Number(values.duration),
          resolution: values.resolution,
          prompt_optimizer: Boolean(values.enhance),
        }),
      };
    },
  };
}

interface H3 {
  id: string;
  model: string;
  name: string;
  tagline: string;
  badges?: string[];
  sizes: string[];
  defaultSize: string;
  minSeconds: number;
}

function h3(m: H3): ModelDef {
  return {
    id: m.id,
    kind: "video",
    name: m.name,
    vendor: "MiniMax",
    tagline: m.tagline,
    badges: m.badges,
    status: "available",
    surfaces: ["video"],
    prompt: { ...PROMPT, maxLength: 7000 },
    slots: [START, { ...END, when: { "slot:start": "filled" } }],
    controls: [
      aspect(
        [
          opt("adaptive", "Match frame", { hint: "Follow the start frame's shape.", when: { "slot:start": "filled" } }),
          "16:9", "9:16", "1:1", "4:3", "3:4", "21:9",
        ],
        "16:9",
      ),
      duration({ min: m.minSeconds, max: 15 }, Math.max(5, m.minSeconds)),
      resolution(m.sizes.map((s) => opt(s, s.replace("P", "p"))), m.defaultSize),
    ],
    batch: { max: 4, native: false },
    output: "video",
    eta: 180,
    build({ prompt, values, media }) {
      const content: unknown[] = [{ type: "text", text: prompt }];
      for (const ref of [media.start?.[0], media.end?.[0]]) {
        if (ref) content.push({ type: "image_url", image_url: { url: ref.url } });
      }
      return {
        endpoint: "minimax.video-gen.h3.generate",
        body: { model: m.model, content, resolution: values.resolution, duration: Number(values.duration), ratio: values.aspect },
      };
    },
  };
}

const minimaxModels: ModelDef[] = [
  h3({ id: "minimax-h3", model: "MiniMax-H3", name: "Hailuo H3", tagline: "MiniMax's newest model, sharp up to 2K.", badges: ["2K"], sizes: ["768P", "2K"], defaultSize: "768P", minSeconds: 4 }),
  h3({ id: "minimax-h3-max", model: "MiniMax-H3-Max", name: "Hailuo H3 Max", tagline: "The most capable Hailuo, tuned for motion and physics.", sizes: ["480P", "768P"], defaultSize: "768P", minSeconds: 5 }),
  hailuo({ id: "hailuo-2.3", model: "MiniMax-Hailuo-2.3", name: "Hailuo 2.3", tagline: "Expressive characters and stylised motion.", text: true, draft: false }),
  hailuo({ id: "hailuo-2.3-fast", model: "MiniMax-Hailuo-2.3-Fast", name: "Hailuo 2.3 Fast", tagline: "Animates a start frame quickly and cheaply.", badges: ["Fast"], text: false, draft: false }),
  hailuo({ id: "hailuo-02", model: "MiniMax-Hailuo-02", name: "Hailuo 02", tagline: "Solid physics, with a low-cost 512p draft size.", badges: ["Budget"], text: true, draft: true }),
];

/* -------------------------------------------------------------------------- */
/* Talking avatar                                                              */
/* -------------------------------------------------------------------------- */

const avatar: ModelDef = {
  id: "heygen-avatar-iv",
  kind: "video",
  name: "Avatar IV",
  vendor: "HeyGen",
  tagline: "Turns one portrait into a talking presenter.",
  badges: ["Lip sync"],
  status: "available",
  surfaces: ["video", "avatar"],
  prompt: { required: true, maxLength: 1500, label: "Script", placeholder: "What should they say?" },
  slots: [
    { id: "portrait", label: "Portrait", hint: "A clear photo of one face.", accept: ["image"], min: 1, max: 1 },
    { id: "voice", label: "Voice track", hint: "Optional. Lip-sync to your own audio instead of the script.", accept: ["audio"], min: 0, max: 1 },
  ],
  controls: [
    aspect(WIDE_TALL_SQUARE, "9:16"),
    { ...duration({ min: 5, max: 30 }, 10, "Max length"), hint: "You pay for the length you set." },
    resolution(["720p", "1080p"], "720p"),
  ],
  batch: { max: 2, native: false },
  output: "video",
  eta: 180,
  build({ prompt, values, media }) {
    const refs: unknown[] = [];
    const face = media.portrait?.[0];
    const track = media.voice?.[0];
    if (face) refs.push({ type: "image_url", image_url: { url: face.url } });
    if (track) refs.push({ type: "audio_url", audio_url: { url: track.url } });
    return {
      endpoint: "openrouter.x.heygen-avatar-iv",
      body: {
        model: "heygen/avatar-iv",
        prompt,
        duration: Number(values.duration),
        resolution: values.resolution,
        aspect_ratio: values.aspect,
        input_references: refs,
      },
    };
  },
};

export const videoModels: ModelDef[] = [...routerModels.slice(0, 7), ...minimaxModels, ...routerModels.slice(7), seedance1Lite, avatar];
