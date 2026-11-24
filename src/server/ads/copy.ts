import type { BrandData, ProductData } from "./types";

/**
 * Ad copy: headlines, captions and calls to action, plus spoken-ad scripts.
 *
 * There is no language model in Parallax yet, so the writer behind `CopyWriter` fills
 * templates from the product and brand fields. A model-backed writer can replace it by
 * implementing the same interface and changing `copyWriter()`.
 */

export interface AdCopy {
  headline: string;
  caption: string;
  cta: string;
}

export interface CopyRequest {
  product: ProductData;
  brand: BrandData | null;
  /** Variation number, from 1. Different numbers give different wording. */
  seed: number;
}

export interface CopyWriter {
  /** Shown to the member: `template` for this writer. */
  readonly kind: string;
  write(req: CopyRequest): AdCopy;
  /** A script of roughly `seconds` seconds when read aloud (about 2.5 words a second). */
  script(req: CopyRequest, seconds: number): string;
}

const HEADLINES = [
  "{benefit}. Meet {name}.",
  "{name}: {benefit}",
  "{benefit}? That's {name}.",
  "Made for {audience}",
  "Why everyone is talking about {name}",
  "{name}. Small change, big difference.",
];

const CAPTIONS = [
  "{name} is {description}. {benefits}{price}",
  "Built for {audience}. {benefits} Try {name} today.",
  "{benefit}, without the fuss. That's {name}.{price}",
  "Say hello to {name}. {benefits}",
];

const CTAS: Record<string, string[]> = {
  playful: ["Grab yours", "Treat yourself", "Come take a look"],
  bold: ["Get it now", "Shop now", "Don't miss out"],
  calm: ["Learn more", "Discover {name}", "See how it works"],
  premium: ["Discover the collection", "Explore {name}", "Reserve yours"],
  default: ["Shop now", "Learn more", "Get yours", "Try it today"],
};

const SCRIPT_OPENERS = ["Okay, I have to tell you about {name}.", "Meet {name}.", "Here's something that changed my routine.", "Quick one about {name}. Listen up."];
const SCRIPT_CLOSERS = ["{cta} at {link}.", "{cta}. You'll love it.", "Give {name} a try. {cta}."];

function toneKey(tone: string): string {
  const t = tone.toLowerCase();
  if (/(fun|playful|cheeky|witty|light)/.test(t)) return "playful";
  if (/(bold|confident|energetic|loud|urgent)/.test(t)) return "bold";
  if (/(calm|gentle|warm|soft|honest)/.test(t)) return "calm";
  if (/(premium|luxur|elegant|refined)/.test(t)) return "premium";
  return "default";
}

const pick = <T,>(list: T[], seed: number): T => list[(Math.max(1, seed) - 1) % list.length];

function lowerFirst(s: string): string {
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

/** Benefits that use none of the brand's avoided words. */
function usableBenefits(req: CopyRequest): string[] {
  const avoid = (req.brand?.wordsToAvoid ?? []).map((w) => w.toLowerCase());
  const ok = req.product.benefits.filter((b) => !avoid.some((w) => b.toLowerCase().includes(w)));
  return ok.length ? ok : req.product.benefits;
}

function fill(tpl: string, req: CopyRequest, cta = ""): string {
  const p = req.product;
  const usable = usableBenefits(req);
  const benefits = usable.length ? usable : ["it just works"];
  const benefit = pick(benefits, req.seed);
  const vars: Record<string, string> = {
    name: p.name,
    description: lowerFirst(p.description.replace(/\.$/, "")) || "here to make your day easier",
    benefit: benefit.charAt(0).toUpperCase() + benefit.slice(1),
    benefitLower: lowerFirst(benefit),
    benefits: benefits.slice(0, 3).map((b) => b.charAt(0).toUpperCase() + b.slice(1).replace(/\.$/, "") + ".").join(" "),
    audience: p.audience || "people like you",
    price: p.price ? ` Now ${p.price}.` : "",
    link: hostOf(p.link),
    cta,
  };
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? "").replace(/\s+/g, " ").replace(/\.\./g, ".").trim();
}

function hostOf(link: string): string {
  try {
    return link ? new URL(link).host.replace(/^www\./, "") : "our site";
  } catch {
    return "our site";
  }
}

/** Drops words the brand avoids. Whole words, any case. */
function scrub(textIn: string, brand: BrandData | null): string {
  let out = textIn;
  for (const w of brand?.wordsToAvoid ?? []) {
    const esc = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(`\\b${esc}\\b`, "gi"), "");
  }
  return out.replace(/\s+([.,!?:])/g, "$1").replace(/\s+/g, " ").trim();
}

/** Prefers a template whose result uses none of the avoided words. */
function choose(templates: string[], req: CopyRequest, cta = ""): string {
  const avoid = (req.brand?.wordsToAvoid ?? []).map((w) => w.toLowerCase());
  for (let i = 0; i < templates.length; i++) {
    const out = fill(pick(templates, req.seed + i), req, cta);
    if (!avoid.some((w) => out.toLowerCase().includes(w))) return out;
  }
  return scrub(fill(pick(templates, req.seed), req, cta), req.brand);
}

export const templateWriter: CopyWriter = {
  kind: "template",
  write(req) {
    const cta = choose(CTAS[toneKey(req.brand?.tone ?? "")], req);
    let caption = choose(CAPTIONS, req);
    const use = req.brand?.wordsToUse ?? [];
    // Brand words go in as tags so they appear without bending the sentence.
    if (use.length) caption += " " + use.slice(0, 3).map((w) => "#" + w.replace(/[^\p{L}\p{N}]+/gu, "")).join(" ");
    return { headline: choose(HEADLINES, req).slice(0, 90), caption: caption.slice(0, 400), cta: cta.slice(0, 40) };
  },
  script(req, seconds) {
    const cta = choose(CTAS[toneKey(req.brand?.tone ?? "")], req);
    const lines = [choose(SCRIPT_OPENERS, req)];
    const usable = usableBenefits(req);
    const benefits = usable.length ? usable : [req.product.description || "it makes every day a little easier"];
    const budget = Math.max(8, Math.floor(seconds * 2.5));
    const words = () => lines.join(" ").split(/\s+/).length;
    for (let i = 0; i < benefits.length && words() < budget - 12; i++) {
      const b = benefits[(req.seed - 1 + i) % benefits.length].replace(/\.$/, "");
      lines.push(i === 0 ? `${b.charAt(0).toUpperCase() + b.slice(1)}.` : `Plus, ${lowerFirst(b)}.`);
    }
    lines.push(choose(SCRIPT_CLOSERS, req, cta));
    return scrub(lines.join(" "), req.brand);
  },
};

/** The writer in use. Swap this for a model-backed writer later. */
export function copyWriter(): CopyWriter {
  return templateWriter;
}
