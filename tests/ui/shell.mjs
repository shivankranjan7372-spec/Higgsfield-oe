// The frame around every page: the full nav with its big menus, the footer, the compact nav,
// the account menu, the bell and the small-screen panel. Visitor first, then a member.
// Run it with: python3 tests/run.py tests/ui/shell.mjs   (and UI_SIZE="390 844" for phone size)
import { launch, scenario } from "./browser.mjs";

const [base, out, W = "1440", H = "900"] = process.argv.slice(2);
const width = Number(W);
const wide = width >= 900;
const b = await launch({ width, height: Number(H), out });

const visible = (sel) => `[...document.querySelectorAll(${JSON.stringify(sel)})].some((e) => e.getClientRects().length > 0)`;
const noSideways = async () => {
  if (await b.evaluate(`document.documentElement.scrollWidth > window.innerWidth + 1`)) throw new Error("page is wider than the window");
};
const menuRows = (word) => `document.querySelectorAll('[role="region"][aria-label="${word} menu"] a').length`;
const modelRows = (word) => `document.querySelectorAll('[role="region"][aria-label="${word} menu"] a[href*="?model="]').length`;
const email = `shell-${Date.now()}@example.com`;

let ok = false;
try {
  ok = await scenario(b, [
    ["open / and see the full nav and the footer", async () => {
      await b.goto(`${base}/`);
      await b.until(`!!document.querySelector("header") && !!document.querySelector("footer")`);
      const h = await b.evaluate(`Math.round(document.querySelector("header").getBoundingClientRect().height)`);
      if (h !== 52) throw new Error(`full nav is ${h}px tall, not 52`);
      const f = await b.evaluate(`Math.round(document.querySelector("footer").getBoundingClientRect().height)`);
      if (wide && f !== 68) throw new Error(`footer is ${f}px tall, not 68`);
      await b.until(visible("header button") , 5000, "header buttons");
      await b.shot("01-home");
      return `nav ${h}px, footer ${f}px`;
    }],
    ["no sideways scroll", noSideways],
    ...(wide
      ? [
          ["hover Image opens its menu with the registry's image models", async () => {
            await b.hover('header nav button[aria-expanded]', "Image");
            await b.until(`${modelRows("Image")} >= 3`, 4000, "image model rows");
            await b.sleep(400);
            await b.shot("02-menu-image");
            const href = await b.evaluate(`document.querySelector('[aria-label="Image menu"] a[href*="?model="]').getAttribute("href")`);
            if (!href.startsWith("/image?model=")) throw new Error(`model row links to ${href}`);
            return `${await b.evaluate(menuRows("Image"))} rows, first model ${href}`;
          }],
          ["click Video swaps to the Video menu", async () => {
            await b.click('header nav button[aria-expanded]', "Video");
            await b.until(`${modelRows("Video")} >= 5`, 4000, "video model rows");
            await b.until(`!document.querySelector('[aria-label="Image menu"]')`, 3000, "image menu gone");
            await b.hover("main");
            await b.sleep(500);
            if (!(await b.evaluate(`!!document.querySelector('[aria-label="Video menu"]')`))) {
              // Opened by a press, it may close when the pointer leaves; that is fine, reopen for the picture.
              await b.click('header nav button[aria-expanded]', "Video");
            }
            await b.until(`${modelRows("Video")} >= 5`, 4000, "video model rows");
            await b.sleep(300);
            await b.shot("03-menu-video");
          }],
          ["Escape closes the menu and gives focus back", async () => {
            await b.key("Escape");
            await b.until(`!document.querySelector('[role="region"][aria-label$=" menu"]')`, 3000, "menu closed");
            await b.until(`document.activeElement?.textContent?.trim() === "Video"`, 3000, "focus on Video");
          }],
          ["keyboard: ArrowDown on Audio opens it and focuses the first row", async () => {
            await b.evaluate(`[...document.querySelectorAll('header nav button')].find((e) => e.textContent.trim() === "Audio").focus()`);
            await b.key("ArrowDown");
            await b.until(`${modelRows("Audio")} >= 2`, 4000, "audio model rows");
            await b.until(`!!document.activeElement?.closest('[aria-label="Audio menu"]')`, 3000, "focus inside the menu");
            await b.key("ArrowDown");
            await b.sleep(300);
            await b.shot("04-menu-audio");
            await b.key("Escape");
            await b.until(`!document.querySelector('[aria-label="Audio menu"]')`, 3000, "menu closed");
          }],
          ["a model row opens its studio with the model chosen", async () => {
            await b.click('header nav button[aria-expanded]', "Image");
            await b.until(`${modelRows("Image")} >= 1`, 4000, "rows");
            await b.click('[aria-label="Image menu"] a[href*="?model="]');
            await b.until(`location.pathname === "/image" && location.search.includes("model=")`, 15000, "the image studio");
            await b.goto(`${base}/`);
          }],
        ]
      : [
          ["the menu button opens the small-screen panel with every link", async () => {
            await b.click('button[aria-label="Open menu"]');
            await b.until(`!!document.querySelector('[role="dialog"] nav')`, 4000, "panel");
            const n = await b.evaluate(`document.querySelectorAll('[role="dialog"] nav a').length`);
            if (n < 12) throw new Error(`only ${n} links in the panel`);
            await b.sleep(300);
            await b.shot("02-panel-visitor");
            await b.key("Escape");
            await b.until(`!document.querySelector('[role="dialog"]')`, 3000, "panel closed");
            return `${n} links`;
          }],
        ]),
    ["Login opens the sign-in window", async () => {
      await b.click("header button", "Login");
      await b.until(`!!document.querySelector('[role="dialog"]')`, 4000, "dialog");
      await b.sleep(300);
      await b.shot("05-login");
      await b.key("Escape");
      await b.until(`!document.querySelector('[role="dialog"]')`, 3000, "dialog closed");
    }],
    ["the search button opens the search window", async () => {
      await b.click('header button[aria-label="Search"]');
      await b.until(`!!document.querySelector('[role="dialog"]')`, 4000, "dialog");
      await b.key("Escape");
      await b.until(`!document.querySelector('[role="dialog"]')`, 3000, "dialog closed");
    }],
    ["the footer, at the bottom", async () => {
      await b.evaluate(`window.scrollTo(0, document.body.scrollHeight)`);
      await b.sleep(300);
      await b.shot("06-footer");
      await b.evaluate(`window.scrollTo(0, 0)`);
      const n = await b.evaluate(`document.querySelectorAll('footer a').length`);
      if (n < 4) throw new Error(`footer has ${n} links`);
    }],
    ["sign up through the API", async () => {
      const r = await b.evaluate(`fetch("/api/auth/signup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: ${JSON.stringify(email)}, password: "shell-pass-12345", name: "Shell Tester" }) }).then((r) => r.status)`);
      if (r !== 200 && r !== 201) throw new Error(`signup answered ${r}`);
      await b.reload();
      await b.until(`!!document.querySelector('button[aria-label="Your account"]')`, 8000, "avatar");
      await b.shot("07-member-nav");
    }],
    ["the bell shows the real unread count", async () => {
      const api = JSON.parse(await b.evaluate(`fetch("/api/notifications/unread").then((r) => r.text())`)).unread;
      await b.until(`!!document.querySelector('a[aria-label^="Notifications"]')`, 5000, "bell");
      await b.until(`Number(document.querySelector('a[aria-label^="Notifications"]').dataset.unread) === ${api}`, 8000, `bell shows ${api}`);
      return `unread ${api}`;
    }],
    ["a finished generation lights the bell live, without a reload", async () => {
      const r = await b.evaluate(`fetch("/api/jobs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ modelId: "flux-schnell", prompt: "a lighthouse on a cliff at dusk" }) }).then((r) => r.status)`);
      if (r >= 300) throw new Error(`job answered ${r}`);
      await b.until(`Number(document.querySelector('a[aria-label^="Notifications"]').dataset.unread) >= 1`, 45000, "an unread notice on the bell");
      const api = JSON.parse(await b.evaluate(`fetch("/api/notifications/unread").then((r) => r.text())`)).unread;
      const shown = await b.evaluate(`Number(document.querySelector('a[aria-label^="Notifications"]').dataset.unread)`);
      if (shown !== api) throw new Error(`bell shows ${shown}, API says ${api}`);
      await b.sleep(300);
      await b.shot("07b-bell-unread");
      return `unread ${shown}`;
    }],
    ["the avatar opens the account menu with the real balance", async () => {
      const me = JSON.parse(await b.evaluate(`fetch("/api/auth/me").then((r) => r.text())`));
      await b.click('button[aria-label="Your account"]');
      await b.until(`!!document.querySelector('[data-balance]')`, 4000, "account menu");
      const shown = await b.evaluate(`Number(document.querySelector('[data-balance]').dataset.balance)`);
      if (shown !== me.balance) throw new Error(`menu shows ${shown}, API says ${me.balance}`);
      for (const want of ["/wallet", "/pricing", "/settings", "/library", "/invite", "/whats-new"]) {
        if (!(await b.evaluate(`!!document.querySelector('[role="dialog"] a[href="${want}"]')`))) throw new Error(`no link to ${want}`);
      }
      await b.sleep(300);
      await b.shot("08-account-menu");
      await b.key("Escape");
      await b.until(`!document.querySelector('[data-balance]')`, 3000, "menu closed");
      return `balance ${shown}`;
    }],
    ["/image: the compact nav with the bell and the account menu", async () => {
      await b.goto(`${base}/image`);
      await b.until(`!!document.querySelector('button[aria-label="Your account"]') && !!document.querySelector('a[aria-label^="Notifications"]')`, 8000, "member cluster");
      const h = await b.evaluate(`Math.round(document.querySelector("header").getBoundingClientRect().height)`);
      await b.click('button[aria-label="Your account"]');
      await b.until(`!!document.querySelector('[data-balance]')`, 4000, "account menu");
      await b.sleep(300);
      await b.shot("09-compact-account");
      await b.key("Escape");
      return `compact nav ${h}px`;
    }],
    ["no sideways scroll on /image", noSideways],
    ...(wide
      ? []
      : [
          ["the member panel shows the account rows", async () => {
            await b.click('button[aria-label="Open menu"]');
            await b.until(`!!document.querySelector('[role="dialog"] [data-balance]')`, 4000, "account rows in the panel");
            await b.sleep(300);
            await b.shot("10-panel-member");
            await b.key("Escape");
            await b.until(`!document.querySelector('[role="dialog"]')`, 3000, "panel closed");
          }],
        ]),
    ["log out from the account menu", async () => {
      await b.click('button[aria-label="Your account"]');
      await b.until(`!!document.querySelector('[data-balance]')`, 4000, "account menu");
      await b.click('[role="dialog"] button', "Log out");
      await b.until(`!document.querySelector('button[aria-label="Your account"]')`, 8000, "avatar gone");
      await b.until(visible("header button") + ` && [...document.querySelectorAll("header button")].some((e) => e.textContent.includes("Login"))`, 5000, "Login is back");
      await b.shot("11-logged-out");
    }],
  ]);
} finally {
  await b.close();
}
process.exit(ok ? 0 : 1);
