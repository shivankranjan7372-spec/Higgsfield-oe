// The Video studio from a signed-out first visit to finished, failed and opened videos.
// Run it with: python3 tests/run.py tests/ui/video.mjs
// (the runner starts the app in mock mode and calls: node tests/ui/video.mjs <base-url> <out-dir> [width] [height])
import { launch, scenario } from "./browser.mjs";

const [base, out, W = "1440", H = "900"] = process.argv.slice(2);
const b = await launch({ width: Number(W), height: Number(H), out });
const tiles = `[aria-label="Your videos"] li`;
const examples = `[aria-label="Examples"] li button`;
const noSideways = async () => {
  if (
    await b.evaluate(
      `document.documentElement.scrollWidth > window.innerWidth + 1`,
    )
  )
    throw new Error("page is wider than the window");
};
let ok = false;
try {
  ok = await scenario(b, [
    [
      "open /video signed out: form and examples",
      async () => {
        await b.goto(`${base}/video`);
        await b.until(
          `!!document.querySelector('section[aria-label="Video settings"]') && document.querySelectorAll('${examples}').length >= 6`,
          20000,
          "form and examples",
        );
        await b.until(
          `document.querySelector("button[data-generate]")?.textContent.includes("Sign in")`,
          5000,
          "sign-in Generate",
        );
        await b.sleep(700);
        await b.shot("01-signed-out");
        const zones = await b.evaluate(
          `document.querySelectorAll('button[aria-label*="frame:"]').length`,
        );
        return `drop zones: ${zones}`;
      },
    ],
    ["no sideways scroll", noSideways],
    [
      "Generate signed out asks to sign in",
      async () => {
        await b.click("button[data-generate]");
        await b.until(
          `!!document.querySelector('[role="dialog"]') && document.querySelector('[role="dialog"]').innerText.includes("Create account")`,
          5000,
          "sign-in window",
        );
        await b.sleep(300);
        await b.shot("02-sign-in");
        await b.key("Escape");
        await b.until(
          `!document.querySelector('[role="dialog"]')`,
          3000,
          "window closed",
        );
      },
    ],
    [
      "history tab invites a signed-out visitor in",
      async () => {
        await b.click('[role="radio"]', "History");
        await b.until(
          `document.body.innerText.toLowerCase().includes("sign in to keep your videos")`,
          3000,
          "invite",
        );
        await b.shot("03-history-signed-out");
        await b.click('[role="radio"]', "Examples");
        await b.until(
          `document.querySelectorAll('${examples}').length >= 6`,
          3000,
          "examples back",
        );
      },
    ],
    [
      "a category tab filters the examples",
      async () => {
        const before = await b.evaluate(
          `document.querySelectorAll('${examples}').length`,
        );
        await b.click('[role="tab"]', "Nature");
        await b.until(
          `document.querySelectorAll('${examples}').length < ${before}`,
          3000,
          "fewer examples",
        );
        await b.evaluate(
          `[...document.querySelectorAll('[role="tab"]')].find((t) => t.textContent === "All").scrollIntoView({ inline: "center", block: "center" })`,
        );
        await b.sleep(300);
        await b.click('[role="tab"]', "All");
        await b.until(
          `document.querySelectorAll('${examples}').length === ${before}`,
          3000,
          "all examples",
        );
      },
    ],
    [
      "an example fills the prompt",
      async () => {
        await b.click(examples, "harbour");
        await b.until(
          `document.querySelector('section[aria-label="Video settings"] textarea').value.includes("harbour")`,
          3000,
          "prompt filled",
        );
        await b.shot("04-example-used");
      },
    ],
    [
      "start as a guest",
      async () => {
        await b.evaluate(
          `fetch("/api/auth/guest", { method: "POST" }).then((r) => r.status)`,
        );
        await b.reload();
        await b.until(
          `document.querySelector("button[data-generate]")?.textContent.includes("Generate")`,
          10000,
          "Generate for a guest",
        );
      },
    ],
    [
      "the model list opens and picks a one-frame model",
      async () => {
        await b.click('button[aria-label^="Model:"]');
        await b.until(
          `document.querySelectorAll('[role="option"]').length >= 6`,
          5000,
          "model rows",
        );
        await b.sleep(300);
        await b.shot("05-models");
        await b.click('[role="option"]', "Seedance 1 Lite");
        await b.until(
          `!!document.querySelector('button[aria-label="Model: Seedance 1 Lite"]')`,
          3000,
          "row names the model",
        );
        await b.until(
          `document.querySelectorAll('button[aria-label*="frame:"]').length === 1`,
          3000,
          "one drop zone",
        );
      },
    ],
    [
      "Change on the card opens the same list; Escape closes it",
      async () => {
        await b.click("button", "Change");
        await b.until(
          `document.querySelectorAll('[role="option"]').length >= 6`,
          5000,
          "model rows",
        );
        await b.key("Escape");
        await b.until(
          `document.querySelectorAll('[role="option"]').length === 0`,
          3000,
          "closed",
        );
      },
    ],
    [
      "an option row sets a value",
      async () => {
        await b.click('button[aria-label^="Aspect ratio:"]');
        await b.until(
          `document.querySelectorAll('[role="menuitemradio"]').length >= 2`,
          5000,
          "options",
        );
        await b.sleep(300);
        await b.shot("06-option");
        await b.click('[role="menuitemradio"]', "9:16");
        await b.until(
          `!!document.querySelector('button[aria-label="Aspect ratio: 9:16"]')`,
          3000,
          "value shown",
        );
      },
    ],
    [
      "avatar mode shows the portrait and voice zones",
      async () => {
        await b.click('[role="radio"]', "Talking avatar");
        await b.until(
          `!!document.querySelector('button[aria-label^="Portrait:"]') && !!document.querySelector('button[aria-label^="Voice track:"]')`,
          3000,
          "avatar zones",
        );
        await b.shot("07-avatar");
        await b.click('[role="radio"]', "Text & frames");
        await b.until(
          `!document.querySelector('button[aria-label^="Portrait:"]')`,
          3000,
          "back to clips",
        );
      },
    ],
    [
      "the Edit tab explains what is coming",
      async () => {
        await b.click('[role="tab"]', "Edit Video");
        await b.until(
          `document.body.innerText.includes("Edit footage you already have")`,
          3000,
          "edit panel",
        );
        await b.shot("08-edit");
        await b.click('[role="tab"]', "Create Video");
      },
    ],
    [
      "Generate with no prompt says so and opens the prompt",
      async () => {
        await b.click("button[data-generate]");
        await b.until(
          `!!document.querySelector('section[aria-label="Video settings"] [role="alert"]')`,
          5000,
          "an alert",
        );
        await b.until(
          `!!document.querySelector('section[aria-label="Video settings"] textarea')`,
          3000,
          "prompt box open",
        );
        await b.shot("09a-blocked");
        await b.click('[role="alert"] button', "Dismiss");
      },
    ],
    [
      "generate a video",
      async () => {
        if (
          !(await b.evaluate(
            `!!document.querySelector('section[aria-label="Video settings"] textarea')`,
          ))
        )
          await b.click('button[role="switch"]', "Show");
        await b.until(
          `!!document.querySelector('section[aria-label="Video settings"] textarea')`,
          3000,
          "prompt box",
        );
        await b.evaluate(
          `(() => { const t = document.querySelector('section[aria-label="Video settings"] textarea'); t.focus(); t.select(); })()`,
        );
        await b.type("A paper lantern drifting over a quiet river at night");
        await b.click("button[data-generate]");
        await b.until(
          `document.querySelectorAll('${tiles}').length >= 1`,
          15000,
          "a pending tile",
        );
        await b.sleep(400);
        await b.shot("09-pending");
      },
    ],
    [
      "the video arrives and plays on hover",
      async () => {
        await b.until(
          `document.querySelectorAll('${tiles} video').length >= 1`,
          90000,
          "a finished video",
        );
        await b.sleep(800);
        await b.shot("10-done");
        await b.hover(`${tiles} button`);
        await b.sleep(800);
        const playing = await b.evaluate(
          `!document.querySelector('${tiles} video').paused`,
        );
        await b.shot("11-hover");
        return `playing on hover: ${playing}`;
      },
    ],
    ["no sideways scroll with results", noSideways],
    [
      "open it large, favourite it, use its settings",
      async () => {
        await b.click(`${tiles} button`, "Open");
        await b.until(
          `!!document.querySelector('[role="dialog"] video')`,
          5000,
          "the detail window",
        );
        await b.sleep(500);
        await b.shot("12-detail");
        await b.click('[role="dialog"] button', "Favourite");
        await b.until(
          `document.querySelector('[role="dialog"] button[aria-pressed]')?.getAttribute("aria-pressed") === "true"`,
          5000,
          "favourite on",
        );
        await b.until(
          `fetch("/api/jobs?surface=video&limit=5").then((r) => r.json()).then((d) => d.jobs.some((j) => j.assets.some((a) => a.favorite)))`,
          5000,
          "the server keeps the favourite",
        );
        await b.click('[role="dialog"] button', "Publish");
        await b.until(
          `!!document.querySelector('[role="dialog"] [role="alert"]') || document.querySelector('[role="dialog"]').innerText.includes("View post")`,
          5000,
          "publish answer",
        );
        await b.shot("13-publish-guest");
        await b.click('[role="dialog"] button', "Use these settings");
        await b.until(
          `!document.querySelector('[role="dialog"]')`,
          3000,
          "closed",
        );
        await b.until(
          `document.querySelector('section[aria-label="Video settings"] textarea').value.includes("paper lantern")`,
          3000,
          "prompt back",
        );
      },
    ],
    [
      "a failed video can be tried again",
      async () => {
        await b.evaluate(
          `(() => { const t = document.querySelector('section[aria-label="Video settings"] textarea'); t.focus(); t.select(); })()`,
        );
        await b.type("A storm over the sea [fail]");
        await b.click("button[data-generate]");
        await b.until(
          `!!document.querySelector('${tiles} [data-status="failed"]')`,
          60000,
          "a failed tile",
        );
        await b.sleep(400);
        await b.shot("14-failed");
        await b.until(
          `!!document.querySelector('${tiles} [data-status="failed"] button')`,
          3000,
          "retry button",
        );
      },
    ],
    [
      "delete asks first, then removes the video",
      async () => {
        const before = await b.evaluate(
          `document.querySelectorAll('${tiles} video').length`,
        );
        await b.click(`${tiles} button`, "Open");
        await b.until(
          `!!document.querySelector('[role="dialog"] video')`,
          5000,
          "the detail window",
        );
        await b.click('[role="dialog"] button', "Delete");
        await b.until(
          `!!document.querySelector('[role="alertdialog"]')`,
          3000,
          "confirm",
        );
        await b.shot("15-confirm-delete");
        await b.click('[role="alertdialog"] button', "Delete");
        await b.until(
          `!document.querySelector('[role="dialog"]')`,
          5000,
          "closed",
        );
        await b.until(
          `document.querySelectorAll('${tiles} video').length === ${before - 1}`,
          5000,
          "one fewer",
        );
      },
    ],
  ]);
} finally {
  // The throwaway profile is sometimes still being written as Chrome exits; that is not a test failure.
  await b.close().catch(() => {});
}
process.exit(ok ? 0 : 1);
