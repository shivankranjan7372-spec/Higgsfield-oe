/**
 * The words and lists on the home page (/) and the Explore feed (/explore). Layout and style
 * come from the design; everything here is Parallax's own. Pictures are `Artwork` slots,
 * named in each entry, so they can be filled in later without touching the components.
 */
import { brand } from "@/config/brand";
import { routes } from "@/content/site";

export interface HomeSlide {
  id: string;
  title: string;
  sub: string;
  href: string;
  /** The `Artwork` slot behind the slide. */
  art: string;
}

/** The hero carousel. Each slide points at one of Parallax's own studios or pages. */
export const heroSlides: HomeSlide[] = [
  { id: "image", title: `${brand.name} Image`, sub: "Every image model in one composer, with the price shown first.", href: routes.image, art: "home/slide-image" },
  { id: "video", title: `${brand.name} Video`, sub: "Turn a line of text or a still into a moving shot.", href: routes.video, art: "home/slide-video" },
  { id: "cinema", title: "Shot Planner", sub: "Plan the scene, set the camera, then roll.", href: routes.cinema, art: "home/slide-cinema" },
  { id: "remix", title: `${brand.name} Remix`, sub: "One upload in, as many takes as you like out.", href: routes.remix, art: "home/slide-remix" },
  { id: "audio", title: `${brand.name} Audio`, sub: "Voices and music for everything you make.", href: routes.audio, art: "home/slide-audio" },
];

export const carouselWords = {
  label: "Featured studios",
  previous: "Previous slide",
  next: "Next slide",
  goTo: (n: number, of: number) => `Slide ${n} of ${of}`,
};

/**
 * The offer card. The code, end time and link come from `promo` in site.ts. The offer is off
 * by default, so the card shows `after`; the offer lines are placeholders.
 */
export const promoCard = {
  timerLabel: "Offer ends in",
  lineOne: "Sample offer",
  lineTwo: "Free credits",
  body: (code: string) =>
    `Sample text: create your free account and enter the code ${code} to add credits for any studio.`,
  /** The same offer, said to someone who already has an account. */
  memberBody: (code: string) =>
    `Sample text: enter the code ${code} in your wallet to add credits for any studio.`,
  sticker: (code: string) => ["Use code", code],
  /** Shown instead once the offer is over. */
  after: {
    lineOne: "Start free",
    lineTwo: "No card needed",
    body: "Make an account in a few seconds and try every studio. See the price of each generation before you press Generate.",
    cta: "Create your free account",
    /** For someone who already has an account. */
    memberBody: "Every studio is open to you. See the price of each generation before you press Generate.",
    memberCta: "Start creating",
  },
};

export interface FeatureTile {
  id: string;
  title: string;
  sub: string;
  href: string;
  icon: "remix" | "video" | "agent" | "cinema" | "mcp" | "horizon";
  /** The small label after the title, matching the top nav. */
  tag?: { label: string; tone: "brand" | "neutral" };
}

/** The six tiles beside the offer card. */
export const featureTiles: FeatureTile[] = [
  { id: "remix", title: `${brand.name} Remix`, sub: "One clip, many takes", href: routes.remix, icon: "remix", tag: { label: "Top", tone: "brand" } },
  { id: "video", title: `${brand.name} Video`, sub: "Text and stills into motion", href: routes.video, icon: "video" },
  { id: "agent", title: "Agent", sub: "An assistant that runs whole projects", href: routes.agent, icon: "agent" },
  { id: "cinema", title: "Shot Planner", sub: "Shots with real camera moves", href: routes.cinema, icon: "cinema" },
  { id: "mcp", title: `${brand.name} MCP`, sub: "Generate from the assistant you already use", href: routes.mcp, icon: "mcp" },
  { id: "horizon", title: `${brand.name} Horizon`, sub: "A new way to edit, in the works", href: routes.horizon, icon: "horizon", tag: { label: "Soon", tone: "neutral" } },
];

/** The big black MCP panel. */
export const mcpShowcase = {
  lineOne: brand.name,
  lineTwo: "MCP",
  sub: "In the assistant you already use",
  primary: { label: "Connect the MCP", href: routes.mcp },
  secondary: { label: "Read the API", href: routes.developer },
  seeAll: { label: "See all", href: routes.mcp },
  cards: [
    { id: "storyboard", title: "Storyboard a short film from a script", chips: ["Image", "Video"], art: "home/mcp-storyboard", wash: "#3B4A63E6" },
    { id: "product", title: "Shoot a product set for a shop", chips: ["Image", "Batch"], art: "home/mcp-product", wash: "#5C4A3AE6" },
    { id: "podcast", title: "Voice a podcast intro with music", chips: ["Speech", "Music"], art: "home/mcp-podcast", wash: "#4A3B63E6" },
    { id: "game", title: "Draw the sprites for a browser game", chips: ["Image", "Code"], art: "home/mcp-game", wash: "#3A5C4AE6" },
    { id: "trailer", title: "Cut a teaser", chips: ["Video"], art: "home/mcp-trailer", wash: "#00000000" },
    { id: "covers", title: "Album covers", chips: ["Image"], art: "home/mcp-covers", wash: "#00000000" },
    { id: "explainer", title: "Explainer", chips: ["Video"], art: "home/mcp-explainer", wash: "#00000000" },
    { id: "ads", title: "Ad set", chips: ["Image"], art: "home/mcp-ads", wash: "#00000000" },
  ],
};

export const contestBanner = {
  eyebrow: "Open contest",
  closesIn: "Closes in",
  prize: "Prize",
  cta: "See the contest",
};

/** How a community grid is drawn. */
export type GridLook = "shorts" | "mosaic" | "wide" | "masonry";

export interface FeedSectionDef {
  id: string;
  title: string;
  sub: string;
  look: GridLook;
  /** The query sent to GET /api/explore. */
  query: Record<string, string>;
  more: { label: string; href: string };
  /** Two big buttons beside the heading (the mosaic section). */
  actions?: { label: string; href: string; tone: "lime" | "white" }[];
  /** Words for the empty state, and where its button goes. */
  empty: { line: string; cta: string; href: string };
}

export const feedSections: Record<string, FeedSectionDef> = {
  shorts: {
    id: "shorts",
    title: `${brand.name} Shorts`,
    sub: "Short vertical videos the community made this week. Hover one to play it, then make your own.",
    look: "shorts",
    query: { tab: "trending", kind: "video" },
    more: { label: "Make a short", href: routes.shorts },
    empty: { line: "No videos shared yet. Make one and be the first on this wall.", cta: "Make a video", href: routes.video },
  },
  trending: {
    id: "trending",
    title: "Trending in the community",
    sub: "What people are liking, saving and talking about right now. Open any piece to see how it was made.",
    look: "mosaic",
    query: { tab: "trending" },
    more: { label: "Open Explore", href: routes.explore },
    actions: [
      { label: "Start creating", href: routes.image, tone: "lime" },
      { label: "Learn more", href: routes.guide, tone: "white" },
    ],
    empty: { line: "Nothing has been shared yet. Your work could open this wall.", cta: "Start creating", href: routes.image },
  },
  fresh: {
    id: "fresh",
    title: "Fresh from the community",
    sub: "The newest work, with the prompt and model behind each piece",
    look: "wide",
    query: { tab: "new" },
    more: { label: "Explore community", href: routes.explore },
    empty: { line: "No posts yet. Publish something from your library to be the first.", cta: "Open your library", href: routes.library },
  },
  video: {
    id: "video",
    title: `${brand.name} Video`,
    sub: "The most liked videos this week",
    look: "masonry",
    query: { tab: "top", period: "week", kind: "video" },
    more: { label: "View all videos", href: `${routes.explore}?kind=video` },
    empty: { line: "No videos shared this week yet. Make the first one.", cta: "Make a video", href: routes.video },
  },
  image: {
    id: "image",
    title: `${brand.name} Image`,
    sub: "The most liked images this week",
    look: "masonry",
    query: { tab: "top", period: "week", kind: "image" },
    more: { label: "View all images", href: `${routes.explore}?kind=image` },
    empty: { line: "No images shared this week yet. Make the first one.", cta: "Make an image", href: routes.image },
  },
  month: {
    id: "month",
    title: "Best of the month",
    sub: "The most liked work of the last thirty days",
    look: "masonry",
    query: { tab: "top", period: "month" },
    more: { label: "View the top of the month", href: `${routes.explore}?tab=top&period=month` },
    empty: { line: "Nothing has been liked this month yet. Share something people will love.", cta: "Start creating", href: routes.image },
  },
};

/** A section for one of the models people use most. Only drawn when that model has posts. */
export const modelSection = {
  sub: (posts: number) => `Made with this model by the community: ${new Intl.NumberFormat("en").format(posts)} ${posts === 1 ? "post" : "posts"}`,
  more: (name: string) => `View all of ${name}`,
};

/** The two wide banners between the grids. */
export const banners = {
  canvas: {
    eyebrow: "New feature",
    lines: ["Plan it out.", "Then make it."],
    sub: ["Pin pictures and notes, link the steps,", "and keep each project on its own board"],
    cta: { label: "Try Boards", href: routes.canvas },
    art: "home/banner-canvas",
  },
  cinema: {
    tag: "Shot Planner",
    lines: ["Same cast", "every scene"],
    sub: "Set your characters once. Every shot keeps them.",
    cta: { label: "Open Shot Planner", href: routes.cinema },
    art: "home/banner-cinema",
  },
};

/** The chips at the bottom: every place in Parallax. */
export const moreFeatures = {
  title: "More from Parallax",
  links: [
    { label: "Image", href: routes.image },
    { label: "Video", href: routes.video },
    { label: "Audio", href: routes.audio },
    { label: "Shot Planner", href: routes.cinema },
    { label: "Remix", href: routes.remix },
    { label: "Shorts", href: routes.shorts },
    { label: "Ad Campaigns", href: routes.ads },
    { label: "Agent", href: routes.agent },
    { label: "Boards", href: routes.canvas },
    { label: "Apps", href: routes.apps },
    { label: "Horizon", href: routes.horizon },
    { label: "Contests", href: routes.contests },
    { label: "Community", href: routes.community },
    { label: "Explore", href: routes.explore },
    { label: "Library", href: routes.library },
    { label: "MCP", href: routes.mcp },
    { label: "API", href: routes.developer },
    { label: "Guide", href: routes.guide },
    { label: "What's new", href: routes.whatsNew },
    { label: "Pricing", href: routes.pricing },
    { label: "Enterprise", href: routes.enterprise },
    { label: "Invite friends", href: routes.invite },
  ],
};

/** Words on a community tile and in the feed states. */
export const tileWords = {
  by: (name: string) => `by ${name}`,
  likes: (n: string) => `${n} likes`,
  views: (n: string) => `${n} views`,
  like: "Like",
  unlike: "Remove like",
  save: "Save",
  unsave: "Remove from saved",
  untitled: "Untitled",
  loadError: "The feed did not load.",
  retry: "Try again",
};

/** The Explore page. */
export const exploreWords = {
  title: "Explore",
  sub: `Work shared by people making things with ${brand.name}`,
  tabs: [
    { id: "trending", label: "Trending" },
    { id: "new", label: "New" },
    { id: "top", label: "Top" },
    { id: "following", label: "Following" },
  ],
  periods: [
    { id: "day", label: "Today" },
    { id: "week", label: "This week" },
    { id: "month", label: "This month" },
    { id: "all", label: "All time" },
  ],
  kinds: [
    { id: "", label: "All" },
    { id: "image", label: "Images" },
    { id: "video", label: "Videos" },
    { id: "audio", label: "Audio" },
  ],
  modelLabel: "Model",
  anyModel: "Any model",
  tagsLabel: "Popular tags",
  clearTag: "Clear tag",
  loadingMore: "Loading more",
  end: "You have reached the end.",
  empty: {
    line: "Nothing here yet. Make something and share it to be the first.",
    cta: "Start creating",
    href: routes.image,
  },
  followingSignedOut: {
    line: "Sign in to see new work from the members you follow.",
    cta: "Create your free account",
  },
  followingEmpty: {
    line: "Nobody you follow has shared anything yet. Find members you like on Trending.",
    cta: "See what is trending",
  },
  signInToLike: "Create a free account to like and save work.",
};
