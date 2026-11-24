// The Remix studio from first visit to a finished mock remix, a failed one and the large view.
// Run it with: python3 tests/run.py tests/ui/remix.mjs
// (the runner starts the app in mock mode and calls: node tests/ui/remix.mjs <base-url> <out-dir> [width] [height])
import { launch, scenario } from "./browser.mjs";

const [base, out, W = "1440", H = "900"] = process.argv.slice(2);
const b = await launch({ width: Number(W), height: Number(H), out });
const tiles = `ul[aria-label="Your remixes"] li`;
const promptSwitch = `button#remix-prompt-switch[role="switch"]`;
const noSideways = async () => {
  if (await b.evaluate(`document.documentElement.scrollWidth > window.innerWidth + 1`)) throw new Error("page is wider than the window");
};
// Makes a small PNG in the page and hands it to the source picture's file input.
const upload = (index) => `(async () => {
  const c = document.createElement("canvas"); c.width = 320; c.height = 180;
  const g = c.getContext("2d"); const grad = g.createLinearGradient(0, 0, 320, 180);
  grad.addColorStop(0, "#335"); grad.addColorStop(1, "#c84"); g.fillStyle = grad; g.fillRect(0, 0, 320, 180);
  const blob = await new Promise((r) => c.toBlob(r, "image/png"));
  const dt = new DataTransfer(); dt.items.add(new File([blob], "source.png", { type: "image/png" }));
  const input = document.querySelectorAll('section[aria-label="Remix settings"] input[type=file]')[${index}];
  input.files = dt.files; input.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
})()`;

let ok = false;
try {
  ok = await scenario(b, [
    ["open /remix and see the form and the directions", async () => {
      await b.goto(`${base}/remix`);
      await b.until(`!!document.querySelector("h1") && document.querySelector("h1").innerText.toLowerCase().includes("remix")`);
      await b.until(`!!document.querySelector('${promptSwitch}[aria-checked="false"]') && !document.querySelector("textarea#remix-prompt") && document.querySelectorAll('ul[aria-label="Sample directions"] li').length >= 6`, 15000, "the Prompt switch, off, and the directions");
      await b.until(`!!document.querySelector('button[aria-label="Mode: Standard"]') && !!document.querySelector('button[aria-label^="Quality: "]')`, 5000, "mode and quality rows");
      await b.sleep(900);
      await b.shot("01-open");
    }],
    ["no sideways scroll", noSideways],
    ["Mode, Quality and Generate are all in view, none under another", async () => {
      if (Number(W) < 1024) return "phone layout: the page scrolls as one column";
      const boxes = JSON.parse(await b.evaluate(`JSON.stringify(['button[aria-label^="Mode:"]', 'button[aria-label^="Quality:"]', 'section[aria-label="Remix settings"] button[type="submit"]'].map((q) => { const r = document.querySelector(q).getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom) }; }))`));
      const [modeRow, quality, generate] = boxes;
      const panel = JSON.parse(await b.evaluate(`(() => { const r = document.querySelector('section[aria-label="Remix settings"] form > div').getBoundingClientRect(); return JSON.stringify({ top: Math.round(r.top), bottom: Math.round(r.bottom) }); })()`));
      if (!(modeRow.bottom <= quality.top && quality.bottom <= generate.top)) throw new Error(`rows overlap: ${JSON.stringify(boxes)}`);
      if (quality.bottom > panel.bottom) throw new Error(`Quality runs past the scroll area: ${JSON.stringify({ quality, panel })}`);
      return `Quality ends ${generate.top - quality.bottom}px above Generate`;
    }],
    ["Generate with nothing filled in asks for the source picture", async () => {
      await b.click("button", "Generate");
      await b.until(`!!document.querySelector('[role="alert"]') && document.querySelector('[role="alert"]').innerText.toLowerCase().includes("source picture")`, 5000, "an alert about the source picture");
      await b.shot("02-blocked");
      await b.click('[role="alert"] button', "Dismiss");
      await b.until(`!document.querySelector('[role="alert"]')`, 3000, "alert gone");
    }],
    ["a category narrows the directions", async () => {
      const all = await b.evaluate(`document.querySelectorAll('ul[aria-label="Sample directions"] li').length`);
      await b.click('[role="tab"]', "Animals");
      await b.until(`document.querySelectorAll('ul[aria-label="Sample directions"] li').length < ${all}`, 3000, "fewer tiles");
      await b.shot("03-category");
      await b.click('[role="tab"]', "All");
    }],
    ["a sample direction turns the Prompt switch on and fills the box", async () => {
      await b.click('ul[aria-label="Sample directions"] button');
      await b.until(`!!document.querySelector('${promptSwitch}[aria-checked="true"]') && document.querySelector("textarea#remix-prompt")?.value.length > 20`, 3000, "prompt filled");
    }],
    ["the Prompt switch closes the box and brings the words back", async () => {
      const words = await b.evaluate(`document.querySelector("textarea#remix-prompt").value`);
      await b.click(promptSwitch);
      await b.until(`!!document.querySelector('${promptSwitch}[aria-checked="false"]') && !document.querySelector("textarea#remix-prompt")`, 3000, "box closed");
      await b.click(promptSwitch);
      await b.until(`document.querySelector("textarea#remix-prompt")?.value === ${JSON.stringify(words)}`, 3000, "the same words");
      const where = await b.evaluate(`document.activeElement?.id || ""`);
      if (where !== "remix-prompt") throw new Error(`the cursor went to "${where}", not the prompt box`);
      await b.sleep(300);
      await b.shot("03b-prompt-open");
    }],
    ["the Mode row switches models", async () => {
      await b.click('button[aria-label^="Mode:"]');
      await b.until(`document.querySelectorAll('[role="menuitemradio"]').length === 2`, 5000, "two modes");
      await b.sleep(300);
      await b.shot("04-mode");
      await b.click('[role="menuitemradio"]', "Pro");
      await b.until(`!!document.querySelector('button[aria-label="Mode: Pro"]')`, 3000, "Pro chosen");
      await b.click('button[aria-label^="Mode:"]');
      await b.until(`document.querySelectorAll('[role="menuitemradio"]').length === 2`, 5000, "two modes");
      await b.click('[role="menuitemradio"]', "Standard");
      await b.until(`!!document.querySelector('button[aria-label="Mode: Standard"]')`, 3000, "Standard again");
    }],
    ["the Quality row sets the model's resolution, Escape closes it", async () => {
      await b.click('button[aria-label^="Quality:"]');
      await b.until(`document.querySelectorAll('[role="menuitemradio"]').length >= 2`, 5000, "sizes");
      await b.sleep(300);
      await b.shot("05-quality");
      await b.click('[role="menuitemradio"]', "1080p");
      await b.until(`!!document.querySelector('button[aria-label="Quality: 1080p"]')`, 3000, "1080p chosen");
      await b.click('button[aria-label^="Quality:"]');
      await b.until(`document.querySelectorAll('[role="menuitemradio"]').length >= 2`, 5000, "sizes");
      await b.key("Escape");
      await b.until(`document.querySelectorAll('[role="menuitemradio"]').length === 0`, 3000, "menu closed");
      const where = await b.evaluate(`document.activeElement?.getAttribute("aria-label") || ""`);
      if (!where.startsWith("Quality")) throw new Error(`focus went to "${where}"`);
    }],
    ["a source picture uploads into the drop zone", async () => {
      await b.evaluate(upload(0));
      await b.until(`!!document.querySelector('section[aria-label="Remix settings"] img')`, 15000, "the picture in the zone");
      await b.sleep(400);
      await b.shot("06-source");
    }],
    ["Generate queues a remix and shows it in History", async () => {
      await b.click("button", "Generate");
      await b.until(`document.querySelectorAll('${tiles}').length >= 1`, 15000, "a pending tile");
      await b.sleep(400);
      await b.shot("07-pending");
      const meta = JSON.parse(await b.evaluate(`fetch("/api/jobs?surface=remix").then((r) => r.text())`));
      const job = meta.jobs[0];
      if (!job || job.surface !== "remix" || job.meta?.studio !== "remix" || !job.inputs?.start?.length) throw new Error(`job not tagged: ${JSON.stringify(job && { surface: job.surface, meta: job.meta, inputs: job.inputs })}`);
      return `model ${job.modelId}, ${job.params.resolution}`;
    }],
    ["the remix arrives and plays on hover", async () => {
      await b.until(`document.querySelectorAll('${tiles} video, ${tiles} img').length >= 1`, 90000, "a finished tile");
      await b.sleep(800);
      await b.hover(tiles);
      await b.sleep(500);
      await b.shot("08-done-hover");
    }],
    ["the large view favourites and reuses settings", async () => {
      await b.click(`${tiles} button`, "Open");
      await b.until(`!!document.querySelector('[role="dialog"]')`, 5000, "viewer");
      await b.sleep(500);
      await b.shot("09-viewer");
      await b.click('[role="dialog"] button', "Favourite");
      await b.until(`!!document.querySelector('[role="dialog"] button[aria-pressed="true"]')`, 5000, "marked");
      await b.until(`fetch("/api/jobs?surface=remix").then((r) => r.json()).then((d) => d.jobs[0].assets[0].favorite === true)`, 5000, "saved on the server");
      await b.click('[role="dialog"] button', "Use these settings");
      await b.until(`!document.querySelector('[role="dialog"]')`, 3000, "viewer closed");
      await b.until(`document.querySelector("textarea#remix-prompt")?.value.length > 20`, 3000, "prompt back");
    }],
    ["a failing prompt shows the failure with Try again", async () => {
      await b.evaluate(`(() => { const t = document.querySelector("textarea#remix-prompt"); const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set; set.call(t, "A storm rolls in [fail]"); t.dispatchEvent(new Event("input", { bubbles: true })); })()`);
      await b.click("button", "Generate");
      await b.until(`[...document.querySelectorAll('${tiles}')].some((li) => li.innerText.includes("Try again"))`, 60000, "failed tile");
      await b.sleep(300);
      await b.shot("10-failed");
      await b.click(`${tiles} button`, "Remove this failed");
      await b.until(`![...document.querySelectorAll('${tiles}')].some((li) => li.innerText.includes("Try again"))`, 10000, "failed tile removed");
    }],
    ["reload keeps the history", async () => {
      await b.reload();
      await b.until(`!!document.querySelector("h1")`);
      await b.click('[role="tab"]', "History");
      await b.until(`document.querySelectorAll('${tiles} video, ${tiles} img').length >= 1`, 15000, "tiles after reload");
      await b.sleep(500);
      await b.shot("11-reload-history");
    }],
    ["delete from the large view", async () => {
      const before = await b.evaluate(`document.querySelectorAll('${tiles}').length`);
      await b.click(`${tiles} button`, "Open");
      await b.until(`!!document.querySelector('[role="dialog"]')`, 5000, "viewer");
      await b.click('[role="dialog"] button', "Delete");
      await b.until(`[...document.querySelectorAll('[role="dialog"] button')].filter((x) => x.innerText.trim() === "Delete").length === 1 && document.querySelector('[role="dialog"]').innerText.includes("for good")`, 3000, "confirm");
      await b.shot("12-confirm-delete");
      await b.evaluate(`[...document.querySelectorAll('[role="dialog"] button')].find((x) => x.innerText.trim() === "Delete").click()`);
      await b.until(`!document.querySelector('[role="dialog"]') && document.querySelectorAll('${tiles}').length < ${before} || !!document.querySelector('[role="tab"][aria-selected="true"]') && document.body.innerText.includes("Nothing remixed yet")`, 10000, "gone");
    }],
    ["with the Prompt switch off, a remix still goes out with a plain direction", async () => {
      // After the reload nothing is written, so the switch is off again.
      await b.until(`!!document.querySelector('${promptSwitch}[aria-checked="false"]')`, 5000, "switch off");
      const before = JSON.parse(await b.evaluate(`fetch("/api/jobs?surface=remix").then((r) => r.text())`)).jobs.length;
      await b.evaluate(upload(0));
      await b.until(`!!document.querySelector('section[aria-label="Remix settings"] img')`, 15000, "the picture in the zone");
      await b.click("button", "Generate");
      await b.until(`fetch("/api/jobs?surface=remix").then((r) => r.json()).then((d) => d.jobs.length > ${before})`, 15000, "a new job");
      const job = JSON.parse(await b.evaluate(`fetch("/api/jobs?surface=remix").then((r) => r.text())`)).jobs[0];
      if (!job.inputs?.start?.length) throw new Error("the job has no source picture");
      if (!(job.prompt?.length >= 20)) throw new Error(`the job has no direction: "${job.prompt}"`);
      await b.until(`document.querySelectorAll('${tiles}').length >= 1`, 15000, "its tile in History");
      return `sent "${job.prompt.slice(0, 40)}"`;
    }],
    ["no sideways scroll at the end", noSideways],
  ]);
} finally {
  await b.close();
}
process.exit(ok ? 0 : 1);
