/**
 * Words and lists for the Remix studio (/remix). Remix takes a picture the member already has
 * and a direction, and makes a new moving version of it.
 */

/** The jobs this page makes carry this surface, so the History tab lists only its own work. */
export const REMIX_SURFACE = "remix";

/**
 * The Mode row. Each mode is one real model from the video registry that starts from a
 * picture (it has a `start` slot). Standard is the cheaper one, Pro the higher-fidelity one.
 */
export const remixModes = [
  { id: "standard", label: "Standard", modelId: "wan-3", hint: "Quick and cheaper" },
  { id: "pro", label: "Pro", modelId: "wan-3-prime", hint: "Finer detail" },
] as const;

export type RemixModeId = (typeof remixModes)[number]["id"];

export const remixCopy = {
  kicker: "Picture to motion",
  wordmark: "Remix",
  source: {
    /** How the page names the picture when it is missing: "Add a source picture first." */
    name: "A source picture",
    title: ["Add a source picture", "to set it in motion"],
    hint: "PNG, JPG or WebP, one picture",
    uploading: "Uploading…",
    replace: "Remove the source picture",
  },
  ending: {
    title: ["Add an end picture", "for the shot to land on"],
    hint: "Optional, one picture",
    replace: "Remove the end picture",
  },
  prompt: {
    label: "Prompt",
    placeholder: "Describe the new version: what changes, how it moves, the light.",
    /** Sent when the Prompt switch is off and the model needs words: the picture simply comes to life. */
    fallback: "Bring the picture to life with gentle, natural motion.",
  },
  mode: "Mode",
  quality: "Quality",
  generate: "Generate",
  tabs: { ideas: "Directions", history: "History" },
  hero: {
    title: "One picture, many takes",
    body: "Start from a still of your own, pick a direction below or write your own, and get a new moving version in the look you choose.",
  },
  useDirection: "Use this direction",
  history: {
    label: "Your remixes",
    emptyTitle: "Nothing remixed yet",
    emptyBody: "Add a picture on the left, give it a direction and press Generate.",
    signedOutTitle: "Your remixes live here",
    signedOutBody: "Make your first one as a guest, or sign in to see the remixes you made before.",
    signIn: "Sign in",
    guestNote: "You are trying Remix as a guest. Create an account to keep these.",
    createAccount: "Create account",
    making: "Making it",
    waiting: "In line",
    failedNote: "Your credits are back in your balance.",
    retry: "Try again",
    open: "Open",
  },
  viewer: {
    title: "Remix",
    download: "Download",
    favorite: "Favourite",
    unfavorite: "Remove from favourites",
    remove: "Delete",
    confirmRemove: "Delete for good?",
    confirmYes: "Delete",
    confirmNo: "Keep",
    reuse: "Use these settings",
  },
};

/** The category row over the example gallery. */
export const remixCategories = ["All", "Everyday", "Playful", "Animals", "Music", "Travel", "Sport"] as const;
export type RemixCategory = (typeof remixCategories)[number];

/**
 * Sample directions for the example gallery. Each tile is an `Artwork` slot named
 * `remix/<id>`; `tall` tiles are 9:16, the others are wide.
 */
export const remixExamples: { id: string; title: string; category: Exclude<RemixCategory, "All">; tall: boolean; direction: string }[] = [
  { id: "rain-window", title: "Rain on the glass", category: "Everyday", tall: false, direction: "Rain starts against the window, the light turns blue and the camera drifts slowly closer." },
  { id: "leap", title: "Mid-air leap", category: "Sport", tall: true, direction: "The figure springs into a high leap, the crowd behind blurs, slow motion at the peak." },
  { id: "paper-city", title: "Paper city", category: "Playful", tall: true, direction: "Everything turns to folded paper and gently unfolds, warm studio light, slow push in." },
  { id: "dog-run", title: "Beach sprint", category: "Animals", tall: true, direction: "The dog races toward the camera along wet sand, spray in the air, low tracking shot." },
  { id: "neon-stage", title: "Neon stage", category: "Music", tall: false, direction: "Neon lights pulse to a beat, haze rolls across the stage, the camera orbits once." },
  { id: "night-train", title: "Night train", category: "Travel", tall: true, direction: "City lights stream past the train window at night, reflections slide across the face." },
  { id: "kitchen", title: "Morning kitchen", category: "Everyday", tall: true, direction: "Steam rises from a cup, sunlight moves across the table, a calm handheld feel." },
  { id: "cat-nap", title: "Sunlit nap", category: "Animals", tall: false, direction: "The cat stretches in a patch of sun, dust floats in the beam, gentle slow zoom." },
  { id: "clay", title: "Clay world", category: "Playful", tall: false, direction: "Restyle the scene as soft clay animation, small bouncy movements, bright colours." },
  { id: "snow-peak", title: "Summit wind", category: "Travel", tall: false, direction: "Snow whips across the summit, clouds race below, the camera rises slowly." },
  { id: "dance", title: "Rooftop dance", category: "Music", tall: true, direction: "The figure breaks into a loose dance on a rooftop at dusk, camera circles at waist height." },
  { id: "goal", title: "Last-second goal", category: "Sport", tall: false, direction: "The ball curls into the net, the frame shakes, confetti bursts in the stands." },
];
