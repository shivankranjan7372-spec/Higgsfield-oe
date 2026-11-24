/** Effects: one tap, a fixed transformation applied to the member's own picture. */
import type { AppDef } from "../types";
import { app, photo, still } from "./helpers";

function videoEffect(id: string, name: string, pitch: string, tags: string[], action: string, added = "2026-10-01"): AppDef {
  return app({
    id, name, pitch, tags: ["effect", ...tags], category: "effect", added,
    modelId: "seedance-1-lite", open: ["aspect"], values: { aspect: "9:16", duration: 5, resolution: "720p" },
    inputs: [still("Your picture", "A person, pet or object, clearly visible.")],
    template: `Starting from the image: ${action} Keep the subject recognisable.`,
  });
}

function imageEffect(id: string, name: string, pitch: string, tags: string[], look: string): AppDef {
  return app({
    id, name, pitch, tags: ["effect", ...tags], category: "effect",
    modelId: "nano-banana-2", values: { aspect: "1:1", resolution: "1K" },
    inputs: [photo("Your picture")],
    template: `Transform the subject of the reference image into ${look} Keep their recognisable features.`,
  });
}

export const effectApps: AppDef[] = [
  videoEffect("levitate", "Levitate", "Your subject slowly floats up off the ground.", ["float", "magic"], "the subject lifts gently off the ground and floats upward, clothes and hair drifting weightlessly."),
  videoEffect("melt", "Melt", "Everything slowly melts like warm wax.", ["surreal"], "the subject slowly melts like warm wax, dripping down into a glossy puddle."),
  videoEffect("turn-to-stone", "Turn to stone", "A wave of stone spreads over the subject.", ["transform"], "a wave of grey stone spreads over the subject until they become a still statue."),
  videoEffect("confetti-burst", "Confetti burst", "Bursts into a cloud of colourful confetti.", ["party", "celebrate"], "the subject bursts joyfully into a swirling cloud of colourful confetti that drifts down.", "2026-11-02"),
  videoEffect("dust-away", "Turn to dust", "Drifts away as fine glowing dust.", ["dramatic"], "the subject breaks apart into fine glowing dust carried away by the wind."),
  videoEffect("hologram", "Hologram", "Flickers into a blue sci-fi hologram.", ["sci-fi", "glitch"], "the subject flickers and turns into a translucent blue hologram with scan lines and glitches."),
  videoEffect("inflate", "Inflate", "Puffs up like a party balloon.", ["funny"], "the subject inflates like a balloon, bobbing comically upward."),
  videoEffect("hero-flight", "Hero take-off", "Crouches, then launches into the sky.", ["superhero", "action"], "the subject crouches and launches into the sky like a superhero, dust blasting outward."),
  videoEffect("fire-aura", "Fire aura", "Wreathed in a swirl of harmless flame.", ["fire", "power"], "a swirling aura of bright flames rises around the subject without burning them."),
  videoEffect("earth-zoom", "Zoom to orbit", "The camera rockets up from the subject to space.", ["camera", "space"], "the camera rockets straight up from the subject, through the clouds, to a view of the whole planet.", "2026-11-06"),
  videoEffect("underwater", "Underwater", "The scene floods and the subject floats among bubbles.", ["water", "dreamy"], "water fills the scene, the subject floats gently among bubbles and caustic light."),
  videoEffect("squish", "Squish", "Squashed flat like soft dough, then pops back.", ["funny"], "a giant hand presses the subject flat like soft dough, then they pop back into shape."),
  imageEffect("clay-me", "Clay me", "You, as a hand-made clay figure.", ["clay", "3d"], "a hand-made stop-motion clay figure on a tiny set."),
  imageEffect("action-figure", "Boxed figure", "You, as a collectible figure in its box.", ["toy", "collectible"], "a collectible action figure in a clear-window retail box with accessories beside it."),
  imageEffect("pet-portrait", "Royal pet portrait", "Your pet as a noble oil portrait.", ["pet", "painting"], "a regal Renaissance oil portrait, wearing a velvet cape and a small crown, gilded frame."),
  imageEffect("pixel-hero", "Pixel hero", "You, as a character in a retro game.", ["game", "pixel"], "a 16-bit pixel art video game hero standing in a side-scrolling level."),
  imageEffect("plush", "Plush toy", "You, as a soft plush toy.", ["toy", "cute"], "a soft, stitched plush toy sitting on a bed."),
];
