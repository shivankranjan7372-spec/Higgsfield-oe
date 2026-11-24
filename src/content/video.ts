/**
 * Words and sample lists for the Video studio (/video). Everything a member reads on that page
 * that is not a model name (those come from the registry) lives here.
 */

export const videoCopy = {
  tabs: { create: "Create Video", edit: "Edit Video" },
  modes: { clip: "Text & frames", avatar: "Talking avatar" },
  change: "Change",
  model: "Model",
  prompt: "Prompt",
  promptPlaceholder: "Describe the shot: who, where, how the camera moves",
  moreSettings: "More settings",
  generate: "Generate",
  signIn: "Sign in to generate",
  createAccount: "Create account",
  dismiss: "Dismiss",
  remove: "Remove",
  uploading: "Uploading…",
  dropHint: "Drop a file or click to browse",
  slotCopy: {
    start: {
      title: ["Add a start frame", "to open the shot"],
      hint: "The first frame of the video",
    },
    end: {
      title: ["Add an end frame", "to land the shot"],
      hint: "The video ends on this image",
    },
    portrait: {
      title: ["Add a portrait", "of one clear face"],
      hint: "Front-facing photo works best",
    },
    voice: {
      title: ["Add a voice track", "to lip-sync to"],
      hint: "Optional. Otherwise the script is spoken",
    },
  } as Record<string, { title: [string, string]; hint: string }>,
  edit: {
    title: "Edit footage you already have",
    body: "Editing models change a clip you upload while keeping the rest of it. None of them is open yet.",
    back: "Make a new video instead",
  },
  views: { examples: "Examples", history: "History" },
  hero: {
    title: "One idea, many shots",
    body: "Start from a sample prompt, add your own start and end frames, and turn a still picture into a moving scene.",
  },
  categories: [
    { id: "all", label: "All" },
    { id: "nature", label: "Nature" },
    { id: "city", label: "City" },
    { id: "people", label: "People" },
    { id: "product", label: "Product" },
    { id: "motion", label: "Motion" },
    { id: "stylised", label: "Stylised" },
  ],
  useExample: "Use this prompt",
  history: {
    empty: "Your videos will appear here",
    emptyBody:
      "Write a prompt on the left and press Generate to make your first clip.",
    emptyAction: "Browse examples",
    signedOut: "Sign in to keep your videos",
    signedOutBody:
      "Everything you make is saved here, with its prompt and settings.",
    queued: "In line",
    running: "Making it",
    failed: "This one did not work.",
    refunded: "Your credits are back in your balance.",
    retry: "Try it again",
    cancel: "Cancel",
  },
  detail: {
    title: "Video details",
    model: "Model",
    created: "Made",
    download: "Download",
    favourite: "Favourite",
    unfavourite: "Remove from favourites",
    useSettings: "Use these settings",
    publish: "Publish",
    published: "Published",
    viewPost: "View post",
    delete: "Delete",
    confirmDelete: "Delete for good? The file can't be brought back.",
    confirm: "Delete",
    keep: "Keep it",
    noPrompt: "No prompt",
    membersOnly: "Create an account to publish your videos to the community.",
  },
} as const;

export type ExampleShape = "wide" | "photo" | "tall";

export interface VideoExample {
  id: string;
  category: string;
  shape: ExampleShape;
  prompt: string;
}

/** Sample prompts for the example gallery. Each tile is an `Artwork` slot named `video/example-<id>`. */
export const videoExamples: VideoExample[] = [
  {
    id: "harbour-dawn",
    category: "nature",
    shape: "wide",
    prompt:
      "Slow push-in over a quiet fishing harbour at dawn, mist on the water, gulls lifting off the masts",
  },
  {
    id: "neon-rain",
    category: "city",
    shape: "photo",
    prompt:
      "Handheld tracking shot down a rain-soaked night street, neon signs reflecting in puddles, people with umbrellas",
  },
  {
    id: "dancer-studio",
    category: "people",
    shape: "tall",
    prompt:
      "A dancer spins in an empty sunlit studio, dust in the light beams, camera circles slowly around her",
  },
  {
    id: "sneaker-turn",
    category: "product",
    shape: "tall",
    prompt:
      "A white sneaker turning on a glossy pedestal, soft studio light, clean grey backdrop, smooth 360 orbit",
  },
  {
    id: "desert-drone",
    category: "nature",
    shape: "tall",
    prompt:
      "Drone rising over red desert dunes at sunset, long shadows, a lone jeep leaving a trail of dust",
  },
  {
    id: "paper-city",
    category: "stylised",
    shape: "wide",
    prompt:
      "A papercraft city unfolds from a book, tiny cars start moving, warm stop-motion feel",
  },
  {
    id: "coffee-pour",
    category: "product",
    shape: "photo",
    prompt:
      "Macro slow motion of milk poured into black coffee, swirling patterns, morning window light",
  },
  {
    id: "skate-park",
    category: "motion",
    shape: "wide",
    prompt:
      "A skateboarder drops into a concrete bowl, low angle follow cam, golden hour, fisheye lens",
  },
  {
    id: "market-crowd",
    category: "city",
    shape: "tall",
    prompt:
      "Time-lapse of a busy night market, lanterns glowing, crowds streaming between food stalls",
  },
  {
    id: "forest-fox",
    category: "nature",
    shape: "photo",
    prompt:
      "A red fox steps out of a snowy forest and looks into the camera, breath visible in the cold air",
  },
  {
    id: "chef-flame",
    category: "people",
    shape: "wide",
    prompt:
      "A chef flips vegetables in a flaming wok, sparks and steam, kitchen bustle in the background",
  },
  {
    id: "ink-ocean",
    category: "stylised",
    shape: "tall",
    prompt:
      "Ink-wash painting of ocean waves that start to move and crash, brush strokes trailing behind",
  },
];
