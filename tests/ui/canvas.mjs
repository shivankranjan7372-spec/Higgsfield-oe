// The Boards pages (/canvas): the landing as a visitor, then a board from first note to an exported PNG.
// Run it with: python3 tests/run.py tests/ui/canvas.mjs
// (the runner starts the app in mock mode and calls: node tests/ui/canvas.mjs <base-url> <out-dir> [width] [height])
import { launch, scenario } from "./browser.mjs";

const [base, out, W = "1440", H = "900"] = process.argv.slice(2);
const b = await launch({ width: Number(W), height: Number(H), out });
const items = `[data-board] [data-item]`;
const noSideways = async () => {
  if (await b.evaluate(`document.documentElement.scrollWidth > window.innerWidth + 1`)) throw new Error("page is wider than the window");
};
/** Presses at one point, moves in steps, and lets go: a real drag. */
async function drag(from, dx, dy) {
  await b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: from.x, y: from.y });
  await b.send("Input.dispatchMouseEvent", { type: "mousePressed", x: from.x, y: from.y, button: "left", buttons: 1, clickCount: 1 });
  for (let i = 1; i <= 6; i++) {
    await b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: from.x + (dx * i) / 6, y: from.y + (dy * i) / 6, button: "left", buttons: 1 });
    await b.sleep(30);
  }
  await b.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: from.x + dx, y: from.y + dy, button: "left", buttons: 0, clickCount: 1 });
  await b.sleep(150);
}
const itemBox = (n) => b.evaluate(`JSON.stringify((() => { const r = document.querySelectorAll('${items}')[${n}].getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; })())`).then(JSON.parse);

let ok = false;
try {
  ok = await scenario(b, [
    ["open /canvas as a visitor and see the hero and the sign-in box", async () => {
      await b.goto(`${base}/canvas`);
      await b.until(`!!document.querySelector("h1") && document.body.innerText.includes("Sign in to view your canvases")`, 20000, "hero and sign-in box");
      await b.sleep(900);
      await b.shot("01-landing");
      const h1 = await b.evaluate(`document.querySelector("h1").innerText`);
      if (!/canvas/i.test(h1)) throw new Error(`headline is "${h1}"`);
      return `slots: ${await b.evaluate(`document.querySelectorAll('section [aria-hidden="true"][style*="gradient"], section [data-artwork]').length`)}`;
    }],
    ["no sideways scroll", noSideways],
    ["the list row is laid out as drawn", async () => {
      const r = JSON.parse(await b.evaluate(`JSON.stringify([...document.querySelectorAll('[role="tab"]')].map((e) => { const r = e.getBoundingClientRect(); return [e.textContent.trim(), Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; }))`));
      if (r.length !== 2 || r[0][4] !== 32) throw new Error(JSON.stringify(r));
      return JSON.stringify(r);
    }],
    ["Sign in opens the sign-in window and Escape closes it", async () => {
      await b.click("button", "Sign in");
      await b.until(`!!document.querySelector('[role="dialog"]')`, 5000, "the window");
      await b.sleep(300);
      await b.shot("02-sign-in");
      await b.key("Escape");
      await b.until(`!document.querySelector('[role="dialog"]')`, 3000, "closed");
    }],
    ["Templates lists starter canvases", async () => {
      await b.click('[role="tab"]', "Templates");
      await b.until(`document.querySelectorAll('button[aria-label^="Start a canvas from"]').length === 3`, 3000, "three templates");
      await b.sleep(300);
      await b.shot("03-templates");
    }],
    ["search narrows the templates and says when nothing matches", async () => {
      await b.click('button[aria-label="Search canvases"]');
      await b.type("story");
      await b.until(`document.querySelectorAll('button[aria-label^="Start a canvas from"]').length === 1`, 3000, "one template");
      await b.type("zzz");
      await b.until(`document.body.innerText.includes("No canvas is called")`, 3000, "no-match line");
      await b.shot("04-search");
      await b.key("Escape");
      await b.until(`document.querySelectorAll('button[aria-label^="Start a canvas from"]').length === 3`, 3000, "all templates back");
    }],
    ["a template starts a canvas (as a guest) and opens the board", async () => {
      await b.click('button[aria-label^="Start a canvas from"]', "Storyboard");
      await b.until(`location.pathname === "/canvas/board" && location.search.includes("id=")`, 15000, "the board address");
      await b.until(`document.querySelectorAll('${items}').length === 4`, 10000, "four template notes");
      await b.until(`!!document.querySelector("textarea")`, 10000, "the composer");
      await b.sleep(600);
      await b.shot("05-board-template");
      const name = await b.evaluate(`document.querySelector('input[placeholder="Untitled canvas"]').value`);
      if (name !== "Storyboard") throw new Error(`name is "${name}"`);
      if (!(await b.evaluate(`document.body.innerText.includes("Kept in this browser only") || innerWidth < 768`))) throw new Error("no browser-only note");
    }],
    ["no sideways scroll on the board", noSideways],
    ["back to the list shows the new canvas", async () => {
      await b.goto(`${base}/canvas`);
      await b.until(`!!document.querySelector('a[aria-label="Open Storyboard"]')`, 15000, "the card");
      await b.sleep(500);
      await b.shot("06-list");
    }],
    ["New canvas opens an empty board", async () => {
      await b.click("button", "New canvas");
      await b.until(`location.search.includes("id=") && document.body.innerText.includes("An empty canvas")`, 15000, "empty board");
      await b.sleep(400);
      await b.shot("07-empty-board");
    }],
    ["rename the canvas", async () => {
      await b.evaluate(`(() => { const i = document.querySelector('input[placeholder="Untitled canvas"]'); i.focus(); i.select(); })()`);
      await b.type("Harbour ideas");
    }],
    ["add a note and write in it", async () => {
      await b.click("button", "Note");
      await b.until(`!!document.querySelector('textarea[aria-label="Note text"]')`, 3000, "note editor");
      await b.type("Warm light, low fog");
      await b.key("Escape");
      await b.until(`!!document.querySelector('${items}[aria-label="Note: Warm light, low fog"]')`, 3000, "the note");
    }],
    ["drag the note to move it", async () => {
      const [x, y, w, h] = await itemBox(0);
      await drag({ x: x + w / 2, y: y + h / 2 }, -60, 40);
      const [x2, y2] = await itemBox(0);
      if (Math.abs(x2 - (x - 60)) > 3 || Math.abs(y2 - (y + 40)) > 3) throw new Error(`moved from ${x},${y} to ${x2},${y2}`);
      await b.shot("08-note-moved");
    }],
    ["the arrow keys nudge the picked item", async () => {
      const [x] = await itemBox(0);
      await b.evaluate(`document.querySelectorAll('${items}')[0].focus()`);
      await b.key("ArrowRight");
      const [x2] = await itemBox(0);
      if (x2 !== x + 1) throw new Error(`${x} -> ${x2}`);
    }],
    ["generate a picture into the board", async () => {
      await b.click('textarea[placeholder^="Describe a picture"]');
      await b.type("A paper lantern floating over a quiet harbour at dusk");
      await b.key("Enter");
      await b.until(`!!document.querySelector('${items}[aria-label="Making it"]')`, 15000, "a placeholder");
      await b.shot("09-pending");
      await b.until(`!!document.querySelector('${items} img') && document.querySelector('${items} img').complete && document.querySelector('${items} img').naturalWidth > 0`, 60000, "the picture on the board");
      await b.sleep(400);
      await b.shot("10-generated");
    }],
    ["a failed generation shows its reason on the board", async () => {
      await b.click('textarea[placeholder^="Describe a picture"]');
      await b.evaluate(`(() => { const t = document.querySelector('textarea[placeholder^="Describe a picture"]'); t.select(); })()`);
      await b.type("a broken mirror [fail]");
      await b.key("Enter");
      await b.until(`[...document.querySelectorAll('${items}')].some((e) => e.querySelector('button')?.textContent.includes("Dismiss"))`, 60000, "the failed tile");
      await b.shot("11-failed");
      await b.click(`${items} button`, "Dismiss");
    }],
    ["your pictures panel lists the library and adds one", async () => {
      const before = await b.evaluate(`document.querySelectorAll('${items} img').length`);
      await b.click("button", "Your pictures");
      await b.until(`document.querySelectorAll('aside ul button').length >= 1`, 10000, "library pictures");
      await b.sleep(400);
      await b.shot("12-library");
      await b.click("aside ul button");
      await b.until(`document.querySelectorAll('${items} img').length === ${before + 1}`, 3000, "one more picture");
      await b.click('button[aria-label="Close your pictures"]');
    }],
    ["resize the picked picture with its corner", async () => {
      const n = (await b.evaluate(`document.querySelectorAll('${items}').length`)) - 1;
      const [, , w] = await itemBox(n);
      const pt = await b.evaluate(`JSON.stringify((() => { const r = document.querySelector('[data-resize]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })())`).then(JSON.parse);
      await drag(pt, 40, 0);
      const [, , w2] = await itemBox(n);
      if (w2 < w + 30) throw new Error(`width ${w} -> ${w2}`);
    }],
    ["layer: send the picked picture backward", async () => {
      const last = await b.evaluate(`[...document.querySelectorAll('${items}')].at(-1).getAttribute("data-item")`);
      await b.click('button[aria-label="Send backward"]');
      const now = await b.evaluate(`[...document.querySelectorAll('${items}')].at(-2).getAttribute("data-item")`);
      if (now !== last) throw new Error("order did not change");
      await b.shot("13-selected");
    }],
    ["zoom in, zoom out, fit", async () => {
      await b.click('button[aria-label="Zoom in"]');
      await b.until(`document.body.innerText.includes("125%")`, 2000, "125%");
      await b.click('button[aria-label="Zoom out"]');
      await b.click('button[aria-label="Zoom out"]');
      await b.until(`document.body.innerText.includes("80%")`, 2000, "80%");
      await b.click('button[aria-label="Fit everything"]');
      await b.sleep(300);
      await b.shot("14-fit");
    }],
    ["drag the empty board to pan", async () => {
      const [x] = await itemBox(0);
      const r = JSON.parse(await b.evaluate(`JSON.stringify((() => { const r = document.querySelector('[data-board]').getBoundingClientRect(); return { x: r.x + 20, y: r.y + r.height * 0.55 }; })())`));
      await drag(r, 50, 0);
      const [x2] = await itemBox(0);
      if (Math.abs(x2 - x - 50) > 3) throw new Error(`${x} -> ${x2}`);
    }],
    ["delete the note with the keyboard", async () => {
      const n = await b.evaluate(`document.querySelectorAll('${items}').length`);
      await b.evaluate(`document.querySelector('${items}[aria-label^="Note:"]').focus()`);
      await b.key("Backspace");
      await b.until(`document.querySelectorAll('${items}').length === ${n - 1}`, 2000, "one fewer item");
    }],
    ["export a PNG", async () => {
      await b.evaluate(`(() => { window.__png = null; const o = URL.createObjectURL; URL.createObjectURL = (blob) => { window.__png = blob.type + " " + blob.size; return o.call(URL, blob); }; })()`);
      await b.click("button", "Export PNG");
      await b.until(`!!window.__png`, 15000, "a PNG");
      const png = await b.evaluate(`window.__png`);
      if (!png.startsWith("image/png") || Number(png.split(" ")[1]) < 1000) throw new Error(png);
      return png;
    }],
    ["reload keeps the board", async () => {
      await b.sleep(500);
      await b.reload();
      await b.until(`document.querySelectorAll('${items} img').length >= 2`, 15000, "pictures after reload");
      const name = await b.evaluate(`document.querySelector('input[placeholder="Untitled canvas"]').value`);
      if (name !== "Harbour ideas") throw new Error(`name is "${name}"`);
      await b.sleep(500);
      await b.shot("15-reload");
    }],
    ["no sideways scroll with a full board", noSideways],
    ["the list shows both canvases, newest first, and deletes one", async () => {
      await b.goto(`${base}/canvas`);
      await b.until(`document.querySelectorAll('a[aria-label^="Open "]').length === 2`, 15000, "two cards");
      const first = await b.evaluate(`document.querySelector('a[aria-label^="Open "]').getAttribute("aria-label")`);
      if (first !== "Open Harbour ideas") throw new Error(`first card is ${first}`);
      await b.sleep(500);
      await b.shot("16-list-two");
      await b.click('button[aria-label="Delete Storyboard"]');
      await b.click('[role="group"] button', "Delete");
      await b.until(`document.querySelectorAll('a[aria-label^="Open "]').length === 1`, 3000, "one card");
    }],
    ["an unknown board says so", async () => {
      await b.goto(`${base}/canvas/board?id=nope`);
      await b.until(`document.body.innerText.includes("That canvas is not in this browser")`, 15000, "not-found line");
      await b.shot("17-not-found");
    }],
  ]);
  console.log(b.logs().join("\n"));
} finally {
  await b.close();
}
process.exit(ok ? 0 : 1);
