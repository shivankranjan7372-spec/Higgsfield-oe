// The Apps catalog and one app, from a signed-out visit to finished mock runs.
// Run it with: python3 tests/run.py tests/ui/apps.mjs
// (the runner starts the app in mock mode and calls: node tests/ui/apps.mjs <base-url> <out-dir> [width] [height])
import { launch, scenario } from "./browser.mjs";

const [base, out, W = "1440", H = "900"] = process.argv.slice(2);
const b = await launch({ width: Number(W), height: Number(H), out });
const narrow = Number(W) < 600;
const noSideways = async () => {
  if (await b.evaluate(`document.documentElement.scrollWidth > window.innerWidth + 1`)) throw new Error("page is wider than the window");
};
const cards = (label) => `document.querySelectorAll('ul[aria-label="${label}"] > li[data-app]').length`;
const resultTiles = `ul[aria-label="Latest results"] li`;

let ok = false;
try {
  ok = await scenario(b, [
    ["open /apps signed out: header, pills, featured and category rows", async () => {
      await b.goto(`${base}/apps`);
      await b.until(`!!document.querySelector("h1") && ${cards("Featured")} >= 5`, 20000, "featured cards");
      await b.until(`${cards("Image tools")} === 5 && ${cards("Templates")} === 5`, 10000, "category rows");
      const pills = await b.evaluate(`[...document.querySelectorAll('[role="tab"]')].map((t) => t.textContent).join("|")`);
      if (!pills.startsWith("All|")) throw new Error(`pills: ${pills}`);
      await b.sleep(500);
      await b.shot("01-catalog");
      await b.shot("01b-catalog-full", { full: true });
      return pills;
    }],
    ["no sideways scroll on the catalog", noSideways],
    ["hover a card", async () => {
      await b.hover('ul[aria-label="Image tools"] > li');
      await b.sleep(300);
      await b.shot("02-hover");
    }],
    ["a category pill shows the whole category", async () => {
      await b.click('[role="tab"]', "Effects");
      await b.until(`document.querySelectorAll('ul[aria-label="Apps"] > li[data-app]').length === 17`, 10000, "17 effects");
      await b.sleep(300);
      await b.shot("03-effects");
      await noSideways();
      await b.click('[role="tab"]', "All");
      await b.until(`${cards("Featured")} >= 5`, 5000, "back to all");
    }],
    ["search finds an app, and an empty search says so", async () => {
      await b.click('input[type="search"]');
      await b.type("poster");
      await b.until(`!!document.querySelector('ul[aria-label="Apps"] li[data-app="event-poster"]')`, 10000, "event poster found");
      await b.sleep(300);
      await b.shot("04-search");
      await b.type("zzzqqq");
      await b.until(`document.body.innerText.includes("No apps match")`, 10000, "empty search");
      await b.shot("05-search-empty");
      await b.click("button", "Clear search");
      await b.until(`${cards("Featured")} >= 5`, 5000, "back to all");
    }],
    ["pin while signed out asks to sign in", async () => {
      await b.click('ul[aria-label="Featured"] button[aria-label="Sign in to pin apps"]');
      await b.until(`!!document.querySelector('[role="dialog"]')`, 5000, "sign-in window");
      await b.sleep(300);
      await b.shot("06-pin-signin");
      await b.key("Escape");
      await b.until(`!document.querySelector('[role="dialog"]')`, 3000, "window closed");
    }],
    ["Try now opens the app", async () => {
      await b.click('ul[aria-label="Featured"] a', "Try now");
      await b.until(`location.pathname.startsWith("/apps/") && !!document.querySelector("form h1, h1")`, 15000, "app page");
      await b.until(`!!document.querySelector("form")`, 15000, "the form");
    }],
    ["a signed-out visitor sees the form and Run asks to sign in", async () => {
      await b.goto(`${base}/apps/event-poster`);
      await b.until(`!!document.querySelector("form") && document.body.innerText.includes("Sign in to run")`, 15000, "sign-in run button");
      await b.until(`/\\d credits/.test(document.querySelector("form > button")?.textContent ?? "")`, 10000, "price on the button");
      await b.shot("07-app-signed-out");
      await noSideways();
      await b.click("form > button", "Sign in to run");
      await b.until(`!!document.querySelector('[role="dialog"]')`, 5000, "sign-in window");
      await b.key("Escape");
    }],
    ["an unavailable app cannot run", async () => {
      await b.goto(`${base}/apps/upscale`);
      await b.until(`document.body.innerText.includes("Not available yet")`, 15000, "unavailable note");
      if (!(await b.evaluate(`document.querySelector("form > button").disabled`))) throw new Error("Run is enabled");
      await b.shot("08-unavailable");
    }],
    ["an unknown app says so", async () => {
      await b.goto(`${base}/apps/no-such-app`);
      await b.until(`document.body.innerText.includes("no app at this address")`, 15000, "not found");
    }],
    ["become a guest and pin an app", async () => {
      await b.goto(`${base}/apps`);
      await b.evaluate(`fetch("/api/auth/guest", { method: "POST" }).then((r) => r.status)`);
      await b.reload();
      await b.until(`!!document.querySelector('button[aria-label="Pin Restyle"]')`, 15000, "pin button");
      await b.click('button[aria-label="Pin Restyle"]');
      await b.until(`${cards("Pinned")} === 1`, 10000, "pinned row");
      await b.sleep(300);
      await b.shot("09-pinned");
    }],
    ["run a text-only app and see the result arrive", async () => {
      await b.goto(`${base}/apps/event-poster`);
      await b.until(`!!document.querySelector("#field-title")`, 15000, "title field");
      await b.click("#field-title");
      await b.type("Night market");
      await b.click('[role="radio"]', "2");
      await b.until(`/4\\.2|\\d credits/.test(document.querySelector("form > button").textContent)`, 5000, "price");
      const priced = await b.evaluate(`document.querySelector("form > button").textContent`);
      await b.click("form > button", "Run");
      await b.until(`document.querySelectorAll('${resultTiles}').length >= 2`, 15000, "pending tiles");
      await b.shot("10-pending");
      await b.until(`document.querySelectorAll('${resultTiles}[data-state="done"] img').length >= 2`, 60000, "two pictures");
      await b.sleep(600);
      await b.shot("11-done");
      return priced.trim();
    }],
    ["the balance went down", async () => {
      const me = JSON.parse(await b.evaluate(`fetch("/api/auth/me").then((r) => r.text())`));
      if (!(me.balance < 60000)) throw new Error(`balance is ${me.balance}`);
      return `balance ${me.balance}`;
    }],
    ["a failing run shows the error and Try again", async () => {
      await b.click('[role="radio"]', "1");
      await b.click("#field-title");
      await b.evaluate(`(() => { const el = document.querySelector("#field-title"); el.select(); })()`);
      await b.type("Broken [fail]");
      await b.click("form > button", "Run");
      await b.until(`!!document.querySelector('${resultTiles}[data-state="failed"]')`, 60000, "failed tile");
      await b.sleep(300);
      await b.shot("12-failed");
      await b.until(`!!document.querySelector('${resultTiles}[data-state="failed"] button')`, 3000, "Try again button");
    }],
    ["earlier runs list, and Use these inputs refills the form", async () => {
      await b.until(`document.querySelectorAll('ul[aria-label="Your earlier runs"] > li').length >= 1`, 10000, "history row");
      await b.click('ul[aria-label="Your earlier runs"] button', "Use these inputs");
      await b.until(`document.querySelector("#field-title").value === "Night market"`, 5000, "title refilled");
      await b.shot("13-history", { full: !narrow });
    }],
    ["pick a file from the library for an upload tile and run", async () => {
      // An upload made in the page (a small canvas PNG), so the picker has something to show.
      const up = await b.evaluate(`(async () => {
        const c = document.createElement("canvas"); c.width = 64; c.height = 64;
        const x = c.getContext("2d"); x.fillStyle = "#4a7"; x.fillRect(0, 0, 64, 64);
        const blob = await new Promise((r) => c.toBlob(r, "image/png"));
        const f = new FormData(); f.append("file", blob, "square.png"); f.append("accept", "image");
        const r = await fetch("/api/assets", { method: "POST", body: f });
        return r.status;
      })()`);
      if (up !== 200) throw new Error(`upload answered ${up}`);
      await b.goto(`${base}/apps/restyle`);
      await b.until(`!!document.querySelector('[data-input="photo"]')`, 15000, "photo tile");
      if (!(await b.evaluate(`document.querySelector("form > button").disabled`))) throw new Error("Run should wait for a photo");
      await b.click('button[aria-label^="Your files"]');
      await b.until(`document.querySelectorAll('ul[aria-label="Your files"] button').length >= 1`, 10000, "files in the picker");
      await b.sleep(300);
      await b.shot("14-picker");
      await b.click('ul[aria-label="Your files"] button');
      await b.until(`document.querySelectorAll('[data-input="photo"] img').length === 1`, 5000, "photo chosen");
      await b.until(`!document.querySelector("form > button").disabled`, 5000, "Run enabled");
      await b.click("form > button", "Run");
      await b.until(`document.querySelectorAll('${resultTiles}[data-state="done"] img').length >= 1`, 60000, "restyled picture");
      await b.sleep(500);
      await b.shot("15-restyle-done");
      await noSideways();
    }],
    ["recently used shows on the catalog", async () => {
      await b.goto(`${base}/apps`);
      await b.until(`${cards("Recently used")} >= 2`, 15000, "recent row");
      await b.sleep(300);
      await b.shot("16-recent");
      await noSideways();
    }],
  ]);
} finally {
  await b.close();
}
process.exit(ok ? 0 : 1);
