/** Video tools: a still (or two) in, a short clip out. */
import type { AppDef } from "../types";
import { app, choice, input, still, text } from "./helpers";

/** Cheap, quick models with start and end frames. Durations are fixed short so a run stays affordable. */
const FRAMES = "veo-3.1-lite";
const ANIMATE = "hailuo-2.3-fast";
const DRAFT = "seedance-1-lite";

export const videoApps: AppDef[] = [
  app({
    id: "animate-photo", name: "Bring a photo to life", category: "video-tool", badge: "trending",
    pitch: "Gentle, natural motion from a single still.",
    tags: ["animate", "photo", "motion"], modelId: ANIMATE, values: { duration: "6", resolution: "768P", enhance: true },
    inputs: [still("Photo")],
    fields: [text("motion", "What moves", { placeholder: "Her hair in the wind, waves behind", maxLength: 200 })],
    template: "Bring the photo to life with subtle, natural motion and a steady camera. {{?motion}}{{motion}}.{{/motion}}",
  }),
  app({
    id: "camera-move", name: "Camera move", category: "video-tool",
    pitch: "Add a cinematic camera move to a still image.",
    tags: ["camera", "cinematic", "motion"], modelId: FRAMES, open: ["aspect"], values: { aspect: "16:9", duration: "4", resolution: "720p", audio: false },
    inputs: [still()],
    fields: [choice("move", "Move", [
      { value: "dolly-in", label: "Dolly in", prompt: "a slow dolly in towards the subject" },
      { value: "dolly-out", label: "Pull back", prompt: "a slow pull back revealing more of the scene" },
      { value: "orbit", label: "Orbit", prompt: "a smooth half orbit around the subject" },
      { value: "crane-up", label: "Crane up", prompt: "a crane move rising up and over the scene" },
      { value: "pan-left", label: "Pan left", prompt: "a slow pan to the left" },
      { value: "pan-right", label: "Pan right", prompt: "a slow pan to the right" },
      { value: "handheld", label: "Handheld", prompt: "a handheld drift with light natural shake" },
      { value: "whip", label: "Whip pan", prompt: "a fast whip pan with motion blur" },
      { value: "rack", label: "Focus pull", prompt: "a rack focus from foreground to the subject" },
      { value: "fpv", label: "Drone dive", prompt: "an FPV drone dive through the scene" },
    ])],
    template: "Starting from the image, the camera performs {{move}}. The scene itself stays mostly still and true to the image.",
  }),
  app({
    id: "frame-to-frame", name: "Frame to frame", category: "video-tool",
    pitch: "Animate the journey between a first and a last frame.",
    tags: ["transition", "keyframes", "morph"], modelId: FRAMES, open: ["aspect"], values: { aspect: "16:9", duration: "4", resolution: "720p", audio: false },
    inputs: [input("first", "First frame", "start"), input("last", "Last frame", "end")],
    fields: [text("how", "How it gets there", { placeholder: "The flower blooms as the camera rises", maxLength: 240 })],
    template: "A smooth, continuous shot that starts on the first frame and ends exactly on the last frame. {{?how}}{{how}}.{{/how}}",
  }),
  app({
    id: "product-spin", name: "Product turntable", category: "video-tool",
    pitch: "A clean 360 spin of your product.",
    tags: ["product", "ads", "ecommerce"], modelId: ANIMATE, values: { duration: "6", resolution: "768P", enhance: false },
    inputs: [still("Product photo")],
    fields: [choice("backdrop", "Backdrop", [
      { value: "keep-as-is", label: "Keep as is", prompt: "the one from the photo" },
      { value: "white-studio", label: "White studio", prompt: "plain white studio" },
      { value: "black-studio", label: "Black studio", prompt: "plain black studio" },
      { value: "soft-gradient", label: "Soft gradient", prompt: "a soft colour gradient" },
    ])],
    template: "The product turns slowly through a full 360-degree rotation on a turntable, studio lighting, backdrop: {{backdrop}}. Keep the product's shape and label exact.",
  }),
  app({
    id: "talking-photo", name: "Talking photo", category: "video-tool",
    pitch: "A portrait that speaks your script.",
    tags: ["avatar", "talking", "voice"], modelId: "heygen-avatar-iv", open: ["aspect"], values: { aspect: "9:16", duration: 5, resolution: "720p" },
    inputs: [input("portrait", "Portrait", "portrait", { hint: "One face, looking at the camera." }), input("voice", "Your voice", "voice", { min: 0, hint: "Optional. Lip-sync to this recording instead." })],
    fields: [text("script", "Script", { required: true, placeholder: "Hi! Here is what's new this week...", maxLength: 600 })],
    template: "{{script}}",
  }),
  app({
    id: "reveal", name: "Big reveal", category: "video-tool",
    pitch: "Start close on a detail and pull back to reveal the whole scene.",
    tags: ["camera", "reveal", "cinematic"], modelId: ANIMATE, values: { duration: "6", resolution: "768P", enhance: true },
    inputs: [still()],
    fields: [text("world", "What is revealed", { placeholder: "A vast city in the clouds", maxLength: 200 })],
    template: "Start in a tight close-up of the image and pull the camera far back in one continuous move to reveal the wider world around it{{?world}}: {{world}}{{/world}}.",
  }),
  app({
    id: "time-lapse", name: "Time-lapse", category: "video-tool",
    pitch: "Watch hours or seasons pass over a still scene.",
    tags: ["time", "sky", "landscape"], modelId: ANIMATE, values: { duration: "6", resolution: "768P", enhance: true },
    inputs: [still()],
    fields: [choice("span", "Time passing", [
      { value: "day", label: "Day to night", prompt: "a day turning into night, clouds racing, lights coming on" },
      { value: "clouds", label: "Clouds", prompt: "fast clouds and shifting shadows" },
      { value: "seasons", label: "Seasons", prompt: "the seasons passing from summer to winter" },
      { value: "stars", label: "Star trails", prompt: "a night sky with turning stars" },
    ])],
    template: "A locked-off time-lapse of the scene in the image showing {{span}}.",
  }),
  app({
    id: "weather", name: "Weather change", category: "video-tool",
    pitch: "Make it rain, snow or storm in your picture.",
    tags: ["weather", "atmosphere", "motion"], modelId: ANIMATE, values: { duration: "6", resolution: "768P", enhance: true },
    inputs: [still()],
    fields: [choice("weather", "Weather", ["Rain", "Snow", "Thunderstorm", "Fog rolling in", "Falling leaves"])],
    template: "The scene from the image comes alive as {{weather}} begins, with realistic motion. The camera stays steady.",
  }),
  app({
    id: "aerial", name: "Aerial flyover", category: "video-tool",
    pitch: "Fly a drone over a landscape photo.",
    tags: ["drone", "landscape", "camera"], modelId: DRAFT, open: ["aspect"], values: { aspect: "16:9", duration: 5, resolution: "720p" },
    inputs: [still("Landscape")],
    template: "A smooth aerial drone flyover moving forward over the landscape in the image, gentle altitude change, cinematic.",
  }),
  app({
    id: "product-ad", name: "Product ad", category: "video-tool", badge: "new", added: "2026-11-08",
    pitch: "A short, punchy ad shot from one product photo.",
    tags: ["product", "ads", "marketing"], modelId: ANIMATE, values: { duration: "6", resolution: "768P", enhance: true },
    inputs: [still("Product photo")],
    fields: [
      choice("energy", "Energy", ["Calm and premium", "Bold and fast", "Playful"]),
      text("idea", "Idea", { placeholder: "Ice cubes falling around the bottle", maxLength: 200 }),
    ],
    template: "A commercial shot of the product in the image, {{energy}} pacing, dynamic lighting. {{?idea}}{{idea}}.{{/idea}} The product stays sharp and true to the photo.",
  }),
  app({
    id: "cinemagraph", name: "Cinemagraph", category: "video-tool",
    pitch: "Only one thing moves; everything else stays frozen.",
    tags: ["loop", "subtle", "photo"], modelId: DRAFT, open: ["aspect"], values: { aspect: "16:9", duration: 5, resolution: "720p" },
    inputs: [still()],
    fields: [text("moving", "What moves", { required: true, placeholder: "Steam rising from the cup", maxLength: 160 })],
    template: "A cinemagraph: only {{moving}} moves, everything else in the image stays completely still. Locked-off camera.",
  }),
  app({
    id: "story-short", name: "Story short", category: "video-tool",
    pitch: "A short clip from a one-line idea, no picture needed.",
    tags: ["text to video", "story", "idea"], modelId: DRAFT, open: ["aspect"], values: { aspect: "16:9", duration: 5, resolution: "720p" },
    fields: [
      text("idea", "Idea", { required: true, placeholder: "A lighthouse keeper finds a glowing bottle", maxLength: 300 }),
      choice("look", "Look", ["Cinematic film", "Animated feature", "Documentary", "Vintage 8mm"]),
    ],
    template: "{{look}} style. {{idea}}.",
  }),
];
