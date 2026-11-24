// Horizon (the long-form studio that is not open yet) and the Guide, as a visitor and as a member.
// Run it with: python3 tests/run.py tests/ui/horizon.mjs
// (the runner starts the app in mock mode and calls: node tests/ui/horizon.mjs <base-url> <out-dir> [width] [height])
import { launch, scenario } from "./browser.mjs";

const [base, out, W = "1440", H = "900"] = process.argv.slice(2);
const b = await launch({ width: Number(W), height: Number(H), out });
const noSideways = async () => {
  if (await b.evaluate(`document.documentElement.scrollWidth > window.innerWidth + 1`)) {
    const wide = await b.evaluate(`[...document.querySelectorAll("body *")].filter((e) => e.getBoundingClientRect().right > window.innerWidth + 1).slice(0, 3).map((e) => e.tagName + "." + String(e.className).slice(0, 60)).join(" | ")`);
    throw new Error(`page is wider than the window: ${wide}`);
  }
};
const selected = (list) => b.evaluate(`document.querySelector('[role="tablist"][aria-label="${list}"] [aria-selected="true"]')?.textContent.trim() ?? ""`);
const scrollTo = (sel) => b.evaluate(`document.querySelector(${JSON.stringify(sel)}).scrollIntoView({ block: "center" })`);

let ok = false;
try {
  ok = await scenario(b, [
    ["open /horizon as a visitor and see the hero", async () => {
      await b.goto(`${base}/horizon`);
      await b.until(`!!document.querySelector("h1")`, 20000, "the headline");
      const h1 = await b.evaluate(`document.querySelector("h1").textContent`);
      if (!/horizon/i.test(h1)) throw new Error(`headline is "${h1}"`);
      await b.until(`!document.querySelector('button[data-news]').disabled`, 10000, "the news button is ready");
      await b.sleep(600);
      await b.shot("01-hero");
      await b.shot("00-full", { full: true });
    }],
    ["no sideways scroll", noSideways],
    ["the nav marks Horizon and the page names no date", async () => {
      const text = await b.evaluate(`document.body.innerText`);
      if (/\b(20\d\d|january|february|march|april|june|july|august|september|october|november|december)\b/i.test(text.replace(/©.*$/gm, ""))) throw new Error("a date is promised");
      return `Horizon links: ${await b.evaluate(`document.querySelectorAll('a[href="/horizon"]').length`)}`;
    }],
    ["the step tabs change the slide and the caption", async () => {
      await scrollTo('[aria-label="From brief to film"]');
      await b.sleep(300);
      const start = await selected("From brief to film");
      await b.click('[role="tab"]', "Script");
      await b.until(`document.querySelector('#step-panel').innerText.includes("Script next.")`, 3000, "script caption");
      await b.key("ArrowRight");
      await b.until(`document.querySelector('#step-panel').innerText.includes("Scenes in order.")`, 3000, "arrow key moves on");
      const live = await b.evaluate(`document.querySelector('#step-panel [aria-live]').textContent`);
      if (live !== "Slide 3 of 5") throw new Error(`live region says "${live}"`);
      await b.sleep(600);
      await b.shot("02-steps");
      return `started on ${start}`;
    }],
    ["a side slide can be picked with the mouse", async () => {
      await b.evaluate(`document.querySelectorAll('#step-panel li button')[3].click()`);
      await b.until(`document.querySelector('#step-panel').innerText.includes("Sound to match.")`, 3000, "sound caption");
    }],
    ["the look chips swap the picture", async () => {
      await scrollTo('[aria-label="Film look"]');
      await b.click('[aria-label="Film look"] [role="tab"]', "Dusk");
      await b.until(`!!document.querySelector('[data-artwork="horizon/look-dusk"]')`, 3000, "dusk picture");
      await b.sleep(500);
      await b.shot("03-look");
    }],
    ["the closer look rows: stages pill and compare handle", async () => {
      await scrollTo("#closer-title");
      await b.sleep(300);
      await b.shot("04-closer");
      await b.click('[role="tab"]', "Shots");
      await b.until(`!!document.querySelector('[data-artwork="horizon/plan-3"]')`, 3000, "stage 3 picture");
      await b.evaluate(`document.querySelector('input[type="range"]').focus()`);
      await b.key("ArrowLeft");
      await b.key("ArrowLeft");
      const v = await b.evaluate(`document.querySelector('input[type="range"]').value`);
      if (v !== "48") throw new Error(`compare value is ${v}`);
      await scrollTo('input[type="range"]');
      await b.sleep(300);
      await b.shot("05-compare");
    }],
    ["what you get", async () => {
      await scrollTo("#get-title");
      await b.sleep(400);
      await b.shot("06-get");
    }],
    ["a visitor pressing Get launch news is asked to join", async () => {
      await b.evaluate(`window.scrollTo(0, 0)`);
      await b.click("button[data-news]");
      await b.until(`!!document.querySelector('[role="dialog"]')`, 5000, "the join window");
      await b.until(`!!document.querySelector('[role="status"]')`, 3000, "the note");
      await b.sleep(400);
      await b.shot("07-join");
      await b.key("Escape");
      await b.until(`!document.querySelector('[role="dialog"]')`, 3000, "closed");
      const back = await b.evaluate(`document.activeElement?.dataset.news ?? document.activeElement?.tagName`);
      if (back !== "off") throw new Error(`focus went to ${back}`);
    }],
    ["a member turns launch news on and off", async () => {
      const email = `horizon-${Date.now()}@example.com`;
      const r = await b.evaluate(`fetch("/api/auth/signup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "${email}", password: "horizon-pass-1234", name: "Horizon Tester" }) }).then((r) => r.status)`);
      if (r !== 200 && r !== 201) throw new Error(`signup answered ${r}`);
      await b.reload();
      await b.until(`!!document.querySelector('button[data-news]') && !document.querySelector('button[data-news]').disabled`, 10000, "the news button");
      await b.click("button[data-news]");
      await b.until(`document.querySelector('button[data-news]').dataset.news === "on"`, 5000, "news on");
      const prefs = JSON.parse(await b.evaluate(`fetch("/api/account/preferences").then((r) => r.text())`));
      if (prefs.preferences.notices.productNews !== true) throw new Error("productNews is not on in the server");
      await b.sleep(300);
      await b.shot("08-news-on");
      await b.click('[role="status"] button', "Turn off");
      await b.until(`document.querySelector('button[data-news]').dataset.news === "off"`, 5000, "news off");
      const after = JSON.parse(await b.evaluate(`fetch("/api/account/preferences").then((r) => r.text())`));
      if (after.preferences.notices.productNews !== false) throw new Error("productNews is still on");
    }],
    ["open /guide and see real credit numbers", async () => {
      await b.goto(`${base}/guide`);
      await b.until(`!!document.querySelector("h1") && !!document.querySelector("#credits")`, 20000, "the guide");
      const text = await b.evaluate(`document.querySelector("#credits").innerText`);
      for (const want of ["150", "60", "$0.05", "400", "1,200", "3,600"]) if (!text.includes(want)) throw new Error(`credits section lacks "${want}"`);
      await b.sleep(500);
      await b.shot("09-guide");
      await b.shot("09-guide-full", { full: true });
    }],
    ["guide: no sideways scroll", noSideways],
    ["guide: every studio has a link and the balance shows", async () => {
      const links = await b.evaluate(`[...document.querySelectorAll('#studios a')].map((a) => a.getAttribute("href")).join(",")`);
      for (const want of ["/image", "/video", "/audio", "/cinema", "/library", "/horizon"]) if (!links.split(",").includes(want)) throw new Error(`no link to ${want}: ${links}`);
      await b.until(`document.querySelector("#credits").innerText.includes("Your balance")`, 5000, "the member's balance");
      return links;
    }],
    ["guide: the example prompt opens the Image studio with it", async () => {
      const href = await b.evaluate(`document.querySelector('#prompts a[href^="/image"]').getAttribute("href")`);
      if (!href.includes("prompt=")) throw new Error(`link is ${href}`);
      await scrollTo("#prompts");
      await b.sleep(300);
      await b.shot("10-prompts");
      return href.slice(0, 60);
    }],
  ]);
} finally {
  await b.close();
}
process.exit(ok ? 0 : 1);
