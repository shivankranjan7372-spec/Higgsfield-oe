// The member's own pages: settings, notification settings, wallet and invites.
// Run it with: python3 tests/run.py tests/ui/account.mjs
// (the runner starts the app in mock mode and calls: node tests/ui/account.mjs <base-url> <out-dir> [width] [height])
import { launch, scenario } from "./browser.mjs";

const [base, out, W = "1440", H = "900"] = process.argv.slice(2);
const b = await launch({ width: Number(W), height: Number(H), out });
const stamp = Date.now().toString(36);
const email = `ada-${stamp}@example.com`;
const password = "a-long-password-1";
const handle = `ada-${stamp}`.slice(0, 20);

/** Focus a field, select what is in it, and type over it. */
async function fill(selector, text) {
  await b.evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); e.scrollIntoView({ block: "center" }); e.focus(); e.select?.(); })()`);
  await b.type(text);
}
const text = () => b.evaluate(`document.body.innerText`);
const has = (t) => `document.body.innerText.includes(${JSON.stringify(t)})`;
async function noSideways() {
  if (await b.evaluate(`document.documentElement.scrollWidth > window.innerWidth + 1`)) throw new Error("page is wider than the window");
}
async function post(path, body, credentials = "same-origin") {
  return JSON.parse(
    await b.evaluate(
      `fetch(${JSON.stringify(path)}, { method: "POST", credentials: ${JSON.stringify(credentials)}, headers: { "content-type": "application/json" }, body: ${JSON.stringify(JSON.stringify(body ?? {}))} }).then(async (r) => JSON.stringify({ status: r.status, body: await r.json().catch(() => null) }))`,
    ),
  );
}

let ok = false;
try {
  ok = await scenario(b, [
    ["signed out: settings explains itself and asks to sign in", async () => {
      await b.goto(`${base}/settings`);
      await b.until(has("Your settings live here"), 10000, "sign-in card");
      await b.sleep(300);
      await b.shot("01-settings-signed-out");
      const t = await text();
      if (!t.includes("Create account") || !t.includes("Log in")) throw new Error("no way in");
      await noSideways();
    }],
    ["signed out: wallet, invite and notifications explain themselves", async () => {
      for (const [path, want] of [["/wallet", "Your credits, in one place"], ["/invite", "Bring a friend"], ["/settings/notifications", "Choose what you hear about"]]) {
        await b.goto(`${base}${path}`);
        await b.until(has(want), 10000, want);
        await noSideways();
      }
      await b.shot("02-wallet-signed-out");
    }],
    ["Log in opens the shared sign-in window", async () => {
      await b.click("button", "Log in");
      await b.until(`!!document.querySelector('[role="dialog"]')`, 5000, "dialog");
      await b.sleep(300);
      await b.shot("03-login-dialog");
      await b.key("Escape");
      await b.until(`!document.querySelector('[role="dialog"]')`, 3000, "closed");
    }],
    ["a guest sees settings with a create-account banner", async () => {
      const r = await post("/api/auth/guest");
      if (r.status !== 200) throw new Error(`guest: ${r.status}`);
      await b.goto(`${base}/settings`);
      await b.until(has("You are using a guest account"), 10000, "guest banner");
      await b.until(has("Guests have no email or password"), 5000, "guest sign-in card");
      await b.sleep(300);
      await b.shot("04-settings-guest");
      await post("/api/auth/logout");
    }],
    ["sign up and open settings", async () => {
      const r = await post("/api/auth/signup", { email, password, name: "Ada Maker" });
      if (r.status !== 200) throw new Error(`signup: ${r.status} ${JSON.stringify(r.body)}`);
      await b.goto(`${base}/settings`);
      await b.until(`!!document.querySelector('input[autocomplete="name"]')`, 10000, "profile form");
      await b.sleep(500);
      await b.shot("05-settings");
      const t = await text();
      for (const want of ["Profile", "Sign-in", "Devices", "Preferences", "Delete account"]) if (!t.includes(want)) throw new Error(`settings lacks "${want}"`);
      if ((await b.evaluate(`document.querySelector('input[autocomplete="name"]').value`)) !== "Ada Maker") throw new Error("name not filled in");
      await noSideways();
    }],
    ["the side list moves between sections", async () => {
      const links = await b.evaluate(`[...document.querySelectorAll('nav[aria-label="Account"] a')].filter((a) => a.getClientRects().length).map((a) => a.getAttribute("href")).join(" ")`);
      for (const want of ["/settings#profile", "/settings/notifications", "/wallet", "/invite"]) if (!links.includes(want)) throw new Error(`side list lacks ${want}: ${links}`);
      return links;
    }],
    ["the handle check answers while typing", async () => {
      await fill('input[autocomplete="username"]', "admin");
      await b.until(`[...document.querySelectorAll("[aria-live]")].some((e) => /taken|reserved|not/i.test(e.textContent))`, 6000, "taken message");
      await fill('input[autocomplete="username"]', handle);
      await b.until(has("That handle is free."), 6000, "free message");
      await b.shot("06-handle-free");
    }],
    ["save the profile", async () => {
      await fill('input[autocomplete="name"]', "Ada Lovelace");
      await fill("textarea", "I make short films about machines.");
      await b.click('section#profile button[type="submit"]');
      await b.until(`document.querySelector("section#profile")?.innerText.includes("Saved.")`, 6000, "saved line");
      await b.shot("07-profile-saved");
      const me = JSON.parse(await b.evaluate(`fetch("/api/auth/me").then((r) => r.text())`));
      if (me.user.name !== "Ada Lovelace" || me.user.handle !== handle) throw new Error(`profile is ${me.user.name} @${me.user.handle}`);
    }],
    ["a wrong password is refused with the server's words", async () => {
      await fill('input[type="email"]', `new-${email}`);
      await fill('form[aria-label="Change email"] input[type="password"]', "not-my-password");
      await b.click('form[aria-label="Change email"] button[type="submit"]');
      await b.until(`!!document.querySelector('form[aria-label="Change email"] [role="alert"]')`, 6000, "error line");
      await b.shot("08-email-error");
    }],
    ["change the password", async () => {
      await fill('form[aria-label="Change password"] input[autocomplete="current-password"]', password);
      await fill('form[aria-label="Change password"] input[autocomplete="new-password"]', `${password}-2`);
      await b.click('form[aria-label="Change password"] button[type="submit"]');
      await b.until(`document.querySelector('form[aria-label="Change password"]').innerText.includes("Password changed")`, 6000, "changed line");
    }],
    ["sign out another device", async () => {
      const r = await post("/api/auth/login", { email, password: `${password}-2` }, "omit");
      if (r.status !== 200) throw new Error(`second login: ${r.status}`);
      await b.reload();
      await b.until(`!!document.querySelector('section#sessions button[aria-label^="Sign out:"]')`, 8000, "other session row");
      await b.evaluate(`document.querySelector("section#sessions").scrollIntoView()`);
      await b.sleep(200);
      await b.shot("09-sessions");
      await b.click('section#sessions button[aria-label^="Sign out:"]');
      await b.until(`document.querySelector("section#sessions").innerText.includes("That device is signed out.")`, 6000, "signed out line");
      await b.until(`document.querySelector("section#sessions").innerText.includes("Only this device")`, 6000, "only this device");
    }],
    ["preferences save as they change", async () => {
      await b.click('section#preferences [role="radio"]', "Light");
      await b.until(`document.querySelector("section#preferences").innerText.includes("Saved.")`, 6000, "saved");
      const prefs = JSON.parse(await b.evaluate(`fetch("/api/account/preferences").then((r) => r.text())`));
      if (prefs.preferences.theme !== "light") throw new Error(`theme is ${prefs.preferences.theme}`);
      await b.shot("10-preferences");
    }],
    ["notification switches save as they flip", async () => {
      await b.goto(`${base}/settings/notifications`);
      await b.until(`document.querySelectorAll('button[role="switch"]').length >= 5`, 10000, "switches");
      await b.sleep(300);
      await b.shot("11-notifications");
      const label = await b.evaluate(`[...document.querySelectorAll('button[role="switch"]')].find((s) => !s.disabled && s.getAttribute("aria-checked") === "true").getAttribute("aria-label")`);
      await b.click('button[role="switch"]', label);
      await b.until(has(`${label}: off.`), 6000, "saved off");
      const prefs = JSON.parse(await b.evaluate(`fetch("/api/notifications/preferences").then((r) => r.text())`));
      const row = prefs.preferences.find((p) => p.label === label);
      if (row.enabled) throw new Error(`${label} is still on`);
      if (!(await b.evaluate(`[...document.querySelectorAll('button[role="switch"]')].some((s) => s.disabled)`))) throw new Error("no locked switch");
      await noSideways();
      return label;
    }],
    ["wallet shows balance, plan, packs, usage, history and receipts", async () => {
      await b.goto(`${base}/wallet`);
      await b.until(`!!document.querySelector('[data-testid="wallet-balance"]')`, 10000, "balance");
      await b.until(has("Renews") + " || " + has("Free plan"), 8000, "plan card");
      await b.until(`!!document.querySelector("section#usage") && !!document.querySelector("section#receipts")`, 8000, "usage and receipts");
      await b.sleep(400);
      await b.shot("12-wallet");
      const t = await text();
      for (const want of ["Credits", "Plan", "Top-up credits", "Demo: no payment is taken.", "History", "Receipts", "Usage", "Welcome credits"]) if (!t.includes(want)) throw new Error(`wallet lacks "${want}"`);
      await noSideways();
    }],
    ["buy a demo pack", async () => {
      const before = await b.evaluate(`document.querySelector('[data-testid="wallet-balance"]').textContent`);
      await b.click('section#packs button', "Add 100 credits");
      await b.until(has("100 credits added."), 6000, "added line");
      await b.until(`document.querySelector('[data-testid="wallet-balance"]').textContent !== ${JSON.stringify(before)}`, 6000, "balance changed");
      await b.until(`document.querySelector("section#history").innerText.includes("Top-up")`, 6000, "history row");
      await b.shot("13-topup");
      return `${before.trim()} -> ${(await b.evaluate(`document.querySelector('[data-testid="wallet-balance"]').textContent`)).trim()}`;
    }],
    ["redeem a promo code", async () => {
      await fill("section#promo input", "hello-parallax");
      await b.click('section#promo button[type="submit"]');
      await b.until(`document.querySelector("section#promo").innerText.includes("HELLO-PARALLAX")`, 6000, "promo line");
    }],
    ["a paid plan shows its renewal, a receipt, and can be cancelled and kept", async () => {
      const r = await post("/api/billing/subscription", { planId: "plus", interval: "month" });
      if (r.status !== 200) throw new Error(`plan change: ${r.status} ${JSON.stringify(r.body)}`);
      await b.reload();
      await b.until(has("Renews"), 10000, "renewal line");
      await b.until(`!!document.querySelector('ul[aria-label="Receipts"] li')`, 8000, "a receipt");
      await b.evaluate(`document.querySelector("section#receipts").scrollIntoView()`);
      await b.sleep(300);
      await b.shot("14a-receipts");
      await b.evaluate(`window.scrollTo(0, 0)`);
      await b.click('section[aria-label="Plan"] button', "Cancel plan");
      await b.until(has("then Free"), 6000, "ends line");
      await b.click('section[aria-label="Plan"] button', "Keep my plan");
      await b.until(has("Renews"), 6000, "renews again");
      await b.shot("14b-plan");
    }],
    ["invite page shows the link, the real numbers and the claim box", async () => {
      await b.goto(`${base}/invite`);
      await b.until(`document.querySelector('[data-testid="invite-link"]')?.value.includes("/join?ref=")`, 10000, "invite link");
      const r = JSON.parse(await b.evaluate(`fetch("/api/account/referral").then((r) => r.text())`));
      const each = String(r.creditsEach / 1000);
      const t = await text();
      if (!t.includes(each)) throw new Error(`no ${each} on the page`);
      for (const want of ["You get", "They get", "Friends joined", "Have an invite code?"]) if (!t.includes(want)) throw new Error(`invite lacks "${want}"`);
      await b.sleep(300);
      await b.shot("14-invite");
      await b.click("button", "Copy");
      await b.until(has("Copied") + " || " + has("Copy did not work"), 3000, "copy outcome");
      await noSideways();
    }],
    ["claiming a bad code shows why", async () => {
      await fill("section#claim input", "NOPE0000");
      await b.click('section#claim button[type="submit"]');
      await b.until(`!!document.querySelector('section#claim [role="alert"]')`, 6000, "error");
      await b.shot("15-claim-error");
    }],
    ["keyboard: Tab reaches the side list with a visible ring", async () => {
      await b.evaluate(`document.activeElement?.blur()`);
      await b.evaluate(`window.scrollTo(0, 0)`);
      let found = "";
      for (let i = 0; i < 40 && !found; i++) {
        await b.key("Tab");
        found = await b.evaluate(`(() => { const a = document.activeElement; return a && a.closest('nav[aria-label="Account"]') ? a.textContent.trim() : ""; })()`);
      }
      if (!found) throw new Error("never reached the side list");
      await b.shot("16-focus");
      return found;
    }],
    ["delete the account with the typed word", async () => {
      await b.goto(`${base}/settings#delete`);
      await b.until(`!!document.querySelector("section#delete input")`, 10000, "delete form");
      const btn = `[...document.querySelectorAll("section#delete button")].find((e) => e.textContent.includes("Delete my account"))`;
      if (!(await b.evaluate(`${btn}.disabled`))) throw new Error("delete is not locked before typing");
      await fill('section#delete input[autocomplete="off"]', "DELETE");
      await fill('section#delete input[type="password"]', `${password}-2`);
      await b.sleep(150);
      await b.shot("17-delete-ready");
      await b.click("section#delete button", "Delete my account");
      await b.until(`location.pathname === "/"`, 10000, "home page");
      const me = JSON.parse(await b.evaluate(`fetch("/api/auth/me").then((r) => r.text())`));
      if (me.user) throw new Error("still signed in");
    }],
  ]);
} finally {
  await b.close();
}
process.exit(ok ? 0 : 1);
