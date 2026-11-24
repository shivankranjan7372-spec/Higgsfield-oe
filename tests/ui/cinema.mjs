// The Shot Planner (/cinema) from a first visit to a planned, shot and exported film.
// Run it with: python3 tests/run.py tests/ui/cinema.mjs
// (the runner starts the app in mock mode and calls: node tests/ui/cinema.mjs <base-url> <out-dir> [width] [height])
import { launch, scenario } from "./browser.mjs";

const [base, out, W = "1440", H = "900"] = process.argv.slice(2);
const narrow = Number(W) < 1024;
const b = await launch({ width: Number(W), height: Number(H), out });
const takes = `ul[aria-label="Takes"] li`;
const shotCards = `#cinema-storyboard li.group`;

const wide = () => b.evaluate(`document.documentElement.scrollWidth > window.innerWidth + 1`);
async function noSideways() {
  if (await wide()) throw new Error("page is wider than the window");
}
/** On a phone the sidebar is a sheet: open it first. */
async function sidebar() {
  if (!narrow) return;
  if (await b.evaluate(`!!document.querySelector('button[aria-label="Close the menu"]')`)) return;
  await b.click('button[aria-label="Open the menu"]');
  await b.until(`!!document.querySelector('aside nav')`, 3000, "sidebar sheet");
  await b.sleep(250);
}
async function closeSidebar() {
  if (!narrow) return;
  if (await b.evaluate(`!!document.querySelector('button[aria-label="Close the menu"]')`)) {
    await b.key("Escape");
    await b.click('button[aria-label="Hide the sidebar"]');
    await b.sleep(200);
  }
}
const api = (path, method = "GET", body) =>
  b.evaluate(`fetch(${JSON.stringify(path)}, { method: ${JSON.stringify(method)}, headers: { "content-type": "application/json" }, body: ${body ? JSON.stringify(JSON.stringify(body)) : "undefined"} }).then((r) => r.text())`).then((t) => JSON.parse(t));

let ok = false;
try {
  ok = await scenario(b, [
    ["open /cinema signed out and see the workspace", async () => {
      await b.goto(`${base}/cinema`);
      await b.until(`!!document.querySelector("h1") && !!document.querySelector("textarea")`, 15000, "headline and composer");
      await b.until(`!!document.querySelector('button[aria-label^="Camera:"]')`, 5000, "parameter cards");
      await b.sleep(800);
      await b.shot("01-signed-out");
      const h1 = await b.evaluate(`document.querySelector("h1").textContent`);
      return `headline "${h1}"`;
    }],
    ["no sideways scroll", noSideways],
    ["the logo goes home", async () => {
      const href = await b.evaluate(`[...document.querySelectorAll('a[aria-label="Back to the Parallax home page"]')].filter((a) => a.getClientRects().length).map((a) => a.getAttribute("href"))[0]`);
      if (href !== "/") throw new Error(`logo links to ${href}`);
    }],
    ["signed out: the sidebar invites a log in", async () => {
      await sidebar();
      await b.until(`[...document.querySelectorAll("aside button")].some((x) => x.textContent.includes("Log in"))`, 5000, "log in button");
      await b.shot("02-sidebar-signed-out");
      await b.click("aside button", "Log in");
      await b.until(`!!document.querySelector('[role="dialog"]')`, 3000, "login window");
      await b.key("Escape");
      await b.sleep(200);
      await closeSidebar();
    }],
    ["the camera card opens and picks a close-up", async () => {
      await b.click('button[aria-label^="Camera:"]');
      await b.until(`document.querySelectorAll('[role="menuitemradio"]').length > 10`, 5000, "camera presets");
      await b.sleep(300);
      await b.shot("03-camera");
      await b.click('[role="group"][aria-label="Shot size"] [role="menuitemradio"]', "Medium close-up");
      await b.click('[role="group"][aria-label="Angle"] [role="menuitemradio"]', "Low angle");
      await b.key("Escape");
      await b.until(`!!document.querySelector('button[aria-label^="Camera: Medium close-up"]')`, 3000, "card shows the size");
    }],
    ["the colour grade card sets a look", async () => {
      await b.click('button[aria-label^="Colour grade:"]');
      await b.until(`document.querySelectorAll('[role="menuitemradio"]').length > 3`, 5000, "grades");
      await b.click('[role="menuitemradio"]', "Cold steel");
      await b.key("Escape");
      await b.until(`!!document.querySelector('button[aria-label="Colour grade: Cold steel"]')`, 3000, "card shows the grade");
    }],
    ["typing an action and generating makes the first project and a take", async () => {
      await b.click("textarea");
      await b.type("A lighthouse keeper wipes the great lens and looks out to sea");
      await b.shot("04-typed");
      await b.key("Enter");
      await b.until(`document.querySelectorAll('${takes}').length >= 1`, 20000, "a pending take");
      await b.sleep(300);
      await b.shot("05-pending");
      await b.until(`document.querySelectorAll('${takes} img').length >= 1`, 60000, "a finished still");
      await b.until(`[...document.querySelectorAll('${takes} img')].every((i) => i.complete && i.naturalWidth > 0)`, 15000, "still loaded");
      await b.sleep(500);
      await b.shot("06-take");
    }],
    ["the composed prompt carries the picked parameters", async () => {
      await b.until(`(document.querySelector('[data-testid="composed-prompt"]')?.textContent || "").includes("close-up")`, 8000, "prompt with the shot size");
      const p = await b.evaluate(`document.querySelector('[data-testid="composed-prompt"]').textContent`);
      if (!/lighthouse keeper/i.test(p)) throw new Error(`prompt: ${p}`);
      await b.until(`document.querySelectorAll('#cinema-top img').length >= 2`, 8000, "poster shows the still");
      return p.slice(0, 80);
    }],
    ["the action typed before the project existed is kept", async () => {
      await b.until(`document.querySelector("textarea").value.includes("lighthouse keeper")`, 5000, "action in the box");
    }],
    ["the poster row shows the shot's still and the title replaces the headline", async () => {
      await b.evaluate(`document.getElementById("cinema-top").scrollTo(0, 0)`);
      await b.until(`document.querySelector("h1").textContent.includes("Untitled film")`, 5000, "project title");
      await b.sleep(400);
      await b.shot("07-workspace");
    }],
    ["video makes a take from the still", async () => {
      await b.click('[role="radio"]', "Video");
      await b.until(`(document.querySelector('[data-testid="composed-prompt"]')?.parentElement.textContent || "").includes("starts from")`, 8000, "animate note");
      await b.click("button", "Generate");
      await b.until(`document.querySelectorAll('${takes}').length >= 2`, 20000, "a second take");
      await b.until(`document.querySelectorAll('${takes} video').length >= 1`, 60000, "a finished video");
      await b.sleep(400);
      await b.shot("08-video");
      await b.click('[role="radio"]', "Image");
    }],
    ["pick a take as the chosen one", async () => {
      await b.hover(`${takes}:last-child`);
      await b.click(`${takes}:last-child button`, "Use this take");
      await b.until(`!!document.querySelector('${takes}:last-child button[aria-pressed="true"]')`, 5000, "chosen");
    }],
    ["storyboard: add, duplicate, reorder and delete shots", async () => {
      await b.click("#cinema-storyboard button", "Add shot");
      await b.until(`document.querySelectorAll('${shotCards}').length === 2`, 8000, "two shots");
      await b.click(`${shotCards} button[aria-label^="Shot options"]`);
      await b.until(`!!document.querySelector('[role="menuitemradio"]')`, 3000, "shot menu");
      await b.click('[role="menuitemradio"]', "Duplicate");
      await b.until(`document.querySelectorAll('${shotCards}').length === 3`, 8000, "three shots");
      const before = await b.evaluate(`[...document.querySelectorAll('${shotCards}')].map((l) => l.dataset.shot).join("|")`);
      await b.sleep(400);
      await b.click(`${shotCards} button[aria-label^="Shot options"]`);
      await b.until(`!!document.querySelector('[role="menuitemradio"]')`, 3000, "shot menu");
      await b.click('[role="menuitemradio"]', "Move later");
      await b.until(`[...document.querySelectorAll('${shotCards}')].map((l) => l.dataset.shot).join("|") !== ${JSON.stringify(before)}`, 8000, "order changed");
      await b.sleep(400);
      await b.click(`${shotCards}:nth-child(3) button[aria-label^="Shot options"]`);
      await b.until(`!!document.querySelector('[role="menuitemradio"]')`, 3000, "shot menu");
      await b.click('[role="menuitemradio"]', "Delete");
      await b.until(`document.querySelectorAll('${shotCards}').length === 2`, 8000, "two shots again");
      await b.click("#cinema-storyboard button", "Add scene");
      await b.until(`document.querySelectorAll('#cinema-storyboard [data-scene]').length === 2`, 8000, "two scenes");
      await b.evaluate(`document.getElementById("cinema-storyboard").scrollIntoView()`);
      await b.sleep(400);
      await b.shot("09-storyboard");
    }],
    ["cast: make a character from a picture and put it in the shot", async () => {
      await b.click('button[aria-label^="Add cast from your pictures"]');
      await b.until(`!!document.querySelector('[role="dialog"]')`, 3000, "cast window");
      await b.click('[role="dialog"] button', "New");
      await b.until(`!!document.querySelector('[role="dialog"] input')`, 3000, "form");
      await b.click('[role="dialog"] input[placeholder="Ada"]');
      await b.type("Ada");
      await b.until(`document.querySelectorAll('[role="dialog"] button[aria-pressed]').length >= 1`, 8000, "your images");
      await b.click('[role="dialog"] button[aria-pressed]');
      await b.shot("10-cast-form");
      await b.click('[role="dialog"] button[type="submit"]');
      await b.until(`[...document.querySelectorAll('[role="dialog"] li')].some((l) => l.textContent.includes("Ada"))`, 8000, "Ada listed");
      await b.shot("11-cast-list");
      await b.key("Escape");
      await b.sleep(200);
      await b.click('button[aria-label^="Cast:"]');
      await b.click('[role="menuitemcheckbox"]', "Ada");
      await b.until(`!!document.querySelector('[role="menuitemcheckbox"][aria-checked="true"]')`, 5000, "Ada in shot");
      await b.key("Escape");
      await b.until(`(document.querySelector('[data-testid="composed-prompt"]')?.textContent || "").includes("Ada")`, 8000, "prompt features Ada");
    }],
    ["batch: make every missing still", async () => {
      await b.click("#cinema-storyboard button", "Make missing stills");
      await b.until(`[...document.querySelectorAll('[role="dialog"]')].some((d) => d.textContent.includes("no still"))`, 8000, "quote");
      await b.shot("12-batch");
      await b.click('[role="dialog"] button', "Start");
      await b.until(`document.querySelectorAll('${shotCards} img').length >= 2`, 60000, "stills for the shots");
    }],
    ["export offers JSON and CSV", async () => {
      await b.click("#cinema-storyboard button", "Export");
      await b.until(`document.querySelectorAll('a[href*="/export?format="]').length === 2`, 3000, "export links");
      const csv = await b.evaluate(`fetch(document.querySelector('a[href*="format=csv"]').getAttribute("href")).then((r) => r.status)`);
      await b.key("Escape");
      if (csv !== 200) throw new Error(`csv answered ${csv}`);
    }],
    ["projects: rename, make a second, switch and delete", async () => {
      await sidebar();
      await b.hover('aside ul[aria-label="Projects"] li');
      await b.click('aside button[aria-label^="Project options"]');
      await b.click('[role="menuitemradio"]', "Rename");
      await b.until(`!!document.querySelector('[role="dialog"] input')`, 3000, "rename field");
      await b.evaluate(`(() => { const i = document.querySelector('[role="dialog"] input'); i.select(); })()`);
      await b.type("The Lighthouse Keeper");
      await b.key("Enter");
      await b.until(`document.querySelector("h1").textContent.includes("Lighthouse")`, 8000, "new title");
      await sidebar();
      await b.click("aside button", "New project");
      await b.sleep(600);
      await sidebar();
      await b.until(`[...document.querySelectorAll('aside ul[aria-label="Projects"] li')].filter((l) => l.getClientRects().length).length === 2`, 8000, "two projects");
      await sidebar();
      await b.shot("13-two-projects");
      await b.click('aside ul[aria-label="Projects"] li button', "Lighthouse");
      await b.until(`document.querySelector("h1").textContent.includes("Lighthouse")`, 8000, "switched back");
      await sidebar();
      await b.hover('aside ul[aria-label="Projects"] li');
      await b.click('aside ul[aria-label="Projects"] button[aria-label^="Project options"]', "Untitled film");
      const second = "Untitled film";
      await b.click('[role="menuitemradio"]', "Delete");
      await b.click('[role="dialog"] button', "Delete project");
      await b.until(`[...document.querySelectorAll('aside ul[aria-label="Projects"] li')].filter((l) => l.getClientRects().length).length === 1`, 8000, "one project left");
      await closeSidebar();
      return `deleted "${second}"`;
    }],
    ["the server's message shows when a take fails", async () => {
      const shots = await b.evaluate(`document.querySelectorAll('${shotCards}').length`);
      await b.click(`${shotCards} button[aria-label^="Show shot"]`);
      await b.click("textarea");
      await b.type(" [fail]");
      await b.key("Enter");
      await b.until(`[...document.querySelectorAll('${takes}')].some((l) => l.dataset.status === "failed")`, 60000, "a failed take");
      await b.sleep(300);
      await b.shot("14-failed");
      return `${shots} shots`;
    }],
    ["no sideways scroll at the end", async () => {
      await b.evaluate(`document.getElementById("cinema-top").scrollTo(0, 0)`);
      await b.sleep(300);
      await b.shot("15-end");
      await noSideways();
    }],
    ["the project survives a reload", async () => {
      await b.reload();
      await b.until(`document.querySelector("h1")?.textContent.includes("Lighthouse")`, 15000, "project after reload");
      const me = await api("/api/auth/me");
      return `balance ${me.balance}`;
    }],
  ]);
} finally {
  await b.close();
}
process.exit(ok ? 0 : 1);
