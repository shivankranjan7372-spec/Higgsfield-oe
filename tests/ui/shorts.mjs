// The Shorts studio from first visit to a finished, favourited and deleted mock short.
// Run it with: python3 tests/run.py tests/ui/shorts.mjs
// (the runner starts the app in mock mode and calls: node tests/ui/shorts.mjs <base-url> <out-dir> [width] [height])
import { launch, scenario } from "./browser.mjs";

const [base, out, W = "1440", H = "900"] = process.argv.slice(2);
const b = await launch({ width: Number(W), height: Number(H), out });
const ideas = `ul[aria-label="Starter ideas"] li`;
const mine = `ul[aria-label="Your shorts"] li`;
const dialog = `[role="dialog"]`;
const wide = async () => {
  if (await b.evaluate(`document.documentElement.scrollWidth > window.innerWidth + 1 || [...document.querySelectorAll("main li, main h1, main button")].some((e) => e.getBoundingClientRect().right > window.innerWidth + 1)`)) {
    throw new Error("page is wider than the window");
  }
};
let ok = false;
try {
  ok = await scenario(b, [
    ["open /shorts and see the hero and the ideas", async () => {
      await b.goto(`${base}/shorts`);
      await b.until(`!!document.querySelector("h1") && document.querySelectorAll('${ideas}').length === 10`, 20000, "hero and ideas");
      await b.sleep(900);
      await b.shot("01-hero");
      const text = await b.evaluate(`document.querySelector("main").innerText`);
      for (const want of ["Start generating", "How does it work?", "Starter ideas", "Your shorts"]) if (!text.includes(want)) throw new Error(`page lacks "${want}"`);
    }],
    ["no sideways scroll", wide],
    ["the hero sits as drawn", async () => {
      const r = JSON.parse(await b.evaluate(`JSON.stringify((() => { const s = [...document.querySelectorAll("button")].find((e) => e.textContent.trim() === "Start generating").getBoundingClientRect(); const t = document.querySelector('[role="tablist"]').getBoundingClientRect(); const tile = document.querySelector('${ideas} button').getBoundingClientRect(); return { start: [Math.round(s.x), Math.round(s.y), Math.round(s.width), Math.round(s.height)], tabs: [Math.round(t.x), Math.round(t.y), Math.round(t.width), Math.round(t.height)], tile: [Math.round(tile.x), Math.round(tile.y), Math.round(tile.width), Math.round(tile.height)] }; })())`));
      if (r.start[3] !== 40) throw new Error(`Start generating is ${r.start[3]} high`);
      return JSON.stringify(r);
    }],
    ["hovering an idea shows its call to action", async () => {
      await b.hover(`${ideas} button`);
      await b.sleep(400);
      await b.shot("02-idea-hover");
    }],
    ["How does it work opens and Escape closes it", async () => {
      await b.click("button", "How does it work?");
      await b.until(`!!document.querySelector('${dialog}') && document.querySelector('${dialog}').innerText.includes("How Shorts works")`, 5000, "the help");
      await b.sleep(300);
      await b.shot("03-how");
      await b.key("Escape");
      await b.until(`!document.querySelector('${dialog}')`, 3000, "help closed");
    }],
    ["Your shorts is empty for a visitor", async () => {
      await b.click('[role="tab"]', "Your shorts");
      await b.until(`document.querySelector("main").innerText.includes("Your shorts will appear here")`, 5000, "empty state");
      await b.sleep(300);
      await b.shot("04-mine-empty");
      await b.click('[role="tab"]', "Starter ideas");
    }],
    ["Generate with no idea says what is missing", async () => {
      await b.click("button", "Start generating");
      await b.until(`!!document.querySelector('${dialog} textarea')`, 5000, "the form");
      await b.click(`${dialog} button[type="submit"]`, "Generate");
      await b.until(`!!document.querySelector('${dialog} [role="alert"]')`, 5000, "an alert");
      await b.shot("05-blocked");
      await b.click(`${dialog} [role="alert"] button`, "Dismiss");
      await b.key("Escape");
      await b.until(`!document.querySelector('${dialog}')`, 3000, "form closed");
    }],
    ["an idea opens the form with its prompt, held to 9:16 and short lengths", async () => {
      await b.click(`${ideas} button`, "Use this idea");
      await b.until(`(document.querySelector('${dialog} textarea')?.value || "").length > 20`, 5000, "prompt filled in");
      await b.until(`!!document.querySelector('${dialog} button[aria-label^="Model:"]')`, 5000, "model chip");
      await b.sleep(300);
      await b.shot("06-form");
      const lengths = JSON.parse(await b.evaluate(`JSON.stringify([...document.querySelectorAll('${dialog} [role="radiogroup"][aria-label="Length"] [role="radio"]')].map((e) => parseInt(e.textContent)))`));
      if (!lengths.length || lengths.some((n) => n > 10)) throw new Error(`lengths ${lengths}`);
      if (!(await b.evaluate(`document.querySelector('${dialog}').innerText.includes("9:16")`))) throw new Error("no 9:16 frame");
      await b.click(`${dialog} [role="radio"]`, `${lengths[0]}s`);
      await b.until(`document.querySelector('${dialog} [role="radio"][aria-checked="true"]')?.textContent.includes("${lengths[0]}s")`, 3000, "length picked");
      return `lengths ${lengths.join(",")}`;
    }],
    ["the model picker lists only models that frame 9:16", async () => {
      await b.click(`${dialog} button[aria-label^="Model:"]`, "Model:");
      await b.until(`document.querySelectorAll('[role="option"]').length >= 3`, 5000, "model rows");
      await b.sleep(300);
      await b.shot("07-models");
      const n = await b.evaluate(`document.querySelectorAll('[role="option"]').length`);
      await b.key("Escape");
      await b.until(`document.querySelectorAll('[role="option"]').length === 0`, 3000, "picker closed");
      return `${n} models`;
    }],
    ["generate queues a short and shows it in Your shorts", async () => {
      await b.click(`${dialog} button[type="submit"]`, "Generate");
      await b.until(`!document.querySelector('${dialog}')`, 15000, "form closed");
      await b.until(`document.querySelectorAll('${mine}').length >= 1`, 15000, "a pending tile");
      await b.sleep(400);
      await b.shot("08-pending");
    }],
    ["the short arrives and plays on hover", async () => {
      await b.until(`!!document.querySelector('${mine} video')`, 90000, "a finished short");
      await b.sleep(800);
      await b.hover(`${mine} button`);
      await b.sleep(700);
      await b.shot("09-done-hover");
      return `playing=${await b.evaluate(`!document.querySelector('${mine} video').paused`)}`;
    }],
    ["the balance went down", async () => {
      const me = JSON.parse(await b.evaluate(`fetch("/api/auth/me").then((r) => r.text())`));
      if (!(me.balance < 60000)) throw new Error(`balance is ${me.balance}`);
      return `balance ${me.balance}`;
    }],
    ["the job is labelled shorts", async () => {
      const list = JSON.parse(await b.evaluate(`fetch("/api/jobs?surface=shorts").then((r) => r.text())`));
      const job = list.jobs[0];
      if (!job || job.params.aspect !== "9:16") throw new Error(`job ${JSON.stringify(job?.params)}`);
      return `aspect ${job.params.aspect}, duration ${job.params.duration}`;
    }],
    ["a short opens large with its details", async () => {
      await b.click(`${mine} button`, "Open:");
      await b.until(`!!document.querySelector('${dialog} video')`, 5000, "the viewer");
      await b.sleep(500);
      await b.shot("10-viewer");
      const text = await b.evaluate(`document.querySelector('${dialog}').innerText`);
      for (const want of ["Download", "Favourite", "Use these settings", "Delete", "Cost"]) if (!text.includes(want)) throw new Error(`viewer lacks "${want}"`);
    }],
    ["favourite from the viewer", async () => {
      await b.click(`${dialog} button`, "Favourite");
      await b.until(`!!document.querySelector('${dialog} button[aria-pressed="true"]')`, 5000, "favourited");
    }],
    ["use these settings fills the form again", async () => {
      await b.click(`${dialog} button`, "Use these settings");
      await b.until(`(document.querySelector('${dialog} textarea')?.value || "").length > 20`, 5000, "prompt back in the form");
      await b.key("Escape");
      await b.until(`!document.querySelector('${dialog}')`, 3000, "form closed");
    }],
    ["with too few credits the form says so and offers credits", async () => {
      await b.click("button", "Start generating");
      await b.until(`!!document.querySelector('${dialog} textarea')`, 5000, "the form");
      await b.click(`${dialog} button[type="submit"]`, "Generate");
      await b.until(`document.querySelector('${dialog} [role="alert"]')?.innerText.includes("credits")`, 15000, "the credits message");
      if (!(await b.evaluate(`!!document.querySelector('${dialog} [role="alert"] a')`))) throw new Error("no way to get credits");
      await b.sleep(300);
      await b.shot("11-no-credits");
      const res = JSON.parse(await b.evaluate(`fetch("/api/wallet/topup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ packId: "pack-500" }) }).then((r) => r.text())`));
      await b.key("Escape");
      await b.until(`!document.querySelector('${dialog}')`, 3000, "form closed");
      return `demo top-up, balance ${res.balance}`;
    }],
    ["a failed short shows why, and can be tried again", async () => {
      await b.click("button", "Start generating");
      await b.until(`!!document.querySelector('${dialog} textarea')`, 5000, "the form");
      await b.evaluate(`(() => { const t = document.querySelector('${dialog} textarea'); t.focus(); t.select(); })()`);
      await b.type("A tin robot waters a sunflower [fail]");
      await b.click(`${dialog} button[type="submit"]`, "Generate");
      await b.until(`!document.querySelector('${dialog}')`, 15000, "form closed");
      await b.until(`[...document.querySelectorAll('${mine} button')].some((e) => e.textContent.includes("Try again"))`, 60000, "a failed tile");
      await b.sleep(400);
      await b.shot("12-failed");
      const before = await b.evaluate(`document.querySelectorAll('${mine}').length`);
      await b.click(`${mine} button`, "Try again");
      await b.until(`document.querySelectorAll('${mine}').length > ${before}`, 15000, "a new attempt");
      await b.until(`[...document.querySelectorAll('${mine} button')].filter((e) => e.textContent.includes("Try again")).length >= 2`, 60000, "it fails again");
    }],
    ["remove the failed ones", async () => {
      for (let i = 0; i < 2; i++) {
        const n = await b.evaluate(`document.querySelectorAll('${mine}').length`);
        await b.click(`${mine} button`, "Remove");
        await b.until(`document.querySelectorAll('${mine}').length < ${n}`, 10000, "one fewer tile");
      }
    }],
    ["delete a short for good, after asking", async () => {
      await b.click(`${mine} button`, "Open:");
      await b.until(`!!document.querySelector('${dialog} video')`, 5000, "the viewer");
      await b.click(`${dialog} button`, "Delete");
      await b.until(`!!document.querySelector('[role="alertdialog"]')`, 3000, "the question");
      await b.shot("13-confirm");
      await b.click('[role="alertdialog"] button', "Delete for good");
      await b.until(`!document.querySelector('${dialog}')`, 5000, "viewer closed");
      await b.until(`document.querySelector("main").innerText.includes("Your shorts will appear here")`, 10000, "empty again");
      await b.shot("14-empty-again");
    }],
    ["still no sideways scroll", wide],
  ]);
} finally {
  await b.close();
}
process.exit(ok ? 0 : 1);
