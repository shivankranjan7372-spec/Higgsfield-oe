/**
 * The Shorts studio's own words and sample ideas. Layout and style come from the design;
 * every line here is Parallax's. Keep lines about as long as the ones they replace.
 */

/** Longest clip this page asks for, in seconds. A short stays short. */
export const SHORT_MAX_SECONDS = 10;
/** The frame every short is made in. */
export const SHORT_ASPECT = "9:16";
/** The label on jobs queued from this page, so its results stay apart from the Video studio's. */
export const SHORTS_SURFACE = "shorts";

export interface ShortIdea {
  id: string;
  title: string;
  prompt: string;
}

/** Sample ideas for the first tab. Each tile is an `Artwork` slot: `shorts/idea-<id>` and `shorts/idea-<id>-frame`. */
export const shortIdeas: ShortIdea[] = [
  {
    id: "lighthouse",
    title: "Night at the lighthouse",
    prompt: "A slow push toward a lighthouse at night, waves breaking below, the beam sweeping through sea mist, vertical frame",
  },
  {
    id: "paper-city",
    title: "Paper city wakes up",
    prompt: "A city folded from paper unfolds at sunrise, tiny paper trams start moving, soft warm light, close macro shots",
  },
  {
    id: "noodle-stall",
    title: "Midnight noodle stall",
    prompt: "Steam rising from a street noodle stall in the rain, neon signs reflected in puddles, handheld close-ups",
  },
  {
    id: "desert-run",
    title: "Desert trail run",
    prompt: "A runner crosses red sand dunes at golden hour, low tracking shot, dust trailing behind, wind in the frame",
  },
  {
    id: "tiny-garden",
    title: "A garden in a jar",
    prompt: "Time-lapse of moss and tiny ferns growing inside a glass jar on a windowsill, morning light shifting",
  },
  {
    id: "vinyl",
    title: "Record shop crate dig",
    prompt: "Fingers flick through vinyl records in a crate, shallow focus, dust in the light, one sleeve pulled out",
  },
  {
    id: "glacier",
    title: "Under the glacier",
    prompt: "Walking through a blue ice cave, light filtering through the ceiling, water dripping, slow steady glide",
  },
  {
    id: "clay",
    title: "Clay on the wheel",
    prompt: "Hands shape a clay bowl on a spinning pottery wheel, top-down then side view, wet clay glistening",
  },
  {
    id: "kite",
    title: "Kites over the cliffs",
    prompt: "Bright kites dance above green sea cliffs, a wide shot tilting up into a clear sky, gulls passing",
  },
  {
    id: "comet",
    title: "Comet over the farm",
    prompt: "A comet crosses a starry sky above a quiet farmhouse, a dog looks up, the camera rises slowly",
  },
];

export const shortsCopy = {
  hero: {
    word: "Shorts",
    sub: "Studio",
    line: "Turn one idea into a short vertical video, ready to post.",
    start: "Start generating",
    how: "How does it work?",
  },
  tabs: {
    label: "Shorts",
    ideas: "Starter ideas",
    mine: "Your shorts",
  },
  idea: {
    use: (title: string) => `Use this idea: ${title}`,
    hint: "Use this idea",
  },
  how: {
    title: "How Shorts works",
    steps: [
      { title: "Write one idea", body: "Describe the scene in a sentence or two, or start from an idea below." },
      { title: "Pick a model and a length", body: `Every short is made tall (${SHORT_ASPECT}) and up to ${SHORT_MAX_SECONDS} seconds long.` },
      { title: "Generate and keep the best", body: "Your shorts appear here as they finish. Hover to play, open to download." },
    ],
    start: "Start generating",
  },
  form: {
    title: "New short",
    promptLabel: "Your idea",
    placeholder: "Describe your short: who or what, where, and how the camera moves",
    model: "Model",
    frame: "Frame",
    frameValue: "Vertical 9:16",
    length: "Length",
    reference: "Starting picture",
    settings: "Settings",
    generate: "Generate",
    cost: (credits: string) => `${credits} credits`,
    noPrice: "Price shows once the form is filled in",
    guest: "You are trying Parallax as a guest. Create an account to keep your shorts.",
    join: "Create account",
    topUp: "Get credits",
    dismiss: "Dismiss",
    noModels: "No model can make vertical video right now.",
  },
  mine: {
    label: "Your shorts",
    loading: "Loading your shorts",
    emptyTitle: "Your shorts will appear here.",
    emptyBody: "Start from one idea. Each short is tall and a few seconds long.",
    signedOut: "Make your first short in a minute. No account needed to try.",
    start: "Start generating",
  },
  tile: {
    open: (prompt: string) => `Open: ${prompt}`,
    queued: "In line",
    running: "Making it",
    cancel: "Cancel",
    remove: "Remove",
    retry: "Try again",
    failedFallback: "This one did not work.",
    refunded: "Your credits are back.",
  },
  viewer: {
    title: "Your short",
    download: "Download",
    favorite: "Favourite",
    unfavorite: "Favourited",
    remove: "Delete",
    confirmRemove: "Delete for good",
    confirmText: "This short and its file will be gone for good.",
    keep: "Keep it",
    reuse: "Use these settings",
    prompt: "Idea",
    model: "Model",
    length: "Length",
    made: "Made",
    cost: "Cost",
    seconds: (s: number) => `${s}s`,
    credits: (c: string) => `${c} credits`,
  },
  notice: {
    queued: "Your short is on its way.",
    removed: "Short deleted.",
  },
};
