// The home page (/) and the Explore feed (/explore), from an empty community to a shared post.
// Run it with: python3 tests/run.py tests/ui/home.mjs
// (the runner starts the app in mock mode on a fresh data folder and calls:
//  node tests/ui/home.mjs <base-url> <out-dir> [width] [height])
import { launch, scenario } from "./browser.mjs";

const [base, out, W = "1440", H = "900"] = process.argv.slice(2);
const width = Number(W);
const b = await launch({ width, height: Number(H), out });

const noSideways = async () => {
  const wide = await b.evaluate(`document.documentElement.scrollWidth > window.innerWidth + 1`);
  if (wide) {
    const who = await b.evaluate(`[...document.querySelectorAll("body *")].filter((e) => e.getBoundingClientRect().right > window.innerWidth + 1 && !e.closest(".overflow-hidden, .overflow-x-auto, [aria-hidden=true]")).slice(0, 3).map((e) => e.tagName + "." + String(e.className).slice(0, 60)).join(" | ")`);
    throw new Error(`page is wider than the window: ${who}`);
  }
};
const scrollTo = (sel) => b.evaluate(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false; el.scrollIntoView({ block: "start" }); window.scrollBy(0, -60); return true; })()`);

// Runs in the page: sign up, generate in mock mode, wait for the result, publish it.
const seed = `(async () => {
  const j = async (path, init) => {
    const r = await fetch(path, { ...init, headers: { "content-type": "application/json" } });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(path + " " + r.status + " " + JSON.stringify(body));
    return body;
  };
  await j("/api/auth/signup", { method: "POST", body: JSON.stringify({ email: "maker" + Date.now() + "@example.com", password: "a-long-password-1", name: "Ada Maker" }) });
  const made = [];
  const run = async (modelId, prompt, title, tags) => {
    const { jobs } = await j("/api/jobs", { method: "POST", body: JSON.stringify({ modelId, prompt, count: 1 }) }); const job = jobs[0];
    let cur = job;
    for (let i = 0; i < 120 && cur.status !== "succeeded" && cur.status !== "failed"; i++) {
      await new Promise((r) => setTimeout(r, 500));
      cur = (await j("/api/jobs/" + job.id)).job;
    }
    if (cur.status !== "succeeded") throw new Error("job " + cur.status);
    const { post } = await j("/api/community/posts", { method: "POST", body: JSON.stringify({ assetId: cur.assets[0].id, title, tags, allowRecreate: true }) });
    made.push(post.id);
  };
  await run("flux-schnell", "a paper boat on a still mountain lake at dawn", "Paper boat", ["lake", "dawn"]);
  await run("flux-schnell", "a lighthouse in fog, long exposure", "Lighthouse", ["fog"]);
  let video = "skipped";
  try { await run("veo-3.1-lite", "waves rolling onto a black sand beach", "Black sand", ["sea"]); video = "ok"; } catch (e) { video = String(e.message).slice(0, 120); }
  return JSON.stringify({ made: made.length, video });
})()`;

let ok = false;
try {
  ok = await scenario(b, [
    ["open / with an empty community", async () => {
      await b.goto(`${base}/`);
      await b.until(`!!document.querySelector('[aria-roledescription="carousel"]')`, 15000, "the carousel");
      await b.until(`document.querySelectorAll('[data-empty]').length >= 3`, 15000, "empty states in the community sections");
      await b.sleep(700);
      await b.shot("01-top");
      const h2 = await b.evaluate(`[...document.querySelectorAll("main h2")].map((h) => h.textContent.trim()).join(" | ")`);
      return h2;
    }],
    ["no sideways scroll on /", noSideways],
    ["the open contest has a banner", async () => {
      await b.until(`!!document.querySelector('[data-section="contest"]')`, 10000, "contest banner");
      await scrollTo('[data-section="contest"]');
      await b.sleep(400);
      await b.shot("02-mcp-contest");
      const href = await b.evaluate(`document.querySelector('[data-section="contest"] a').getAttribute("href")`);
      if (!href.startsWith("/contests/")) throw new Error(`contest link is ${href}`);
      return href;
    }],
    ["empty sections invite the first post", async () => {
      await scrollTo('[data-section="shorts"]');
      await b.sleep(400);
      await b.shot("03-empty-shorts");
      const ctas = await b.evaluate(`[...document.querySelectorAll("[data-empty] a")].map((a) => a.getAttribute("href")).join(",")`);
      if (!ctas) throw new Error("no button in the empty state");
      return ctas;
    }],
    ["carousel arrows and dots move it", async () => {
      await b.evaluate(`window.scrollTo(0, 0)`);
      await b.sleep(200);
      const before = await b.evaluate(`[...document.querySelectorAll('[aria-roledescription="carousel"] button[aria-current]')].map((x) => x.getAttribute("aria-label")).join()`);
      if (width >= 640) {
        await b.hover('[aria-roledescription="carousel"] li');
        await b.sleep(200);
        await b.click('[aria-roledescription="carousel"] button', "Next slide");
      } else {
        await b.click('[aria-roledescription="carousel"] button', "Slide 2 of");
      }
      await b.sleep(700);
      const after = await b.evaluate(`[...document.querySelectorAll('[aria-roledescription="carousel"] button[aria-current]')].map((x) => x.getAttribute("aria-label")).join()`);
      if (before === after) throw new Error(`still on ${after}`);
      await b.shot("04-carousel-next");
      return `${before} -> ${after}`;
    }],
    ["share three posts as a member", async () => {
      const r = await b.evaluate(seed);
      return r;
    }],
    ["the home grids show real posts", async () => {
      await b.goto(`${base}/`);
      await b.until(`document.querySelectorAll('[data-section="trending"] article').length >= 2`, 15000, "tiles in trending");
      await scrollTo('[data-section="shorts"]');
      await b.sleep(800);
      await b.shot("05-shorts");
      await scrollTo('[data-section="trending"]');
      await b.until(`[...document.querySelectorAll('[data-section="trending"] article img')].every((i) => i.complete)`, 10000, "pictures loaded");
      await b.sleep(500);
      await b.shot("06-trending");
      await scrollTo('[data-section="fresh"]');
      await b.sleep(500);
      await b.shot("07-fresh");
      await scrollTo('[data-section="image"]');
      await b.sleep(500);
      await b.shot("08-image");
      const link = await b.evaluate(`document.querySelector('[data-section="trending"] article a').getAttribute("href")`);
      if (!link.startsWith("/community/post/")) throw new Error(`tile links to ${link}`);
      const models = await b.evaluate(`[...document.querySelectorAll('[data-section^="model-"] h2')].map((h) => h.textContent).join(",")`);
      return `tile -> ${link}; model sections: ${models || "none"}`;
    }],
    ["the bottom of the page", async () => {
      await scrollTo("#home-more");
      await b.sleep(400);
      await b.shot("09-more");
    }],
    ["no sideways scroll with posts", noSideways],
    ["open /explore", async () => {
      await b.goto(`${base}/explore`);
      await b.until(`document.querySelectorAll('ul[aria-label="Community work"] article').length >= 2`, 15000, "explore tiles");
      await b.sleep(800);
      await b.shot("10-explore");
    }],
    ["no sideways scroll on /explore", noSideways],
    ["tabs and filters change the feed", async () => {
      await b.click("button", "Top");
      await b.until(`!!document.querySelector('[aria-label="Period"]')`, 5000, "period row");
      await b.click('[aria-label="Period"] button', "All time");
      await b.until(`location.search.includes("period=all")`, 3000, "period in the address");
      await b.click('[role="toolbar"] button', "Images");
      await b.until(`location.search.includes("kind=image")`, 3000, "kind in the address");
      await b.until(`document.querySelectorAll('ul[aria-label="Community work"] article').length >= 2`, 10000, "image tiles");
      await b.click('[aria-label="Popular tags"] button', "fog");
      await b.until(`document.querySelectorAll('ul[aria-label="Community work"] article').length === 1`, 10000, "one tile tagged fog");
      await b.sleep(500);
      await b.shot("11-filtered");
      await b.click('[aria-label="Popular tags"] button', "Clear tag");
      await b.click('[role="toolbar"] button', "Audio");
      await b.until(`document.body.innerText.includes("Nothing here yet")`, 10000, "empty audio feed");
      await b.shot("12-empty-filter");
      await b.click('[role="toolbar"] button', "All");
    }],
    ["a member likes and saves a post", async () => {
      await b.click('[role="toolbar"] button', "Trending");
      await b.until(`document.querySelectorAll('ul[aria-label="Community work"] article').length >= 2`, 10000, "tiles");
      await b.hover('ul[aria-label="Community work"] article');
      await b.sleep(200);
      await b.click('ul[aria-label="Community work"] article button', "Like");
      await b.until(`document.querySelector('ul[aria-label="Community work"] article button[aria-pressed="true"]')?.textContent.trim() === "1"`, 5000, "liked, count 1");
      await b.click('ul[aria-label="Community work"] article button', "Save");
      await b.until(`document.querySelectorAll('ul[aria-label="Community work"] article:first-child button[aria-pressed="true"], ul[aria-label="Community work"] li:first-child button[aria-pressed="true"]').length === 2`, 5000, "saved");
      await b.shot("13-liked");
      const post = await b.evaluate(`fetch("/api/explore?tab=new&limit=60").then((r) => r.json()).then((d) => JSON.stringify(d.posts.map((p) => [p.counts.likes, p.counts.saves])))`);
      return post;
    }],
    ["signed out: like asks to sign in", async () => {
      await b.evaluate(`fetch("/api/auth/logout", { method: "POST" })`);
      await b.goto(`${base}/explore`);
      await b.until(`document.querySelectorAll('ul[aria-label="Community work"] article').length >= 2`, 15000, "tiles");
      await b.hover('ul[aria-label="Community work"] article');
      await b.click('ul[aria-label="Community work"] article button', "Like");
      await b.until(`!!document.querySelector('[role="dialog"]')`, 5000, "sign-in dialog");
      await b.sleep(300);
      await b.shot("14-signin");
      await b.key("Escape");
      await b.until(`!document.querySelector('[role="dialog"]')`, 3000, "dialog closed");
    }],
    ["signed out: Following asks to sign in", async () => {
      await b.click('[role="toolbar"] button', "Following");
      await b.until(`document.body.innerText.includes("Sign in to see new work")`, 5000, "following prompt");
      await b.shot("15-following-signed-out");
    }],
    ["a guest may like", async () => {
      await b.evaluate(`fetch("/api/auth/guest", { method: "POST" })`);
      await b.goto(`${base}/explore`);
      await b.until(`document.querySelectorAll('ul[aria-label="Community work"] article').length >= 2`, 15000, "tiles");
      await b.sleep(400);
      await b.hover('ul[aria-label="Community work"] li:nth-child(2) article');
      await b.click('ul[aria-label="Community work"] li:nth-child(2) article button', "Like");
      await b.until(`document.querySelector('ul[aria-label="Community work"] li:nth-child(2) button[aria-pressed="true"]') !== null`, 5000, "guest like");
      if (await b.evaluate(`!!document.querySelector('[role="dialog"]')`)) throw new Error("guest was asked to sign in");
    }],
    ["keyboard reaches the carousel and a tile", async () => {
      await b.goto(`${base}/`);
      await b.until(`document.querySelectorAll('[data-section="trending"] article').length >= 2`, 15000, "tiles");
      for (let i = 0; i < 40; i++) {
        await b.key("Tab");
        if (await b.evaluate(`!!document.activeElement?.closest('[aria-roledescription="carousel"]')`)) break;
      }
      const inCarousel = await b.evaluate(`!!document.activeElement?.closest('[aria-roledescription="carousel"]')`);
      if (!inCarousel) throw new Error("Tab never reached the carousel");
      await b.shot("16-focus");
    }],
  ]);
} finally {
  await b.close();
}
process.exit(ok ? 0 : 1);
