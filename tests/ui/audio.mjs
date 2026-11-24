// The Audio page from first visit to finished mock speech and music.
// Run it with: python3 tests/run.py tests/ui/audio.mjs
// (the runner starts the app in mock mode and calls: node tests/ui/audio.mjs <base-url> <out-dir> [width] [height])
import { launch, scenario } from "./browser.mjs";

const [base, out, W = "1440", H = "900"] = process.argv.slice(2);
const b = await launch({ width: Number(W), height: Number(H), out });
const rows = `ul[aria-label="Your audio"] > li`;
const script = `#audio-form textarea`;
const count = (sel) => b.evaluate(`document.querySelectorAll(${JSON.stringify(sel)}).length`);
const noSideways = async () => {
  if (await b.evaluate(`document.documentElement.scrollWidth > window.innerWidth + 1`)) throw new Error("page is wider than the window");
};
const scrollTo = (sel) => b.evaluate(`document.querySelector(${JSON.stringify(sel)})?.scrollIntoView({ block: "center" })`);

let ok = false;
try {
  ok = await scenario(b, [
    ["open /audio and see the form and the explainer", async () => {
      await b.goto(`${base}/audio`);
      await b.until(`!!document.querySelector("h1") && !!document.querySelector(${JSON.stringify(script)})`, 15000, "form and hero");
      const tab = await b.evaluate(`document.querySelector('[role="tab"][aria-selected="true"]')?.textContent`);
      if (tab !== "Text to Speech") throw new Error(`open tab is "${tab}"`);
      if ((await count('[role="tab"]')) !== 2) throw new Error("expected two tabs");
      await b.sleep(700);
      await b.shot("01-empty");
      return `h1="${await b.evaluate(`document.querySelector("h1").textContent`)}"`;
    }],
    ["no sideways scroll", noSideways],
    ["Generate with no script says what is missing", async () => {
      await b.click("button", "Generate");
      await b.until(`!!document.querySelector('[role="alert"]')`, 5000, "an alert");
      await scrollTo('[role="alert"]');
      await b.shot("02-blocked");
      await b.click('[role="alert"] button', "Dismiss");
      await b.until(`!document.querySelector('[role="alert"]')`, 3000, "alert gone");
    }],
    ["the model list opens and picks another model", async () => {
      await b.click("button", "Model:");
      await b.until(`document.querySelectorAll('[role="option"]').length >= 3`, 5000, "model rows");
      await b.sleep(300);
      await b.shot("03-models");
      await b.click('[role="option"]', "Gemini 3.8 TTS");
      await b.until(`!!document.querySelector('button[aria-label="Model: Gemini 3.8 TTS"]')`, 3000, "the row names the new model");
      await b.until(`[...document.querySelectorAll("#audio-form label")].some((l) => l.textContent === "Delivery")`, 3000, "the delivery box");
      await b.shot("04-gemini");
      await b.click("button", "Model:");
      await b.until(`document.querySelectorAll('[role="option"]').length >= 3`, 5000, "model rows");
      await b.click('[role="option"]', "Speech 2.8 HD");
      await b.until(`!!document.querySelector('button[aria-label="Model: Speech 2.8 HD"]')`, 3000, "back on the first model");
    }],
    ["the voice menu sets a voice, Escape gives focus back", async () => {
      await b.click("button", "Voice:");
      await b.until(`document.querySelectorAll('[role="menu"] button').length >= 5`, 5000, "voices");
      await b.sleep(300);
      await b.shot("05-voices");
      await b.click('[role="menu"] button', "Storyteller");
      await b.until(`!!document.querySelector('button[aria-label="Voice: Storyteller"]')`, 3000, "voice set");
      await b.click("button", "Emotion:");
      await b.until(`document.querySelectorAll('[role="menu"] button').length >= 3`, 5000, "emotions");
      await b.key("Escape");
      await b.until(`document.querySelectorAll('[role="menu"]').length === 0`, 3000, "menu closed");
      const where = await b.evaluate(`document.activeElement?.getAttribute("aria-label") || ""`);
      if (!where.startsWith("Emotion")) throw new Error(`focus went to "${where}"`);
    }],
    ["advanced settings open", async () => {
      await b.click("button", "Advanced settings");
      await b.until(`[...document.querySelectorAll("#audio-form label")].some((l) => l.textContent.includes("Pitch"))`, 3000, "pitch slider");
      await scrollTo("#audio-form [aria-expanded]");
      await b.shot("06-advanced");
    }],
    ["typing a script counts characters and prices it", async () => {
      await b.click(script);
      await b.type("Welcome back. Tonight we walk the old harbour, one lamp at a time.");
      await b.until(`document.querySelector("#audio-form").innerText.includes("66 / 5,000")`, 3000, "the character count");
      const label = await b.evaluate(`[...document.querySelectorAll("button")].find((x) => (x.getAttribute("aria-label") || "").startsWith("Generate"))?.getAttribute("aria-label")`);
      if (!/credits/.test(label ?? "")) throw new Error(`Generate says "${label}"`);
      await b.shot("07-typed");
      return label;
    }],
    ["generate speech: pending, then a player", async () => {
      await b.click("button", "Generate");
      await b.until(`document.querySelectorAll('${rows}').length >= 1`, 15000, "a row");
      await b.sleep(300);
      await b.shot("08-pending");
      await b.until(`!!document.querySelector('${rows} audio')`, 60000, "a finished track");
      await b.sleep(500);
      await b.shot("09-done");
    }],
    ["play, pause and seek", async () => {
      await b.click(`${rows} button`, "Play:");
      await b.sleep(800);
      const state = await b.evaluate(`(() => { const a = document.querySelector('${rows} audio'); return a ? (a.paused ? "paused" : "playing") + " at " + a.currentTime.toFixed(1) + " of " + a.duration : "none"; })()`);
      const pressed = await b.evaluate(`document.querySelector('${rows} button[aria-pressed]')?.getAttribute("aria-pressed")`);
      await b.shot("10-playing");
      if (pressed === "true") {
        await b.click(`${rows} button`, "Pause:");
        await b.until(`document.querySelector('${rows} audio').paused`, 3000, "paused");
      }
      const hasTime = await b.evaluate(`/\\d:\\d\\d \\/ \\d:\\d\\d/.test(document.querySelector('${rows}').innerText)`);
      if (!hasTime) throw new Error("no time shown");
      return `${state}, pressed=${pressed}`;
    }],
    ["favourite a track and filter by it", async () => {
      await b.click(`${rows} button`, "Add to favourites");
      await b.until(`!!document.querySelector('${rows} button[aria-label="Remove from favourites"]')`, 5000, "marked");
      await b.click("button", "Filters");
      await b.until(`document.querySelectorAll('[role="menuitemradio"], [data-radix-popper-content-wrapper] button').length >= 4`, 5000, "filter menu");
      await b.click("[data-radix-popper-content-wrapper] button", "Favourites");
      await b.until(`document.querySelectorAll('${rows}').length === 1`, 5000, "one favourite");
      await b.shot("11-favourites");
      await b.click("button", "Filters");
      await b.until(`document.querySelectorAll('[data-radix-popper-content-wrapper] button').length >= 4`, 5000, "filter menu");
      await b.click("[data-radix-popper-content-wrapper] button", "Everything");
    }],
    ["a failing script shows the failure", async () => {
      await b.evaluate(`document.querySelector(${JSON.stringify(script)}).focus()`);
      await b.evaluate(`document.execCommand("selectAll")`);
      await b.type("This one should fail [fail]");
      await b.click("button", "Generate");
      await b.until(`document.querySelector('${rows}')?.innerText.includes("Try it again")`, 60000, "a failed row");
      await b.sleep(300);
      await b.shot("12-failed");
    }],
    ["remove the failed row", async () => {
      const before = await count(rows);
      await b.click(`${rows} button`, "Remove");
      await b.until(`document.querySelectorAll('${rows}').length === ${before - 1}`, 5000, "one fewer row");
    }],
    ["use these settings brings the script back", async () => {
      await b.evaluate(`document.querySelector(${JSON.stringify(script)}).focus()`);
      await b.evaluate(`document.execCommand("selectAll")`);
      await b.type("x");
      await b.click(`${rows} button`, "Use these settings");
      await b.until(`document.querySelector(${JSON.stringify(script)}).value.includes("old harbour")`, 3000, "script back in the box");
      await b.until(`!!document.querySelector('button[aria-label="Voice: Storyteller"]')`, 3000, "voice back");
    }],
    ["the Music tab has its own model, batch size and lyrics", async () => {
      await b.click('[role="tab"]', "Music");
      await b.until(`document.querySelector('[role="tab"][aria-selected="true"]')?.textContent === "Music"`, 3000, "music tab");
      await b.until(`!!document.querySelector('button[aria-label^="Model: Lyria"]')`, 3000, "a music model");
      await b.until(`document.body.innerText.includes("Batch size")`, 3000, "batch size");
      await b.click("button", "One more");
      await b.until(`!!document.querySelector('[aria-label="2 of 2"]')`, 3000, "two");
      await b.click('#audio-form [role="switch"]');
      await b.until(`[...document.querySelectorAll("#audio-form label")].some((l) => l.textContent === "Lyrics")`, 3000, "lyrics box");
      await b.shot("13-music");
      await b.click(script);
      await b.type("Warm lo-fi beat, soft piano, rain on the window, 80 bpm");
      await b.click("button", "Generate");
      await b.until(`document.querySelectorAll('${rows} audio').length >= 3`, 90000, "two music tracks");
      await b.sleep(500);
      await b.shot("14-music-done");
    }],
    ["How it works shows the explainer", async () => {
      await b.click("button", "How it works");
      await b.until(`!!document.querySelector("h1") && document.querySelectorAll("article").length === 2`, 3000, "two cards");
      await b.sleep(300);
      await b.shot("15-how");
      await b.click("button", "History");
      await b.until(`document.querySelectorAll('${rows}').length >= 3`, 3000, "history back");
    }],
    ["remove a finished track asks first", async () => {
      const before = await count(rows);
      await b.click(`${rows} button`, "Remove");
      await b.until(`!!document.querySelector('[role="dialog"]')`, 3000, "a confirm window");
      await b.sleep(300);
      await b.shot("16-confirm");
      await b.click('[role="dialog"] button', "Remove for good");
      await b.until(`document.querySelectorAll('${rows}').length === ${before - 1}`, 5000, "one fewer row");
    }],
    ["no sideways scroll with results", noSideways],
    ["the balance went down", async () => {
      const me = JSON.parse(await b.evaluate(`fetch("/api/auth/me").then((r) => r.text())`));
      if (!(me.balance < 60000)) throw new Error(`balance is ${me.balance}`);
      return `balance ${me.balance}`;
    }],
    ["reload keeps the history; ?tab=music opens Music", async () => {
      await b.goto(`${base}/audio?tab=music`);
      await b.until(`document.querySelectorAll('${rows} audio').length >= 2`, 15000, "tracks after reload");
      await b.until(`document.querySelector('[role="tab"][aria-selected="true"]')?.textContent === "Music"`, 3000, "music tab");
      await b.sleep(500);
      await b.shot("17-reload");
    }],
  ]);
} finally {
  await b.close();
}
process.exit(ok ? 0 : 1);
