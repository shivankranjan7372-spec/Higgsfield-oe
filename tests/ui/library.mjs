// The Library from a signed-out visit to folders, favourites, trash and elements.
// Run it with: python3 tests/run.py tests/ui/library.mjs
// (the runner starts the app in mock mode and calls: node tests/ui/library.mjs <base-url> <out-dir> [width] [height])
import { launch, scenario } from "./browser.mjs";

const [base, out, W = "1440", H = "900"] = process.argv.slice(2);
const b = await launch({ width: Number(W), height: Number(H), out });
const tiles = `main ul li[style*="flex-basis"]`;
const noSideways = async () => {
  if (await b.evaluate(`document.documentElement.scrollWidth > window.innerWidth + 1`)) throw new Error("page is wider than the window");
};
const call = (path, body, method = "POST") =>
  b.evaluate(
    `fetch(${JSON.stringify(path)}, { method: ${JSON.stringify(method)}, headers: { "content-type": "application/json" }, body: ${body ? JSON.stringify(JSON.stringify(body)) : "undefined"} }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }))`,
  );
const side = (label) => b.click("nav[aria-label='Library'] button", label);

let ok = false;
let want = 3; // generated files expected
let total = 0; // tiles in "All files"
try {
  ok = await scenario(b, [
    ["signed out: the page explains itself and asks to sign in", async () => {
      await b.goto(`${base}/library`);
      await b.until(`document.body.innerText.includes("Your Library")`, 15000, "signed-out panel");
      await b.until(`[...document.querySelectorAll("button")].some((x) => x.textContent.includes("Sign in"))`, 5000, "sign-in button");
      await b.shot("01-signed-out");
      await noSideways();
      await b.click("button", "Sign in");
      await b.until(`!!document.querySelector('[role="dialog"]')`, 5000, "login dialog");
      await b.key("Escape");
    }],
    ["a member with files sees the grid by date", async () => {
      const r = await call("/api/auth/signup", { email: `lib${Date.now()}@example.com`, password: "library-pass-1", name: "Lib Tester" });
      if (r.status !== 200) throw new Error(`signup ${r.status}`);
      for (const prompt of ["a lighthouse at dusk over a calm sea", "a paper crane on a wooden desk", "neon rain on an empty street"]) {
        const j = await call("/api/jobs", { modelId: "flux-schnell", prompt, values: { aspect: "16:9" } });
        if (j.status !== 200) throw new Error(`job ${j.status} ${JSON.stringify(j.body)}`);
      }
      // A video and a sound too, so the grid shows every kind. A refusal (price, model) is noted, not fatal.
      const extra = [];
      // Jobs at work are capped, so the second one waits for the first batch.
      for (const [modelId, prompt] of [["veo-3.1-lite", "waves rolling onto a pebble beach"], ["fish-s2.1-pro", "Welcome to the harbour."]]) {
        await b.until(`fetch("/api/library").then((r) => r.json()).then((d) => d.assets.length >= ${want})`, 90000, "finished files");
        const j = await call("/api/jobs", { modelId, prompt });
        extra.push(`${modelId}:${j.status}`);
        if (j.status === 200) want++;
      }
      await b.until(`fetch("/api/library").then((r) => r.json()).then((d) => d.assets.length >= ${want})`, 90000, "finished files");
      // One upload, drawn in the browser.
      await b.evaluate(`(async () => {
        const c = document.createElement("canvas"); c.width = 320; c.height = 320;
        const g = c.getContext("2d"); g.fillStyle = "#3a6"; g.fillRect(0, 0, 320, 320); g.fillStyle = "#fff"; g.fillRect(80, 80, 160, 160);
        const blob = await new Promise((r) => c.toBlob(r, "image/png"));
        const f = new FormData(); f.append("file", blob, "green-square.png");
        return (await fetch("/api/assets", { method: "POST", body: f })).status;
      })()`);
      await b.goto(`${base}/library`);
      total = want + 1;
      await b.until(`document.querySelectorAll('${tiles}').length === ${total}`, 15000, "every tile");
      await b.until(`[...document.querySelectorAll('${tiles} img')].every((i) => i.complete && i.naturalWidth > 0)`, 15000, "pictures loaded");
      await b.until(`document.body.innerText.includes("Today")`, 3000, "the Today group");
      await b.sleep(500);
      await b.shot("02-grid");
      await noSideways();
      return `${extra.join(", ")}; ` + (await b.evaluate(`[...document.querySelectorAll("nav[aria-label='Library'] button")].map((x) => x.innerText.replace(/\\n/g, " ")).join(" | ")`));
    }],
    ["hover shows the select box", async () => {
      await b.hover(tiles);
      await b.sleep(300);
      await b.shot("03-hover");
    }],
    ["search narrows the grid", async () => {
      await b.click('input[type="search"]');
      await b.type("crane");
      await b.until(`document.querySelectorAll('${tiles}').length === 1`, 8000, "one match");
      await b.shot("04-search");
      await b.click('button[aria-label="Clear search"]');
      await b.until(`document.querySelectorAll('${tiles}').length === ${total}`, 8000, "all back");
    }],
    ["filter menu: uploads only", async () => {
      await b.click("button", "Filter");
      await b.until(`document.querySelectorAll('[role="menuitemradio"]').length >= 5`, 5000, "filter rows");
      await b.sleep(300);
      await b.shot("05-filter");
      await b.evaluate(`[...document.querySelectorAll('[role="menuitemradio"]')].find((x) => x.textContent.trim() === "Uploaded").click()`);
      await b.until(`document.querySelectorAll('${tiles}').length === 1`, 8000, "one upload");
      await b.click('[role="menuitemradio"]', "Clear filters");
      await b.key("Escape");
      await b.until(`!document.querySelector('[role="menuitemradio"]')`, 3000, "menu closed");
      await b.until(`document.querySelectorAll('${tiles}').length === ${total}`, 8000, "all back");
    }],
    ["large view shows the prompt and model", async () => {
      await b.click(`${tiles} button`, "lighthouse");
      await b.until(`!!document.querySelector('[role="dialog"]') && document.querySelector('[role="dialog"]').innerText.includes("lighthouse")`, 5000, "viewer");
      await b.until(`[...document.querySelectorAll('[role="dialog"] a')].some((a) => a.getAttribute("href")?.startsWith("/image?model=flux-schnell&prompt="))`, 3000, "open in studio link");
      await b.sleep(600);
      await b.shot("06-viewer");
    }],
    ["favourite from the large view", async () => {
      await b.click('[role="dialog"] button', "Favourite");
      await b.until(`[...document.querySelectorAll('[role="dialog"] button')].some((x) => x.getAttribute("aria-pressed") === "true")`, 5000, "favourited");
      await b.key("Escape");
      await b.until(`!document.querySelector('[role="dialog"]')`, 3000, "closed");
      await side("Favourites");
      await b.until(`document.querySelectorAll('${tiles}').length === 1`, 8000, "one favourite");
      await b.shot("07-favourites");
    }],
    ["create a folder and move files in", async () => {
      await side("Folders");
      await b.click("button", "New folder");
      await b.until(`!!document.querySelector('[role="dialog"] input')`, 3000, "name field");
      await b.type("Seaside");
      await b.click('[role="dialog"] button[type="submit"]');
      await b.until(`document.body.innerText.includes("Seaside")`, 5000, "folder card");
      await b.shot("08-folders");
      await side("All files");
      await b.until(`document.querySelectorAll('${tiles}').length === ${total}`, 8000, "grid");
      await b.click('main [role="checkbox"]', "Select everything");
      await b.until(`!!document.querySelector('[role="toolbar"]')`, 3000, "selection bar");
      await b.shot("09-selected");
      await b.click('[role="toolbar"] button', "Move");
      await b.until(`[...document.querySelectorAll('[role="menuitemradio"]')].some((x) => x.textContent.includes("Seaside"))`, 3000, "folder in menu");
      await b.click('[role="menuitemradio"]', "Seaside");
      await b.until(`!document.querySelector('[role="toolbar"]')`, 5000, "bar gone");
      await side("Folders");
      await b.until(`document.body.innerText.includes("${total} files")`, 5000, "folder count");
      await b.click("main ul li button", "Seaside");
      await b.until(`document.querySelectorAll('${tiles}').length === ${total}`, 8000, "folder contents");
      await b.shot("10-folder-open");
    }],
    ["delete one file to the trash and restore it", async () => {
      await side("All files");
      await b.until(`document.querySelectorAll('${tiles}').length === ${total}`, 8000, "grid");
      await b.hover(tiles);
      await b.click(`${tiles} [role="checkbox"]`);
      await b.click('[role="toolbar"] button', "Delete");
      await b.until(`document.querySelectorAll('${tiles}').length === ${total - 1}`, 8000, "one fewer");
      await side("Trash");
      await b.until(`document.querySelectorAll('main ul[aria-label="Trash"] li').length === 1`, 8000, "one in trash");
      await b.until(`[...document.querySelectorAll('main ul[aria-label="Trash"] img')].every((i) => i.complete && i.naturalWidth > 0)`, 8000, "trash preview loaded");
      await b.sleep(400);
      await b.shot("11-trash");
      await b.click('main ul[aria-label="Trash"] li button');
      await b.click('[role="toolbar"] button', "Restore");
      await b.until(`document.body.innerText.includes("The trash is empty")`, 8000, "trash empty");
    }],
    ["create an element from own pictures", async () => {
      await side("Reference sets");
      await b.click("main button", "New reference set");
      await b.until(`document.querySelectorAll('[role="dialog"] li button').length >= 2`, 8000, "picture picker");
      await b.click('[role="dialog"] input[required]');
      await b.type("Harbour light");
      await b.click('[role="dialog"] li button');
      await b.sleep(300);
      await b.shot("12-element-form");
      await b.click('[role="dialog"] button[type="submit"]');
      await b.until(`!document.querySelector('[role="dialog"]') && document.body.innerText.includes("Harbour light")`, 8000, "element card");
      await b.sleep(400);
      await b.shot("13-elements");
    }],
    ["no sideways scroll, keyboard reaches the sidebar", async () => {
      await noSideways();
      await b.goto(`${base}/library`);
      await b.key("Tab");
      return `focus: ${await b.evaluate(`document.activeElement?.tagName`)}`;
    }],
  ]);
} finally {
  await b.close();
}
process.exit(ok ? 0 : 1);
