/**
 * Horizon (the long-form video studio that is not open yet) and the Guide: every word and list
 * on those two pages. Layout and style come from the design; the words are Parallax's.
 * Keep each line about as long as the one it replaces so the layout holds.
 */
import { brand } from "@/config/brand";
import { routes } from "@/content/site";

export const horizonCopy = {
  meta: {
    title: "Horizon",
    description: "Horizon is coming: long-form video from one brief.",
  },

  hero: {
    art: "horizon/hero",
    badges: ["One brief", "One whole film"],
    title: `${brand.name} Horizon is coming soon`,
    lead: "Long-form video from one brief. Write the story once, watch it play.",
    leadStrong: "Be first to hear when it opens.",
    secondary: { label: "Make a short clip today", href: routes.video },
  },

  /** The waitlist button. There is no waitlist route: it turns on the product-news notice. */
  news: {
    cta: "Get launch news",
    working: "Saving…",
    on: "You'll hear first",
    onHint: "Product news is on. Turn it off any time in settings.",
    turnOff: "Turn off",
    guestHint: "Create a free account so we know where to send the news.",
    signedOutHint: "Sign in or create a free account to get the news.",
    retry: "Try again",
  },

  /** The tabbed strip under the hero: five steps from brief to film. */
  steps: {
    label: "From brief to film",
    slideOf: (n: number, total: number) => `Slide ${n} of ${total}`,
    start: 2,
    items: [
      { id: "brief", tab: "Brief", lead: "Brief first.", text: "Say what the film is about, who is in it and how it should feel." },
      { id: "script", tab: "Script", lead: "Script next.", text: "Read the scenes and the lines, and change any of them before a frame is made." },
      { id: "scenes", tab: "Scenes", lead: "Scenes in order.", text: "Every scene is planned shot by shot, with the same cast and places throughout." },
      { id: "sound", tab: "Sound", lead: "Sound to match.", text: "Voices, music and room tone are laid under the picture as it is cut." },
      { id: "cut", tab: "Cut", lead: "One cut out.", text: "Watch the whole film, trim what you like and keep it in your library." },
    ],
  },

  /** The full-width picture with the swatch chips. */
  look: {
    title: ["Set one look", "for every scene"],
    label: "Film look",
    items: [
      { id: "day", label: "Day", swatch: "#7EC8F2" },
      { id: "warm", label: "Warm", swatch: "#D9CDB8" },
      { id: "dusk", label: "Dusk", swatch: "#B5523B" },
      { id: "faded", label: "Faded", swatch: "#6B6B3A" },
      { id: "night", label: "Night", swatch: "#1A1A1A" },
    ],
  },

  closer: {
    eyebrow: "Closer look",
    title: ["One brief in,", "a whole film out"],
    rows: [
      {
        id: "plan",
        title: ["Plan it as you say it"],
        text: "No timeline to build. Horizon turns your brief into scenes you can read and change.",
        stages: ["Brief", "Outline", "Shots", "Final"],
      },
      {
        id: "cast",
        title: ["Same cast,", "every scene"],
        text: "Faces, clothes and places stay the same from the first shot to the very last one.",
        compare: { label: "Compare the first and the last scene", first: "First scene", last: "Last scene" },
      },
      {
        id: "pace",
        title: ["Paced like an edit"],
        text: "Shots are cut to the story and the music, not to one fixed clip length every time.",
      },
      {
        id: "change",
        title: ["Change one scene,", "keep the film"],
        text: "Rewrite a single scene and every other scene stays exactly as it was before.",
      },
    ],
  },

  get: {
    title: "What you get",
    sub: "What Horizon is being built to do",
    big: "Minutes, not seconds",
    bigText: "A film with a beginning, a middle and an end, made from a single brief.",
    listTitle: "Planned for the first version",
    list: [
      "A script you can read and edit",
      "A shot list for every scene",
      "One cast that stays the same",
      "Voices, music and captions",
      "The finished film in your library",
    ],
    note: "Plans can change before launch. No date yet.",
    today: { label: "Until then, make shots in Video", href: routes.video },
  },
} as const;

export const guideCopy = {
  meta: {
    title: "Guide",
    description: `How ${brand.name} works: credits, studios and writing prompts.`,
  },
  eyebrow: "Guide",
  title: `How ${brand.name} works`,
  lead: "Credits, studios and prompts, in about two minutes.",
  nav: [
    { id: "credits", label: "Credits" },
    { id: "studios", label: "Studios" },
    { id: "prompts", label: "Prompts" },
  ],
  credits: {
    title: "How credits work",
    lead: "Every generation costs credits. You see the price on the Generate button before you press it.",
    facts: {
      signup: "credits when you create a free account",
      guest: "credits to try it without an account",
      value: "is what one credit is worth",
      batch: "results at most from one press of Generate",
    },
    rules: [
      "Credits are held when a job starts and charged only when it succeeds.",
      "A job that fails costs nothing: the hold is given back.",
      "If a model returns fewer results, or costs less than quoted, the difference comes back.",
      "Removing a finished job does not return its credits.",
    ],
    plansTitle: "Monthly credits by plan",
    perMonth: "a month",
    concurrent: (n: number) => `${n} jobs at once`,
    pricing: { label: "See plans", href: routes.pricing },
    balanceLabel: "Your balance",
    signedOut: "Create a free account to get your starting credits.",
    join: "Create account",
  },
  studios: {
    title: "What each studio does",
    open: "Open",
    items: [
      { id: "image", href: routes.image, name: "Image", text: "Stills from a prompt, with references for faces, products and style." },
      { id: "video", href: routes.video, name: "Video", text: "Short shots from text, a start frame or a reference clip." },
      { id: "audio", href: routes.audio, name: "Audio", text: "Voices from a script and music from a short description." },
      { id: "cinema", href: routes.cinema, name: "Shot Planner", text: "Camera, lens and movement picked like on a real set." },
      { id: "remix", href: routes.remix, name: "Remix", text: "Start from something you like and change it your way." },
      { id: "apps", href: routes.apps, name: "Apps", text: "One-click tools built on the models for common jobs." },
      { id: "library", href: routes.library, name: "Library", text: "Everything you have made, in folders, ready to download." },
      { id: "mcp", href: routes.mcp, name: "MCP", text: "Use the studio from your own assistant or tools." },
      { id: "horizon", href: routes.horizon, name: "Horizon", text: "Long-form video from one brief. Not open yet.", soon: "Soon" },
    ],
  },
  prompts: {
    title: "Writing better prompts",
    tips: [
      { title: "Lead with the subject", text: "Say who or what is in the picture first, then where they are." },
      { title: "Name the light", text: "Soft morning light, hard noon sun or neon at night changes everything." },
      { title: "Pick a camera", text: "Close-up, wide shot or top-down tells the model how to frame it." },
      { title: "Add one style word", text: "Film photo, watercolour or clay. One clear style beats five mixed ones." },
      { title: "For video, say what moves", text: "Describe the motion and the camera: she turns, the camera pushes in." },
      { title: "Change one thing at a time", text: "Keep what worked and edit a single phrase between tries." },
    ],
    example: {
      label: "Example",
      text: "A lighthouse keeper on a rocky shore at dusk, wide shot, warm lamp light, film photo",
      cta: "Try it in Image",
    },
  },
} as const;
