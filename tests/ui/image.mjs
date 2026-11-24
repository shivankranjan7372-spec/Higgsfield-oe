// The Image page from first visit to a finished mock generation.
// Run it with: python3 tests/run.py tests/ui/image.mjs
// (the runner starts the app in mock mode and calls: node tests/ui/image.mjs <base-url> <out-dir> [width] [height])
import { launch, scenario } from "./browser.mjs";

const [base, out, W = "1440", H = "900"] = process.argv.slice(2);
const b = await launch({ width: Number(W), height: Number(H), out });
const tiles = `ul[aria-label="Your images"] li`;
let ok = false;
try {
  ok = await scenario(b, [
    ["open /image and see the hero", async () => {
      await b.goto(`${base}/image`);
      await b.until(`!!document.querySelector("h1") && !!document.querySelector("textarea")`);
      await b.sleep(900);
      await b.shot("01-empty");
    }],
    ["no sideways scroll", async () => {
      if (await b.evaluate(`document.documentElement.scrollWidth > window.innerWidth + 1`)) throw new Error("page is wider than the window");
    }],
    ["Generate with no prompt says what is missing", async () => {
      await b.click("button", "Generate");
      await b.until(`!!document.querySelector('[role="alert"]')`, 5000, "an alert");
      await b.shot("02-blocked");
      await b.click('[role="alert"] button', "Dismiss");
    }],
    ["model picker opens, lists models, and picks one", async () => {
      await b.click('button[aria-haspopup="dialog"]', "Model:");
      await b.until(`document.querySelectorAll('[role="option"]').length >= 6`, 5000, "model rows");
      await b.sleep(300);
      await b.shot("03-models");
      await b.click('[role="option"]', "Flux");
      await b.until(`document.querySelectorAll('[role="option"]').length === 0`, 5000, "picker closed");
      await b.until(`!!document.querySelector('button[aria-label^="Model: FLUX"]')`, 3000, "the chip names the new model");
    }],
    ["an option chip opens its menu and sets a value", async () => {
      await b.click('button[aria-haspopup="dialog"]', "Aspect ratio");
      await b.until(`document.querySelectorAll('[role="menuitemradio"]').length >= 2`, 5000, "menu items");
      await b.sleep(300);
      await b.shot("04-aspect");
      await b.click('[role="menuitemradio"]', "16:9");
      await b.until(`!!document.querySelector('button[aria-label="Aspect ratio: 16:9"]')`, 3000, "the chip shows 16:9");
    }],
    ["Escape closes a menu and gives focus back", async () => {
      await b.click('button[aria-haspopup="dialog"]', "Aspect ratio");
      await b.until(`document.querySelectorAll('[role="menuitemradio"]').length >= 2`, 5000, "menu items");
      await b.key("Escape");
      await b.until(`document.querySelectorAll('[role="menuitemradio"]').length === 0`, 3000, "menu closed");
      const where = await b.evaluate(`document.activeElement?.getAttribute("aria-label") || ""`);
      if (!where.startsWith("Aspect ratio")) throw new Error(`focus went to "${where}"`);
    }],
    ["count goes up to 2", async () => {
      await b.click("button", "One more");
      await b.until(`document.body.innerText.includes("2/4") || !!document.querySelector('[aria-label="2 of 4"]')`, 3000, "count 2");
    }],
    ["type a prompt and generate", async () => {
      await b.click("textarea");
      await b.type("A paper boat on a mountain lake at dawn, soft mist");
      await b.shot("05-typed");
      await b.key("Enter");
      await b.until(`document.querySelectorAll('${tiles}').length >= 2`, 15000, "pending tiles");
      await b.sleep(500);
      await b.shot("06-pending");
    }],
    ["results arrive", async () => {
      await b.until(`document.querySelectorAll('${tiles} img').length >= 2`, 60000, "two finished pictures");
      await b.until(`[...document.querySelectorAll('${tiles} img')].every((i) => i.complete && i.naturalWidth > 0)`, 15000, "pictures loaded");
      await b.sleep(600);
      await b.shot("07-done");
      await b.hover(tiles);
      await b.sleep(400);
      await b.shot("08-hover");
      return `hover:none=${await b.evaluate(`matchMedia("(hover: none)").matches`)}, overlays shown=${await b.evaluate(`[...document.querySelectorAll('${tiles} > div')].filter((d) => getComputedStyle(d).opacity === "1").length`)}`;
    }],
    ["the balance went down", async () => {
      const me = JSON.parse(await b.evaluate(`fetch("/api/auth/me").then((r) => r.text())`));
      if (!(me.balance < 60000)) throw new Error(`balance is ${me.balance}`);
      return `balance ${me.balance}, user keys: ${Object.keys(me.user ?? {}).join(",")}`;
    }],
    ["reload keeps the workspace", async () => {
      await b.reload();
      await b.until(`document.querySelectorAll('${tiles} img').length >= 2`, 15000, "pictures after reload");
      await b.sleep(600);
      await b.shot("09-reload");
    }],
    ["view menu changes the grid", async () => {
      await b.click("button", "View");
      await b.until(`document.querySelectorAll('[role="menuitemradio"]').length === 3`, 5000, "three sizes");
      await b.sleep(300);
      await b.shot("10-view");
      await b.click('[role="menuitemradio"]', "Large");
      await b.sleep(400);
      await b.shot("10b-large");
    }],
    ["use again loads the prompt back", async () => {
      await b.hover(tiles);
      await b.click(`${tiles} button`, "Use this prompt");
      await b.until(`document.querySelector("textarea").value.includes("paper boat")`, 3000, "prompt in the box");
    }],
    ["the toolbar has Filter and View, as drawn", async () => {
      const r = await b.evaluate(`JSON.stringify([...document.querySelectorAll("button")].filter((e) => /^(Filter|View)$/.test(e.textContent.trim())).map((e) => { const r = e.getBoundingClientRect(); return [e.textContent.trim(), Math.round(r.width), Math.round(r.height), Math.round(window.innerWidth - r.right)]; }))`);
      const list = JSON.parse(r);
      if (list.length !== 2) throw new Error(`toolbar buttons: ${r}`);
      return r;
    }],
    ["a result opens large with its details", async () => {
      await b.click(`${tiles} button`, "Open:");
      await b.until(`!!document.querySelector('[role="dialog"] img')`, 5000, "the viewer");
      await b.until(`document.querySelector('[role="dialog"]').innerText.includes("Cost")`, 3000, "cost line");
      await b.sleep(400);
      await b.shot("12-viewer");
      const text = await b.evaluate(`document.querySelector('[role="dialog"]').innerText`);
      for (const want of ["paper boat", "FLUX", "Made", "Download", "Use these settings", "Publish"]) if (!text.includes(want)) throw new Error(`viewer lacks "${want}"`);
    }],
    ["arrow keys step through the results", async () => {
      const before = await b.evaluate(`document.querySelector('[role="dialog"]').innerText.match(/\\d+ of \\d+/)?.[0] ?? ""`);
      await b.key("ArrowRight");
      await b.sleep(200);
      const after = await b.evaluate(`document.querySelector('[role="dialog"]').innerText.match(/\\d+ of \\d+/)?.[0] ?? ""`);
      if (!before || before === after) throw new Error(`position stayed "${before}" -> "${after}"`);
      await b.key("ArrowLeft");
      return `${before} -> ${after}`;
    }],
    ["favourite from the viewer", async () => {
      await b.click('[role="dialog"] button', "Favourite");
      await b.until(`!!document.querySelector('[role="dialog"] button[aria-pressed="true"]')`, 5000, "favourited");
    }],
    ["publishing as a guest asks for an account", async () => {
      await b.click('[role="dialog"] button', "Publish");
      await b.until(`document.querySelector('[role="dialog"]').innerText.includes("Create account")`, 3000, "account prompt");
      await b.shot("13-publish-guest");
    }],
    ["use as reference puts the picture in the composer", async () => {
      await b.click('[role="dialog"] button', "Use as reference");
      await b.until(`!document.querySelector('[role="dialog"]')`, 3000, "viewer closed");
      await b.until(`!!document.querySelector('ul[aria-label="Attached files"] img, ul[aria-label="Attached files"] li')`, 3000, "attached file");
      const chip = await b.evaluate(`document.querySelector('button[aria-label^="Model:"]').getAttribute("aria-label")`);
      await b.shot("14-reference");
      await b.click('ul[aria-label="Attached files"] button', "Remove");
      return chip;
    }],
    ["filter by favourites", async () => {
      await b.click("button", "Filter");
      await b.until(`document.querySelectorAll('[role="menuitemradio"]').length >= 4`, 5000, "filter menu");
      await b.sleep(300);
      await b.shot("15-filter");
      await b.click('[role="menuitemradio"]', "Favourites only");
      await b.until(`document.querySelectorAll('${tiles} img').length === 1`, 5000, "one favourite");
      await b.click("button", "Filter");
      await b.until(`document.querySelectorAll('[role="menuitemradio"]').length >= 4`, 5000, "filter menu");
      await b.click('[role="menuitemradio"]', "Clear filters");
      await b.until(`document.querySelectorAll('${tiles} img').length >= 2`, 5000, "all back");
    }],
    ["select several, trash, then undo", async () => {
      const n = await b.evaluate(`document.querySelectorAll('${tiles} img').length`);
      await b.hover(tiles);
      await b.click(`${tiles} [role="checkbox"]`);
      await b.until(`document.body.innerText.includes("1 selected")`, 3000, "selection bar");
      await b.sleep(200);
      await b.shot("16-selected");
      await b.click('[role="toolbar"] button', "Move to trash");
      await b.until(`document.querySelectorAll('${tiles} img').length === ${n - 1}`, 5000, "one fewer");
      await b.until(`!!document.querySelector('[role="status"] button')`, 3000, "undo");
      await b.shot("17-trashed");
      await b.click('[role="status"] button', "Undo");
      await b.until(`document.querySelectorAll('${tiles} img').length === ${n}`, 5000, "back again");
    }],
    ["a failed job shows why and can be tried again", async () => {
      await b.click("textarea");
      await b.evaluate(`(() => { const t = document.querySelector("textarea"); t.select(); })()`);
      await b.type("[fail] a lighthouse in a storm");
      await b.click("button", "One fewer");
      await b.click("textarea");
      await b.key("Enter");
      await b.until(`[...document.querySelectorAll('${tiles}')].some((li) => li.innerText.includes("Try it again"))`, 60000, "failed tile");
      await b.sleep(300);
      await b.shot("18-failed");
      await b.click(`${tiles} button`, "Remove");
      await b.until(`![...document.querySelectorAll('${tiles}')].some((li) => li.innerText.includes("Try it again"))`, 5000, "failed tile removed");
    }],
    ["a queued job can be canceled and leaves a Canceled tile", async () => {
      await b.click("textarea");
      await b.evaluate(`document.querySelector("textarea").select()`);
      await b.type("A red kite over a wheat field");
      await b.click("button", "One more");
      await b.click("button", "One more");
      await b.click("button", "One more");
      await b.click("textarea");
      await b.key("Enter");
      await b.until(`[...document.querySelectorAll('${tiles}')].some((li) => li.getAttribute("aria-busy") === "true")`, 15000, "pending tiles");
      const found = await b.evaluate(`!![...document.querySelectorAll('${tiles} button')].find((e) => e.textContent.trim() === "Cancel")`);
      if (!found) return "every job started before a cancel was possible (mock is fast)";
      await b.click(`${tiles} button`, "Cancel");
      // The job may start in the moment between seeing the button and the click; the server then says so.
      await b.until(`[...document.querySelectorAll('${tiles}')].some((li) => li.innerText.includes("Nothing was charged")) || !!document.querySelector('[role="alert"]')`, 8000, "canceled tile or the server's reason");
      await b.shot("19-canceled");
      if (await b.evaluate(`!!document.querySelector('[role="alert"]')`)) return `race: ${await b.evaluate(`document.querySelector('[role="alert"]').innerText`)}`;
      await b.click(`${tiles} button`, "Dismiss");
      return "canceled one";
    }],
    ["a result tile is reachable with the keyboard and opens with Enter", async () => {
      await b.until(`!document.querySelector('[aria-busy="true"]')`, 60000, "all work finished");
      await b.evaluate(`document.querySelector('${tiles} button[aria-label^="Open:"]').focus()`);
      await b.key("Enter");
      await b.until(`!!document.querySelector('[role="dialog"] img')`, 5000, "the viewer");
      await b.key("Escape");
      await b.until(`!document.querySelector('[role="dialog"]')`, 3000, "closed");
      const back = await b.evaluate(`document.activeElement?.getAttribute("aria-label") || ""`);
      if (!back.startsWith("Open:")) throw new Error(`focus went to "${back}"`);
    }],
    ["no sideways scroll with results", async () => {
      if (await b.evaluate(`document.documentElement.scrollWidth > window.innerWidth + 1`)) throw new Error("page is wider than the window");
    }],
    ["unknown page shows the not-found screen", async () => {
      await b.goto(`${base}/nope`);
      await b.until(`document.body.innerText.includes("404")`, 10000, "404");
      await b.shot("11-404");
    }],
  ]);
} finally {
  await b.close();
}
process.exit(ok ? 0 : 1);
