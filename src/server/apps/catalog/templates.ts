/** Templates: fill in a few words and get a finished piece (poster, thumbnail, card, jingle). */
import type { AppDef } from "../types";
import { app, choice, colour, input, text } from "./helpers";

const LAYOUT = "gpt-image-2.5-flare";

export const templateApps: AppDef[] = [
  app({
    id: "event-poster", name: "Event poster", category: "template",
    pitch: "A finished poster with your title and date, lettered properly.",
    tags: ["poster", "text", "design"], modelId: LAYOUT, values: { aspect: "2:3", quality: "medium", background: "auto" },
    fields: [
      text("title", "Title", { required: true, placeholder: "Night Market", maxLength: 60 }),
      text("details", "Date and place", { placeholder: "Sat 14 June · Harbour Square", maxLength: 80 }),
      choice("style", "Style", ["Swiss grid", "Retro risograph", "Art nouveau", "Neon nightlife", "Hand-drawn"]),
      colour("main", "Main colour", "#e4572e"),
    ],
    template: "A {{style}} event poster. Large headline text reading \"{{title}}\". {{?details}}Smaller text reading \"{{details}}\".{{/details}} Main colour {{main}}. Clean, legible lettering.",
  }),
  app({
    id: "thumbnail", name: "Video thumbnail", category: "template", badge: "trending",
    pitch: "A bold thumbnail with a headline and, if you like, your face.",
    tags: ["youtube", "text", "social"], modelId: LAYOUT, values: { aspect: "16:9", quality: "medium", background: "auto" },
    inputs: [input("face", "Your photo", "refs", { min: 0, hint: "Optional. Put yourself on the thumbnail." })],
    fields: [
      text("headline", "Headline", { required: true, placeholder: "I tried it for 30 days", maxLength: 50 }),
      text("topic", "Topic", { placeholder: "Cold showers", maxLength: 80 }),
    ],
    template: "A high-contrast video thumbnail with large bold text reading \"{{headline}}\". {{?topic}}Topic: {{topic}}.{{/topic}} If a reference photo is given, feature that person with an expressive face.",
  }),
  app({
    id: "greeting-card", name: "Greeting card", category: "template",
    pitch: "A card for any occasion, with your own message.",
    tags: ["card", "occasion", "text"], modelId: LAYOUT, values: { aspect: "3:4", quality: "medium", background: "auto" },
    fields: [
      choice("occasion", "Occasion", ["Birthday", "Thank you", "Wedding", "New baby", "Holidays", "Get well"]),
      text("message", "Message", { required: true, placeholder: "Happy birthday, Sam!", maxLength: 80 }),
      choice("style", "Style", ["Watercolour florals", "Minimal line art", "Playful cartoon", "Gold foil"]),
    ],
    template: "A {{occasion}} greeting card front, {{style}} style, with the lettering \"{{message}}\" clearly written.",
  }),
  app({
    id: "sticker-pack", name: "Sticker pack", category: "template",
    pitch: "Six expressive stickers of your character on one sheet.",
    tags: ["sticker", "character", "emoji"], modelId: "nano-banana-2", values: { aspect: "1:1", resolution: "1K" },
    inputs: [input("photo", "Character", "refs", { hint: "You, your pet or a drawn character." })],
    fields: [choice("style", "Style", ["Cartoon", "Chibi", "Flat vector"]), colour("outline", "Outline colour", "#ffffff")],
    template: "A sheet of six die-cut stickers of the character in the reference image, {{style}} style, each with a different expression (happy, laughing, surprised, sad, angry, love), thick {{outline}} outline, plain background.",
  }),
  app({
    id: "comic-strip", name: "Comic strip", category: "template",
    pitch: "A four-panel comic from a one-line story.",
    tags: ["comic", "story", "text"], modelId: LAYOUT, values: { aspect: "1:1", quality: "medium", background: "auto" },
    fields: [
      text("story", "Story", { required: true, placeholder: "A cat tries to catch the moon", maxLength: 240 }),
      choice("style", "Style", ["Newspaper strip", "Manga", "Graphic novel", "Children's book"]),
    ],
    template: "A four-panel {{style}} comic strip with speech bubbles telling this story: {{story}}.",
  }),
  app({
    id: "seamless-pattern", name: "Seamless pattern", category: "template",
    pitch: "A repeating pattern for fabric, wrapping paper or wallpaper.",
    tags: ["pattern", "textile", "design"], modelId: "flux-schnell", values: { aspect: "1:1" },
    fields: [
      text("motif", "Motif", { required: true, placeholder: "Lemons and leaves", maxLength: 120 }),
      colour("ground", "Background colour", "#f5efe0"),
      colour("ink", "Main colour", "#2f5d50"),
    ],
    template: "A seamless repeating tile pattern of {{motif}}, flat illustration, {{ink}} motifs on a {{ground}} background, even spacing, no text.",
  }),
  app({
    id: "tattoo-idea", name: "Tattoo idea", category: "template",
    pitch: "Flash-sheet tattoo designs from a few words.",
    tags: ["tattoo", "design", "line art"], modelId: "flux-schnell", values: { aspect: "1:1" },
    fields: [
      text("subject", "Subject", { required: true, placeholder: "A swallow carrying a key", maxLength: 120 }),
      choice("style", "Style", ["Fine line", "Old school", "Blackwork", "Japanese", "Dotwork"]),
    ],
    template: "A {{style}} tattoo flash design of {{subject}}, clean black lines on white paper, no skin.",
  }),
  app({
    id: "shop-listing", name: "Shop listing set", category: "template", badge: "new", added: "2026-11-10",
    pitch: "A clean, square catalogue shot of a product on white.",
    tags: ["product", "ecommerce", "white background"], modelId: "nano-banana-2", values: { aspect: "1:1", resolution: "1K" },
    inputs: [input("product", "Product photo", "refs")],
    fields: [choice("view", "View", ["Front", "Three-quarter", "Top down", "Detail close-up"])],
    template: "A clean e-commerce catalogue photo of the product from the reference image on a pure white background, {{view}} view, soft even light and a light contact shadow.",
  }),
  app({
    id: "jingle", name: "Jingle", category: "template",
    pitch: "A short instrumental sting for an intro or an ad.",
    tags: ["music", "audio", "intro"], modelId: "lyria-3-clip", values: { instrumental: true },
    fields: [
      choice("genre", "Genre", ["Upbeat pop", "Lo-fi", "Orchestral", "Synthwave", "Acoustic folk"]),
      text("mood", "Mood", { placeholder: "Bright and hopeful", maxLength: 80 }),
    ],
    template: "A short {{genre}} jingle for a show intro. {{?mood}}Mood: {{mood}}.{{/mood}}",
  }),
  app({
    id: "voiceover", name: "Voice-over", category: "template",
    pitch: "Read your script aloud in a clear narrator voice.",
    tags: ["voice", "audio", "narration"], modelId: "minimax-speech-2.8-turbo", open: ["voice", "speed"], values: { emotion: "auto", pitch: 0 },
    fields: [text("script", "Script", { required: true, default: "Welcome to the show.", placeholder: "Welcome to the show.", maxLength: 1000 })],
    template: "{{script}}",
  }),
];
