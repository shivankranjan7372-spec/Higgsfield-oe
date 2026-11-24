import { getModel, quoteJob, resolveValues, type Filled, type MediaType, type Values } from "@/registry";
import type { BrandData, ProductData } from "./types";

/**
 * The ad format catalog, as data. Each format names the registry model it runs on and
 * the exact control values, so its price is known before anything runs.
 * `checkFormats()` validates every entry the way `submitJobs` would.
 */

/** Where a format's media slot gets its files from. */
export type SlotSource = "product-images" | "presenter" | "speech";

export interface FormatSlot {
  /** Slot id on the registry model. */
  slot: string;
  from: SlotSource;
  /** Most files to put in the slot. */
  max: number;
  /** The format cannot run without it. */
  required: boolean;
}

export interface RecipeContext {
  product: ProductData;
  brand: BrandData | null;
  /** The benefit this variation leads with. */
  benefit: string;
  /** A scene idea picked for this variation from the format's list. */
  scene: string;
  /** Spoken formats: the words to say. */
  script: string;
}

export interface AdFormat {
  id: string;
  name: string;
  description: string;
  /** What the member gets back. `talking` formats return a video of a presenter speaking. */
  output: MediaType;
  group: "image" | "video" | "spoken";
  platform: { label: string; aspect: string | null; seconds: number | null };
  modelId: string;
  values: Values;
  slots: FormatSlot[];
  /** Spoken video formats first turn the script into speech with this model, then lip-sync it. */
  speech?: { modelId: string; values: Values };
  /** Uses the campaign script (or one the copy writer drafts). */
  spoken: boolean;
  /** Scene ideas; variation N uses scene N (wrapping). */
  scenes: string[];
  recipe(c: RecipeContext): string;
}

/* ------------------------------ prompt pieces ------------------------------ */

function brandLook(brand: BrandData | null): string {
  if (!brand) return "";
  const parts: string[] = [];
  if (brand.colors.length) parts.push(`colour palette ${brand.colors.map((c) => `${c.name ? c.name + " " : ""}${c.hex}`).join(", ")}`);
  if (brand.tone) parts.push(`mood: ${brand.tone}`);
  if (brand.fonts.heading) parts.push(`any lettering in a ${brand.fonts.heading}-style typeface`);
  return parts.length ? ` Brand look: ${parts.join("; ")}.` : "";
}

function productLine(p: ProductData): string {
  const what = p.description ? `${p.name}, ${p.description}` : p.name;
  return what.replace(/\s+/g, " ").trim();
}

const audience = (p: ProductData) => (p.audience ? ` Made for ${p.audience}.` : "");

/* --------------------------------- catalog --------------------------------- */

const IMAGE_MODEL = "gpt-image-2";
const IMAGE_SLOTS: FormatSlot[] = [{ slot: "refs", from: "product-images", max: 4, required: false }];
const START_FRAME: FormatSlot[] = [{ slot: "start", from: "product-images", max: 1, required: false }];

export const FORMATS: AdFormat[] = [
  {
    id: "hero-shot",
    name: "Product hero shot",
    description: "The product alone, lit like a studio photo, ready for a feed post.",
    output: "image",
    group: "image",
    platform: { label: "Square feed post", aspect: "1:1", seconds: null },
    modelId: IMAGE_MODEL,
    values: { aspect: "1:1", quality: "medium", background: "auto" },
    slots: IMAGE_SLOTS,
    spoken: false,
    scenes: ["on a clean seamless backdrop with soft shadows", "on a stone plinth with a single hard light", "floating at a slight angle over a colour gradient", "close-up on its best detail, shallow depth of field"],
    recipe: (c) => `Commercial product photograph of ${productLine(c.product)}, ${c.scene}. Show off: ${c.benefit}. Crisp, true-to-life materials, no text.${brandLook(c.brand)}`,
  },
  {
    id: "lifestyle-scene",
    name: "Lifestyle scene",
    description: "The product in use, in a real-looking everyday setting.",
    output: "image",
    group: "image",
    platform: { label: "Portrait feed post", aspect: "3:4", seconds: null },
    modelId: IMAGE_MODEL,
    values: { aspect: "3:4", quality: "medium", background: "auto" },
    slots: IMAGE_SLOTS,
    spoken: false,
    scenes: ["a sunny kitchen in the morning", "a cosy living room in the evening", "outdoors in a city park", "a tidy desk by a window"],
    recipe: (c) => `Natural lifestyle photo: a person enjoying ${productLine(c.product)} in ${c.scene}. The moment shows ${c.benefit}.${audience(c.product)} Candid, warm, believable.${brandLook(c.brand)}`,
  },
  {
    id: "before-after",
    name: "Before and after",
    description: "A split image: the problem on the left, life with the product on the right.",
    output: "image",
    group: "image",
    platform: { label: "Landscape feed post", aspect: "3:2", seconds: null },
    modelId: IMAGE_MODEL,
    values: { aspect: "3:2", quality: "medium", background: "auto" },
    slots: IMAGE_SLOTS,
    spoken: false,
    scenes: ["a clear vertical split down the middle", "two panels with a thin divider line", "the same spot photographed twice"],
    recipe: (c) => `Before-and-after comparison image, ${c.scene}. Left: the everyday problem, dull and messy. Right: the same scene improved by ${productLine(c.product)}, showing ${c.benefit}. Product clearly visible on the right only.${brandLook(c.brand)}`,
  },
  {
    id: "web-banner",
    name: "Wide web banner",
    description: "A wide static banner with room on one side for a headline.",
    output: "image",
    group: "image",
    platform: { label: "Website or display banner", aspect: "16:9", seconds: null },
    modelId: IMAGE_MODEL,
    values: { aspect: "16:9", quality: "medium", background: "auto" },
    slots: IMAGE_SLOTS,
    spoken: false,
    scenes: ["product on the right, calm empty space on the left", "product on the left, soft gradient space on the right", "product centred low, open sky above"],
    recipe: (c) => `Wide advertising banner background featuring ${productLine(c.product)}, ${c.scene} for a headline to be added later. Hint at ${c.benefit}. No text, no logos.${brandLook(c.brand)}`,
  },
  {
    id: "story-still",
    name: "Vertical story still",
    description: "A full-screen vertical image for stories, with safe space top and bottom.",
    output: "image",
    group: "image",
    platform: { label: "Stories and reels cover", aspect: "9:16", seconds: null },
    modelId: IMAGE_MODEL,
    values: { aspect: "9:16", quality: "medium", background: "auto" },
    slots: IMAGE_SLOTS,
    spoken: false,
    scenes: ["held up against a bright wall", "on a bathroom shelf in morning light", "in a bag being packed for a trip"],
    recipe: (c) => `Vertical full-screen photo of ${productLine(c.product)}, ${c.scene}. Leave the top and bottom fifth plain for captions. Highlight ${c.benefit}.${brandLook(c.brand)}`,
  },
  {
    id: "unboxing",
    name: "Unboxing clip",
    description: "Hands open the package and reveal the product. Short vertical video with sound.",
    output: "video",
    group: "video",
    platform: { label: "Vertical short video", aspect: "9:16", seconds: 6 },
    modelId: "veo-3.1-lite",
    values: { aspect: "9:16", duration: "6", resolution: "720p", audio: true },
    slots: START_FRAME,
    spoken: false,
    scenes: ["on a wooden table", "on a bed with soft sheets", "on a kitchen counter"],
    recipe: (c) => `Close-up handheld video: two hands open a box ${c.scene} and lift out ${productLine(c.product)}, turning it to the light. Satisfying paper and cardboard sounds. Ends on the product, showing ${c.benefit}.${brandLook(c.brand)}`,
  },
  {
    id: "handheld-review",
    name: "Hand-held review",
    description: "A selfie-style clip of someone showing the product to camera, like a customer review.",
    output: "video",
    group: "video",
    platform: { label: "Vertical short video", aspect: "9:16", seconds: 5 },
    modelId: "kling-3-std",
    values: { aspect: "9:16", duration: 5, resolution: "720p", audio: true },
    slots: START_FRAME,
    spoken: false,
    scenes: ["at home on the sofa", "in a car, parked", "walking down a sunny street"],
    recipe: (c) => `Phone-camera selfie video ${c.scene}: a smiling person holds ${productLine(c.product)} up to the lens and points out ${c.benefit}.${audience(c.product)} Casual, authentic, slightly shaky framing.`,
  },
  {
    id: "product-motion",
    name: "Product in motion",
    description: "The product turns and catches the light. A short square loop.",
    output: "video",
    group: "video",
    platform: { label: "Square feed video", aspect: "1:1", seconds: 5 },
    modelId: "seedance-1-lite",
    values: { aspect: "1:1", duration: 5, resolution: "720p" },
    slots: START_FRAME,
    spoken: false,
    scenes: ["slowly rotating on a turntable", "with the camera gliding around it", "as light sweeps across its surface"],
    recipe: (c) => `Smooth product video of ${productLine(c.product)} ${c.scene}. Premium studio lighting, seamless loop, emphasising ${c.benefit}.${brandLook(c.brand)}`,
  },
  {
    id: "vertical-story",
    name: "Vertical story video",
    description: "A short vertical scene that tells a tiny story around the product.",
    output: "video",
    group: "video",
    platform: { label: "Stories and reels", aspect: "9:16", seconds: 5 },
    modelId: "wan-2.6",
    values: { aspect: "9:16", duration: "5", resolution: "720p", audio: true },
    slots: START_FRAME,
    spoken: false,
    scenes: ["a rushed morning that turns calm", "a friend asks what that is", "a small daily struggle solved in one move"],
    recipe: (c) => `Vertical cinematic short: ${c.scene}, thanks to ${productLine(c.product)}. The final shot shows ${c.benefit}.${audience(c.product)}${brandLook(c.brand)}`,
  },
  {
    id: "spokesperson",
    name: "Spokesperson",
    description: "A presenter speaks your script to camera. Needs a presenter photo. Up to about 15 seconds.",
    output: "video",
    group: "spoken",
    platform: { label: "Vertical talking video", aspect: "9:16", seconds: 15 },
    modelId: "heygen-avatar-iv",
    values: { aspect: "9:16", duration: 15, resolution: "720p" },
    slots: [
      { slot: "portrait", from: "presenter", max: 1, required: true },
      { slot: "voice", from: "speech", max: 1, required: true },
    ],
    speech: { modelId: "minimax-speech-2.8-turbo", values: { voice: "English_FriendlyPerson", emotion: "happy", speed: 1, pitch: 0 } },
    spoken: true,
    scenes: ["direct to camera"],
    recipe: (c) => c.script,
  },
  {
    id: "voiceover",
    name: "Audio spot",
    description: "Your script read by a voice, for audio ads or to lay over your own footage.",
    output: "audio",
    group: "spoken",
    platform: { label: "Audio ad", aspect: null, seconds: null },
    modelId: "minimax-speech-2.8-turbo",
    values: { voice: "English_expressive_narrator", emotion: "happy", speed: 1, pitch: 0 },
    slots: [],
    spoken: true,
    scenes: ["read aloud"],
    recipe: (c) => c.script,
  },
];

const byId = new Map(FORMATS.map((f) => [f.id, f]));

export function getFormat(id: unknown): AdFormat | undefined {
  return typeof id === "string" ? byId.get(id) : undefined;
}

/* -------------------------------- validation ------------------------------- */

/** How many files each slot will hold when the format runs with everything it can use. */
export function fullSlots(f: AdFormat): Filled {
  return Object.fromEntries(f.slots.map((s) => [s.slot, s.max]));
}

function checkStep(where: string, modelId: string, values: Values, filled: Filled, slots: FormatSlot[], problems: string[]) {
  const model = getModel(modelId);
  if (!model) return void problems.push(`${where}: model ${modelId} is not in the registry`);
  if (model.status !== "available") problems.push(`${where}: model ${modelId} is not available`);
  const resolved = resolveValues(model, values, filled);
  for (const [k, v] of Object.entries(values)) {
    if (!(k in resolved)) problems.push(`${where}: control ${k} does not apply on ${modelId}`);
    else if (resolved[k] !== v) problems.push(`${where}: ${k}=${JSON.stringify(v)} resolves to ${JSON.stringify(resolved[k])} on ${modelId}`);
  }
  for (const s of slots) {
    const slot = model.slots.find((m) => m.id === s.slot);
    if (!slot) problems.push(`${where}: ${modelId} has no slot ${s.slot}`);
    else if (s.max > slot.max) problems.push(`${where}: slot ${s.slot} takes at most ${slot.max}`);
  }
  if (!model.prompt) problems.push(`${where}: ${modelId} takes no prompt, so the recipe would be dropped`);
  const quote = quoteJob(model, { prompt: "price check", values: resolved, filled, count: 1 });
  if (!quote.exact || quote.metered) problems.push(`${where}: ${modelId} has no exact price for these values`);
  if (quote.jobs !== 1) problems.push(`${where}: one variation must be one job`);
}

/** Problems with one format, as text. Empty when it can run. */
export function formatProblems(f: AdFormat): string[] {
  const problems: string[] = [];
  if (f.scenes.length === 0) problems.push(`${f.id}: needs at least one scene`);
  checkStep(f.id, f.modelId, f.values, fullSlots(f), f.slots, problems);
  if (f.speech) checkStep(`${f.id} (speech)`, f.speech.modelId, f.speech.values, {}, [], problems);
  if (f.slots.some((s) => s.from === "speech") && !f.speech) problems.push(`${f.id}: speech slot without a speech step`);
  return problems;
}

/** Every problem with the catalog, as text. Empty when all formats are sound. */
export function checkFormats(): string[] {
  const ids = FORMATS.map((f) => f.id);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i).map((id) => `duplicate format id ${id}`);
  return [...dupes, ...FORMATS.flatMap(formatProblems)];
}

const health = new Map<string, boolean>();

/** True when the format passes validation against the registry. Cached per process. */
export function formatUsable(f: AdFormat): boolean {
  let ok = health.get(f.id);
  if (ok === undefined) {
    ok = formatProblems(f).length === 0;
    if (!ok) console.error("[ads] format is unusable:", formatProblems(f).join("; "));
    health.set(f.id, ok);
  }
  return ok;
}
