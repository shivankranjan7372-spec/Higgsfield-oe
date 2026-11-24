/**
 * The shell's own words and lists: the big nav menus, the account menu, the bell, the small-screen
 * panel and the footer. Page addresses come from `routes`; model names come from the registry.
 */
import { brand } from "@/config/brand";
import { routes } from "@/content/site";

/** Which nav links open a big menu, and what each menu lists. */
export type MenuId = "image" | "video" | "audio";

/** Icon names map to lucide icons in `nav-menu.tsx`. */
export type FeatureIcon =
  | "image"
  | "canvas"
  | "apps"
  | "library"
  | "explore"
  | "video"
  | "cinema"
  | "remix"
  | "shorts"
  | "ads"
  | "speech"
  | "music"
  | "contests";

export interface MenuFeature {
  label: string;
  blurb: string;
  href: string;
  icon: FeatureIcon;
}

export interface MenuSpec {
  /** Heading over the left column. */
  featuresLabel: string;
  features: MenuFeature[];
  /** Heading over the right column. */
  modelsLabel: string;
  /** Registry surfaces whose models fill the right column, in order. */
  surfaces: string[];
  /** The create page the model rows open, with `?model=<id>`. */
  studio: string;
}

export const navMenus: Record<MenuId, MenuSpec> = {
  image: {
    featuresLabel: "Features",
    features: [
      { label: "Create Image", blurb: "Turn a sentence into a picture", href: routes.image, icon: "image" },
      { label: "Boards", blurb: "Lay out ideas and run them as a flow", href: routes.canvas, icon: "canvas" },
      { label: "Apps", blurb: "One-click tools built on the models", href: routes.apps, icon: "apps" },
      { label: "Remix", blurb: "Upload one picture, get new takes on it", href: routes.remix, icon: "remix" },
      { label: "Explore", blurb: "See what people are making right now", href: routes.explore, icon: "explore" },
      { label: "Library", blurb: "Everything you have made, in one place", href: routes.library, icon: "library" },
    ],
    modelsLabel: "Models",
    surfaces: ["image"],
    studio: routes.image,
  },
  video: {
    featuresLabel: "Features",
    features: [
      { label: "Create Video", blurb: "Shots from text, frames and references", href: routes.video, icon: "video" },
      { label: "Shot Planner", blurb: "Direct a scene with camera and lens", href: routes.cinema, icon: "cinema" },
      { label: "Shorts", blurb: "Go from a script to a ready short", href: routes.shorts, icon: "shorts" },
      { label: "Ad Campaigns", blurb: "Product videos and stills for a brand", href: routes.ads, icon: "ads" },
      { label: "Remix", blurb: "One clip in, many new versions out", href: routes.remix, icon: "remix" },
      { label: "Contests", blurb: "Make a film and enter this month's call", href: routes.contests, icon: "contests" },
      { label: "Boards", blurb: "Lay out ideas and run them as a flow", href: routes.canvas, icon: "canvas" },
    ],
    modelsLabel: "Models",
    surfaces: ["video"],
    studio: routes.video,
  },
  audio: {
    featuresLabel: "Features",
    features: [
      { label: "Text to Speech", blurb: "Read any script in a natural voice", href: routes.audio, icon: "speech" },
      { label: "Music", blurb: "Write a track from a short description", href: routes.audio, icon: "music" },
      { label: "Library", blurb: "Every take you have generated", href: routes.library, icon: "library" },
    ],
    modelsLabel: "Models",
    surfaces: ["speech", "music"],
    studio: routes.audio,
  },
};

/** Small labels on a model row. */
export const modelFlags = {
  featured: "Top",
  soon: "Soon",
  offline: "Offline",
} as const;

export const navWords = {
  home: `${brand.name} home`,
  search: "Search",
  language: "Language",
  languageNote: "More languages are on the way.",
  english: "English",
  enterprise: "Enterprise",
  pricing: "Pricing",
  upgrade: "Upgrade",
  login: "Login",
  join: "Get started",
  library: "Library",
  invite: "Invite a friend, earn credits",
  account: "Your account",
  openMenu: "Open menu",
  closeMenu: "Close menu",
  panelTitle: "Menu",
  studios: "Studios",
  pages: "Pages",
  menuOf: (label: string) => `${label} menu`,
} as const;

export const bellWords = {
  label: (n: number) => (n === 0 ? "Notifications" : n === 1 ? "Notifications, 1 unread" : `Notifications, ${n} unread`),
} as const;

export const accountWords = {
  creditsHeading: "Credits",
  creditsHint: "Every generation spends credits. The price shows on the Generate button before you press it.",
  left: (amount: string) => `${amount} left`,
  meter: (pct: number) => `${pct}% of your monthly credits left`,
  topUp: "Top up credits",
  upgrade: "Upgrade plan",
  changePlan: "Change plan",
  get: "Get",
  viewProfile: "View profile",
  settings: "Manage account",
  library: "Your library",
  invite: "Invite friends",
  whatsNew: "What's new",
  help: "Guide",
  logOut: "Log out",
  loggingOut: "Logging out…",
  logOutFailed: "Could not log out. Try again.",
  plan: (name: string) => `${name} plan`,
  guest: "Guest",
  guestNote: "Create an account to keep what you make.",
  createAccount: "Create account",
} as const;

export const footerWords = {
  legal: `© 2026 ${brand.name}.`,
  rights: "All rights reserved.",
  links: [
    { label: "Guide", href: routes.guide },
    { label: "What's new", href: routes.whatsNew },
    { label: "API", href: routes.developer },
    { label: "Enterprise", href: routes.enterprise },
    { label: "Pricing", href: routes.pricing },
  ],
} as const;
