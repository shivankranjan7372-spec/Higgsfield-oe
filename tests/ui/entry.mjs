// The entry screens: the sign-in window, search, notifications and "What's new".
// Run it with: python3 tests/run.py tests/ui/entry.mjs
// (the runner starts the app in mock mode and calls: node tests/ui/entry.mjs <base-url> <out-dir> [width] [height])
import { launch, scenario } from "./browser.mjs";

const [base, out, W = "1440", H = "900"] = process.argv.slice(2);
const b = await launch({ width: Number(W), height: Number(H), out });
const phone = Number(W) < 600;
const email = `entry-${Date.now()}@example.com`;
const password = "a-long-password-1";
const dialog = `[role="dialog"]`;
const noSideways = async (where) => {
  if (await b.evaluate(`document.documentElement.scrollWidth > window.innerWidth + 1`)) throw new Error(`${where} is wider than the window`);
};
const fill = async (selector, text) => {
  await b.evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`);
  await b.evaluate(`document.querySelector(${JSON.stringify(selector)}).select?.()`);
  await b.type(text);
};
/** Clicks until the window opens: the first click may land before the page is live. */
const openBy = async (selector, text, ready) => {
  for (let i = 0; i < 6; i++) {
    await b.click(selector, text);
    try {
      await b.until(ready, 2500, "the window");
      return;
    } catch {}
  }
  throw new Error(`${text} did not open its window`);
};
const json = async (path, init) => JSON.parse(await b.evaluate(`fetch(${JSON.stringify(path)}, ${JSON.stringify(init ?? {})}).then((r) => r.text())`));

let ok = false;
try {
  ok = await scenario(b, [
    ["open the home page signed out", async () => {
      await b.goto(`${base}/`);
      await b.until(`!!document.querySelector("nav") || !!document.querySelector("header")`);
      await b.sleep(800);
    }],
    ["Get started opens the sign-in window on the join side", async () => {
      await openBy("button", phone ? "Login" : "Get started", `!!document.querySelector('${dialog} input[type="email"]')`);
      await b.sleep(500);
      await b.shot("01-login-window");
      await noSideways("the sign-in window");
    }],
    ["the switch flips between log in and create account", async () => {
      const before = await b.evaluate(`document.querySelector('${dialog} button[type="submit"]').textContent`);
      await b.click(`${dialog} button`, phone ? "Create an account" : "Log in instead");
      await b.until(`document.querySelector('${dialog} button[type="submit"]').textContent !== ${JSON.stringify(before)}`, 3000, "the other side");
      const after = await b.evaluate(`document.querySelector('${dialog} button[type="submit"]').textContent`);
      await b.shot("02-login-other-side");
      return `${before.trim()} -> ${after.trim()}`;
    }],
    ["a wrong password shows the server's message in place", async () => {
      if (!(await b.evaluate(`document.querySelector('${dialog} button[type="submit"]').textContent.includes("Log in")`))) await b.click(`${dialog} button`, "Log in instead");
      await fill(`${dialog} input[type="email"]`, "nobody@example.com");
      await fill(`${dialog} input[name="password"]`, "wrong-password");
      await b.click(`${dialog} button[type="submit"]`);
      await b.until(`!!document.querySelector('${dialog} [role="alert"]')`, 8000, "an error in the window");
      await b.sleep(200);
      await b.shot("03-login-error");
      return await b.evaluate(`document.querySelector('${dialog} [role="alert"]').textContent`);
    }],
    ["Escape closes the sign-in window", async () => {
      await b.key("Escape");
      await b.until(`!document.querySelector('${dialog}')`, 3000, "window closed");
    }],
    ["a guest sees that creating an account keeps their work", async () => {
      await json("/api/auth/guest", { method: "POST" });
      await b.reload();
      await b.sleep(800);
      await openBy("button", phone ? "Login" : "Get started", `!!document.querySelector('${dialog} [data-guest-note]')`);
      if (phone) await b.click(`${dialog} button`, "Create an account");
      await b.until(`document.querySelector('${dialog} [data-guest-note]').textContent.includes("keeps")`, 3000, "keeps your work");
      await b.shot("04-guest-join");
    }],
    ["creating an account upgrades the guest and closes the window", async () => {
      const guestId = (await json("/api/auth/me")).user.id;
      await fill(`${dialog} input[type="email"]`, email);
      await fill(`${dialog} input[name="password"]`, password);
      await b.click(`${dialog} button[type="submit"]`);
      await b.until(`!document.querySelector('${dialog}')`, 10000, "window closed");
      const me = await json("/api/auth/me");
      if (me.user?.isGuest !== false) throw new Error("still a guest");
      if (me.user.id !== guestId) throw new Error("a new account was made instead of upgrading the guest");
      return `member ${me.user.handle}`;
    }],
    ["the search button opens the search window with suggestions", async () => {
      await b.goto(`${base}/`);
      await b.sleep(800);
      await openBy('button[aria-label="Search"]', null, `!!document.querySelector('${dialog} input[role="combobox"]')`);
      await b.until(`document.querySelectorAll('${dialog} [role="option"]').length >= 3`, 8000, "suggestion rows");
      await b.sleep(400);
      await b.shot("05-search-empty");
      await noSideways("the search window");
      return `${await b.evaluate(`document.querySelectorAll('${dialog} [role="option"]').length`)} rows`;
    }],
    ["typing shows grouped results; arrows move; Escape closes", async () => {
      await b.type("flux");
      await b.until(`[...document.querySelectorAll('${dialog} [role="group"]')].some((g) => g.getAttribute("aria-label") === "Models")`, 8000, "a Models group");
      await b.sleep(300);
      await b.shot("06-search-results");
      await b.key("ArrowDown");
      const sel = await b.evaluate(`document.querySelector('${dialog} input').getAttribute("aria-activedescendant")`);
      if (!sel || !(await b.evaluate(`document.getElementById(${JSON.stringify(sel)})?.getAttribute("aria-selected") === "true"`))) throw new Error("arrow did not move the selection");
      await b.key("Escape");
      await b.until(`!document.querySelector('${dialog}')`, 3000, "window closed");
    }],
    ["Enter opens a result and saves the search", async () => {
      await openBy('button[aria-label="Search"]', null, `!!document.querySelector('${dialog} input[role="combobox"]')`);
      await b.type("flux");
      await b.until(`[...document.querySelectorAll('${dialog} [role="group"]')].some((g) => g.getAttribute("aria-label") === "Models")`, 8000, "results");
      await b.key("Enter");
      await b.until(`!document.querySelector('${dialog}') && location.pathname !== "/"`, 8000, "navigated");
      const recent = await json("/api/search/recent");
      if (!recent.searches.some((r) => r.query === "flux")) throw new Error("the search was not saved");
      return `went to ${await b.evaluate("location.pathname + location.search")}`;
    }],
    ["recent searches show in the empty window", async () => {
      await b.goto(`${base}/`);
      await b.sleep(800);
      await openBy('button[aria-label="Search"]', null, `!!document.querySelector('${dialog} [role="group"][aria-label="Recent searches"]')`);
      await b.sleep(300);
      await b.shot("07-search-recents");
      await b.key("Escape");
    }],
    ["/search shows the full results page", async () => {
      await b.goto(`${base}/search?q=video`);
      await b.until(`!!document.querySelector("h1") && document.querySelectorAll("main section a").length > 0`, 15000, "result rows");
      await b.sleep(400);
      await b.shot("08-search-page");
      await noSideways("/search");
      await b.click('[role="tab"]', "Models");
      await b.until(`location.search.includes("type=models")`, 3000, "the tab in the address");
    }],
    ["/search with nothing found says so", async () => {
      await b.goto(`${base}/search?q=zzqqxxnothing`);
      await b.until(`document.body.innerText.includes("Nothing matches")`, 15000, "the empty state");
    }],
    ["a finished generation makes a notice", async () => {
      await json("/api/jobs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ modelId: "flux-schnell", prompt: "a paper lantern over a river" }) });
      for (let i = 0; i < 40; i++) {
        const n = await json("/api/notifications");
        if (n.notices?.length) return `${n.notices.length} notice(s)`;
        await b.sleep(1000);
      }
      throw new Error("no notice arrived");
    }],
    ["/notifications lists it, marks read and deletes", async () => {
      await b.goto(`${base}/notifications`);
      await b.until(`document.querySelectorAll("[data-notice]").length > 0`, 15000, "notices");
      await b.until(`document.body.innerText.includes("Live")`, 8000, "the live stream");
      await b.sleep(400);
      await b.shot("09-notifications");
      await noSideways("/notifications");
      await b.click("button", "Mark all read");
      await b.until(`[...document.querySelectorAll("[data-notice]")].every((e) => e.dataset.read === "true")`, 5000, "all read");
      await b.click('[data-notice] button[aria-label="Mark unread"]');
      await b.until(`document.querySelector("[data-notice]").dataset.read === "false"`, 5000, "unread again");
      const before = await b.evaluate(`document.querySelectorAll("[data-notice]").length`);
      await b.click('[data-notice] button[aria-label="Delete"]');
      await b.until(`document.querySelectorAll("[data-notice]").length === ${before - 1}`, 5000, "one fewer");
      await b.shot("10-notifications-after");
    }],
    ["notification preferences switch on and off", async () => {
      await b.click('button[role="switch"]', "liked your post");
      await b.until(`fetch("/api/notifications/preferences").then((r) => r.json()).then((d) => d.preferences.find((p) => p.kind === "like").enabled === false)`, 5000, "like muted");
      await b.click('button[role="switch"]', "liked your post");
    }],
    ["/whats-new lists release notes and marks them seen", async () => {
      await b.goto(`${base}/whats-new`);
      await b.until(`document.querySelectorAll("[data-news]").length > 0`, 15000, "release notes");
      await b.sleep(300);
      await b.shot("11-whats-new");
      await noSideways("/whats-new");
      if (await b.evaluate(`!!document.querySelector('[data-news][data-seen="false"]')`)) {
        await b.click("button", "Mark all seen");
        await b.until(`!!document.querySelector("[data-all-seen]")`, 5000, "all seen");
      }
    }],
    ["/join honours ?next= after signing up", async () => {
      await json("/api/auth/logout", { method: "POST" });
      await b.goto(`${base}/join?next=${encodeURIComponent("/whats-new")}`);
      await b.until(`!!document.querySelector('main input[type="email"]')`, 15000, "the form");
      await b.sleep(400);
      await b.shot("12-join-page");
      await noSideways("/join");
      await fill(`main input[type="email"]`, `next-${email}`);
      await fill(`main input[name="password"]`, password);
      await b.click(`main button[type="submit"]`);
      await b.until(`location.pathname === "/whats-new"`, 10000, "went to next");
    }],
    ["/login ignores an outside next address", async () => {
      await json("/api/auth/logout", { method: "POST" });
      await b.goto(`${base}/login?next=${encodeURIComponent("//example.com/x")}`);
      await b.until(`!!document.querySelector('main input[type="email"]')`, 15000, "the form");
      await fill(`main input[type="email"]`, email);
      await fill(`main input[name="password"]`, password);
      await b.click(`main button[type="submit"]`);
      await b.until(`location.pathname === "/" && location.host === ${JSON.stringify(new URL(base).host)}`, 10000, "stayed on this site");
    }],
    ["signed out, /notifications asks to sign in", async () => {
      await json("/api/auth/logout", { method: "POST" });
      await b.goto(`${base}/notifications`);
      await b.until(`document.body.innerText.includes("Sign in to see your notifications")`, 15000, "the invitation");
      await b.sleep(300);
      await b.shot("13-notifications-signed-out");
    }],
  ]);
} finally {
  await b.close();
}
process.exit(ok ? 0 : 1);
