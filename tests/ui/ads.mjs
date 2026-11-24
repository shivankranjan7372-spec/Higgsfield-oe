// The Ad Campaigns page from a first visit to a finished mock ad, a variation, and the sidebar actions.
// Run it with: python3 tests/run.py tests/ui/ads.mjs
// (the runner starts the app in mock mode and calls: node tests/ui/ads.mjs <base-url> <out-dir> [width] [height])
import { launch, scenario } from "./browser.mjs";

const [base, out, W = "1440", H = "900"] = process.argv.slice(2);
const b = await launch({ width: Number(W), height: Number(H), out });
const phone = Number(W) < 768;

/** Puts a small generated PNG into the first visible file input, the way a picked file arrives. */
const dropPicture = `(async () => {
  const c = document.createElement("canvas"); c.width = 64; c.height = 64;
  const g = c.getContext("2d"); g.fillStyle = "#d1fe17"; g.fillRect(0, 0, 64, 64); g.fillStyle = "#131517"; g.fillRect(16, 16, 32, 32);
  const blob = await new Promise((r) => c.toBlob(r, "image/png"));
  const input = [...document.querySelectorAll('[role="dialog"] input[type=file]')][0];
  const dt = new DataTransfer(); dt.items.add(new File([blob], "candle.png", { type: "image/png" }));
  input.files = dt.files; input.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
})()`;

const noSideways = async () => {
  if (await b.evaluate(`document.documentElement.scrollWidth > window.innerWidth + 1`)) throw new Error("page is wider than the window");
};
const openSidebar = async () => {
  if (!phone) return;
  await b.click("button", "Open the ads list");
  await b.until(`!!document.querySelector('[role="dialog"] nav')`, 5000, "sidebar sheet");
  await b.sleep(300);
};
const closeSidebar = async () => {
  if (!phone) return;
  await b.key("Escape");
  await b.until(`!document.querySelector('[role="dialog"]')`, 5000, "sheet closed");
};

let ok = false;
try {
  ok = await scenario(b, [
    ["open /ads and see the studio", async () => {
      await b.goto(`${base}/ads`);
      await b.until(`!!document.querySelector("h1") && !!document.querySelector("textarea") && !!document.querySelector('[data-testid="ads-screen"]')`);
      await b.until(`document.querySelectorAll('button[aria-label^="Use this style"]').length >= 4`, 15000, "style tiles");
      await b.sleep(800);
      await b.shot("01-home");
    }],
    ["no sideways scroll", noSideways],
    ["signed-out sidebar invites the visitor in", async () => {
      await openSidebar();
      await b.until(`document.body.innerText.includes("show up here once you make one")`, 5000, "signed-out note");
      await b.shot("02-sidebar-signed-out");
      await closeSidebar();
    }],
    ["the lime button says what is missing", async () => {
      await b.click("button", "Make the ad");
      await b.until(`document.querySelector('[role="alert"]')?.innerText.includes("product")`, 5000, "an alert about the product");
      await b.shot("03-blocked");
      await b.click('[role="alert"] button', "Dismiss");
    }],
    ["the Style chip lists styles from the API", async () => {
      await b.click("button", "Style:");
      await b.until(`document.querySelectorAll('[role="menuitemcheckbox"]').length >= 4`, 5000, "style rows");
      await b.sleep(300);
      await b.shot("04-styles");
      await b.key("Escape");
      await b.until(`document.querySelectorAll('[role="menuitemcheckbox"]').length === 0`, 3000, "menu closed");
      const where = await b.evaluate(`document.activeElement?.getAttribute("aria-label") || ""`);
      if (!where.startsWith("Style")) throw new Error(`focus went to "${where}"`);
    }],
    ["a trending tile fills the composer", async () => {
      await b.click('button[aria-label^="Use this style"]', "hero shot");
      await b.until(`!!document.querySelector('button[aria-label="Style: Product hero shot"]')`, 3000, "the chip names the style");
      await b.until(`document.querySelector("textarea").value.length > 10`, 3000, "a starter script");
      const price = await b.evaluate(`document.querySelector('[data-testid="ads-price"]').innerText`);
      if (!/credits/.test(price)) throw new Error(`price shows "${price}"`);
      return `price ${price}`;
    }],
    ["add a product with a picture", async () => {
      await b.click("button", "Product:");
      await b.until(`[...document.querySelectorAll('[role="menuitem"]')].some((e) => e.innerText.includes("New product"))`, 5000, "new product row");
      await b.click('[role="menuitem"]', "New product");
      await b.until(`!!document.querySelector('[role="dialog"] input')`, 5000, "product window");
      await b.click('[role="dialog"] input');
      await b.type("Ember Candle");
      await b.evaluate(dropPicture);
      await b.until(`document.querySelectorAll('[role="dialog"] button[aria-pressed="true"]').length === 1`, 15000, "the picture uploaded and chosen");
      await b.sleep(300);
      await b.shot("05-product");
      await b.click('[role="dialog"] button', "Save product");
      await b.until(`!document.querySelector('[role="dialog"]')`, 10000, "window closed");
      await b.until(`!!document.querySelector('button[aria-label="Product: Ember Candle"]')`, 5000, "the chip names the product");
    }],
    ["the script writer fills the box", async () => {
      await b.evaluate(`(() => { const t = document.querySelector("textarea"); const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set; set.call(t, ""); t.dispatchEvent(new Event("input", { bubbles: true })); })()`);
      await b.click("button", "Write a starter script");
      await b.until(`document.querySelector("textarea").value.includes("Ember Candle")`, 10000, "a script naming the product");
      await b.until(`document.querySelector('[role="status"]')?.innerText.includes("Starter script")`, 3000, "the starter-copy note");
      await b.shot("06-script");
    }],
    ["make the ad and watch it arrive", async () => {
      await b.click("button", "Make the ad");
      await b.until(`!!document.querySelector('[data-testid="ads-progress"]') || !!document.querySelector('[data-testid="ads-image"]')`, 15000, "progress on the screen");
      await b.shot("07-making");
      await b.until(`document.querySelector('[data-testid="ads-image"]')?.complete && document.querySelector('[data-testid="ads-image"]').naturalWidth > 0`, 60000, "the finished ad");
      await b.sleep(500);
      await b.shot("08-done");
    }],
    ["no sideways scroll with a result", noSideways],
    ["the balance went down", async () => {
      const me = JSON.parse(await b.evaluate(`fetch("/api/auth/me").then((r) => r.text())`));
      if (!(me.balance < 60000)) throw new Error(`balance is ${me.balance}`);
      return `balance ${me.balance}`;
    }],
    ["download points at the file", async () => {
      const href = await b.evaluate(`[...document.querySelectorAll("a[download]")].map((a) => a.getAttribute("href")).find((h) => h.includes("download=1")) || ""`);
      if (!href.startsWith("/api/assets/")) throw new Error(`download link is "${href}"`);
    }],
    ["make a variation", async () => {
      await b.click("button", "Make a variation");
      await b.until(`document.body.innerText.includes("1 of 2")`, 15000, "two ads in the player");
      await b.until(`document.querySelector('[data-testid="ads-image"]')?.complete && document.querySelector('[data-testid="ads-image"]').naturalWidth > 0`, 60000, "the variation");
      await b.click("button", "Next ad");
      await b.until(`document.body.innerText.includes("2 of 2")`, 3000, "stepped to the second ad");
      await b.sleep(400);
      await b.shot("09-variation");
    }],
    ["mark the ad on screen as a winner", async () => {
      await b.click("button", "Mark as a winner");
      await b.until(`!!document.querySelector('button[aria-label="No longer a winner"][aria-pressed="true"]')`, 5000, "the star is lit");
    }],
    ["the sidebar lists the ad; rename it", async () => {
      await openSidebar();
      await b.until(`[...document.querySelectorAll('button[aria-label^="More for"]')].some((e) => e.getClientRects().length)`, 10000, "an ad row");
      await b.shot("10-sidebar");
      await b.click('button[aria-label^="More for"]');
      await b.click('[role="menuitem"]', "Rename");
      await b.until(`!!document.querySelector('input[aria-label="Rename"]')`, 3000, "rename box");
      await b.evaluate(`(() => { const t = document.querySelector('input[aria-label="Rename"]'); t.select(); })()`);
      await b.type("Autumn candle");
      await b.key("Enter");
      await b.until(`!!document.querySelector('button[aria-label="More for Autumn candle"]')`, 5000, "renamed");
    }],
    ["duplicate makes a draft, delete removes it", async () => {
      await b.click('button[aria-label="More for Autumn candle"]');
      await b.click('[role="menuitem"]', "Duplicate");
      if (phone) await b.until(`!document.querySelector('[role="dialog"]')`, 5000, "sheet closed after opening the copy");
      await openSidebar();
      await b.until(`!!document.querySelector('button[aria-label="More for Autumn candle (copy)"]')`, 5000, "the copy");
      await b.shot("11-duplicate");
      await b.click('button[aria-label="More for Autumn candle (copy)"]');
      await b.click('[role="menuitem"]', "Delete");
      await b.until(`!document.querySelector('button[aria-label="More for Autumn candle (copy)"]')`, 5000, "the copy is gone");
      await closeSidebar();
    }],
    ["the Avatar window lists photos", async () => {
      await b.click("button", "Avatar:");
      await b.until(`document.querySelectorAll('[role="dialog"] button[aria-pressed]').length >= 1`, 5000, "photos");
      await b.sleep(300);
      await b.shot("12-avatars");
      await b.key("Escape");
      await b.until(`!document.querySelector('[role="dialog"]')`, 3000, "closed");
    }],
    ["how it works opens", async () => {
      await b.click("button", "How it works");
      await b.until(`!!document.querySelector('[role="dialog"] ol')`, 3000, "steps");
      await b.shot("13-how");
      await b.key("Escape");
    }],
    ["reload keeps the ads", async () => {
      await b.reload();
      await b.until(`!!document.querySelector("textarea")`, 15000, "page");
      await openSidebar();
      await b.until(`!!document.querySelector('button[aria-label="More for Autumn candle"]')`, 10000, "the ad after reload");
      await closeSidebar();
      await b.sleep(400);
      await noSideways();
      await b.shot("14-reload");
    }],
  ]);
} finally {
  await b.close();
}
process.exit(ok ? 0 : 1);
