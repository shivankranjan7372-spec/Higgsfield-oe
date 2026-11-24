/**
 * Everything that names the product lives here, so a rename is a one-file change.
 * This is an original brand. It reuses no name, logo, copy or artwork from any other product.
 */
export const brand = {
  name: "Parallax",
  tagline: "One studio for every generative model.",
  description:
    "An open-source creative studio. Pick a model, set the shot, see the price before you press Generate.",
  /** Shown in the footer and the About dialog. */
  repoUrl: "",
  creditName: "credit",
  creditNamePlural: "credits",
} as const;

export interface NavItem {
  href: string;
  label: string;
  /** Short line shown under the label in menus and on the home page. */
  blurb: string;
}

/** Top-level destinations. Feature teams add pages under these paths. */
export const primaryNav: NavItem[] = [
  { href: "/explore", label: "Explore", blurb: "What people are making right now" },
  { href: "/image", label: "Image", blurb: "Stills from text and references" },
  { href: "/video", label: "Video", blurb: "Shots from text, frames and references" },
  { href: "/audio", label: "Audio", blurb: "Voices and music" },
  { href: "/apps", label: "Apps", blurb: "One-click tools built on the models" },
  { href: "/library", label: "Library", blurb: "Everything you have made" },
];
