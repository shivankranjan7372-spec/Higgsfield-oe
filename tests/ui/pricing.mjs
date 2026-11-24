// The Pricing page: plans from the server, the billing switch, sign-in for visitors, the demo
// checkout with a promo code, then the current plan with cancel and resume. Also /enterprise.
// Run it with: python3 tests/run.py tests/ui/pricing.mjs
// (the runner starts the app in mock mode and calls: node tests/ui/pricing.mjs <base-url> <out-dir> [width] [height])
import { launch, scenario } from "./browser.mjs";

const [base, out, W = "1440", H = "900"] = process.argv.slice(2);
const b = await launch({ width: Number(W), height: Number(H), out });
const cards = `article[data-plan]`;
const noSideways = async () => {
  if (await b.evaluate(`document.documentElement.scrollWidth > window.innerWidth + 1`)) throw new Error("page is wider than the window");
};
const priceOf = (id) => b.evaluate(`document.querySelector('article[data-plan="${id}"] [data-price]')?.textContent ?? ""`);
const dialog = `[role="dialog"]`;

let ok = false;
try {
  ok = await scenario(b, [
    ["open /pricing signed out and see the plans", async () => {
      await b.goto(`${base}/pricing`);
      await b.until(`document.querySelectorAll('${cards}').length >= 1`, 15000, "plan cards");
      await b.sleep(800);
      await b.shot("01-top");
      const n = await b.evaluate(`document.querySelectorAll('${cards}').length`);
      const plans = JSON.parse(await b.evaluate(`fetch("/api/billing/plans").then((r) => r.text())`));
      const paid = plans.plans.filter((p) => p.rank > 0);
      if (n !== paid.length) throw new Error(`${n} cards for ${paid.length} paid plans`);
      return `${n} cards`;
    }],
    ["prices on the cards are the server's", async () => {
      const plans = JSON.parse(await b.evaluate(`fetch("/api/billing/plans").then((r) => r.text())`)).plans;
      const plus = plans.find((p) => p.id === "plus");
      const shown = await priceOf("plus");
      const want = `$${(plus.priceYearPerMonthCents / 100).toFixed(plus.priceYearPerMonthCents % 100 ? 2 : 0)}`;
      if (shown !== want) throw new Error(`card shows ${shown}, server says ${want}`);
      return shown;
    }],
    ["no offer banner unless an offer is configured", async () => {
      if (await b.evaluate(`!!document.querySelector('[role="timer"]')`)) throw new Error("an offer countdown is showing");
    }],
    ["no sideways scroll", noSideways],
    ["monthly switch changes the prices", async () => {
      const before = await priceOf("plus");
      await b.click('[role="group"][aria-label="Billing period"] button', "Monthly");
      await b.until(`document.querySelector('article[data-plan="plus"] [data-price]').textContent !== ${JSON.stringify(before)}`, 3000, "new price");
      await b.click(`article[data-plan="plus"]`);
      await b.shot("02-monthly");
      const after = await priceOf("plus");
      await b.click('[role="group"][aria-label="Billing period"] button', "Annual");
      await b.until(`document.querySelector('article[data-plan="plus"] [data-price]').textContent === ${JSON.stringify(before)}`, 3000, "yearly price back");
      return `${before} yearly, ${after} monthly`;
    }],
    ["a visitor is asked to sign in first", async () => {
      await b.click(`${cards} button`, "Sign in to get");
      await b.until(`!!document.querySelector('${dialog}')`, 5000, "sign-in window");
      await b.sleep(300);
      await b.shot("03-sign-in");
      const href = await b.evaluate(`[...document.querySelectorAll('${dialog} a')].map((a) => a.getAttribute("href")).join(" ")`);
      await b.key("Escape");
      await b.until(`!document.querySelector('${dialog}')`, 3000, "window closed");
      if (href && !href.includes("next=%2Fpricing")) return `links: ${href}`;
    }],
    ["compare table opens and FAQ answers", async () => {
      await b.click("button", "Show all rows");
      await b.until(`document.querySelector('#compare button[aria-expanded]').getAttribute("aria-expanded") === "true"`, 3000, "table open");
      await b.sleep(300);
      await b.shot("04-compare");
      await b.click("#faq button", "How do credits work");
      await b.until(`!!document.querySelector('#faq [data-state="open"]')`, 3000, "answer open");
      await b.sleep(300);
      await b.shot("05-faq");
    }],
    ["sign up, then the button opens checkout", async () => {
      const email = `pricing-${Date.now()}@example.com`;
      const r = await b.evaluate(`fetch("/api/auth/signup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "${email}", password: "correct horse 42", name: "Pat Tester" }) }).then((r) => r.status)`);
      if (r !== 200 && r !== 201) throw new Error(`signup answered ${r}`);
      await b.reload();
      await b.until(`!!document.querySelector('[data-current-plan]')`, 10000, "current plan strip");
      await b.click(`article[data-plan="plus"] button`, "Get Plus");
      await b.until(`!!document.querySelector('${dialog} [data-demo-note]')`, 5000, "checkout with the demo note");
      await b.sleep(300);
      await b.shot("06-checkout");
    }],
    ["a bad promo code shows the server's message", async () => {
      await b.click("#promo-code");
      await b.type("NOT-A-CODE");
      await b.click(`${dialog} button`, "Apply");
      await b.until(`!!document.querySelector('${dialog} [role="alert"]')`, 5000, "error");
    }],
    ["a good promo code adds credits", async () => {
      const before = JSON.parse(await b.evaluate(`fetch("/api/auth/me").then((r) => r.text())`)).balance;
      await b.evaluate(`(() => { const i = document.querySelector("#promo-code"); i.focus(); i.select(); })()`);
      await b.type("hello-parallax");
      await b.click(`${dialog} button`, "Apply");
      await b.until(`!!document.querySelector('${dialog} [role="status"]')`, 5000, "added");
      await b.shot("07-promo");
      const after = JSON.parse(await b.evaluate(`fetch("/api/auth/me").then((r) => r.text())`)).balance;
      if (!(after > before)) throw new Error(`balance ${before} -> ${after}`);
      return `${before} -> ${after}`;
    }],
    ["confirm makes Plus the current plan", async () => {
      await b.click(`${dialog} button`, "Confirm");
      await b.until(`(document.querySelector('${dialog}')?.innerText || "").includes("You are on Plus")`, 8000, "done message");
      await b.shot("08-done");
      await b.click(`${dialog} button`, "Done");
      await b.until(`document.querySelector('[data-current-plan]')?.getAttribute("data-current-plan") === "plus"`, 8000, "Plus is current");
      await b.until(`(document.querySelector('article[data-plan="plus"] button')?.innerText || "").includes("Current plan")`, 5000, "card says current");
      await b.until(`(document.querySelector('article[data-plan="pro"] button')?.innerText || "").includes("Upgrade")`, 5000, "Pro offers upgrade");
      await b.evaluate(`window.scrollTo(0, 0)`);
      await b.sleep(300);
      await b.shot("09-current");
    }],
    ["cancel, then resume", async () => {
      await b.click("button", "Cancel plan");
      await b.until(`!!document.querySelector('${dialog}')`, 5000, "confirm window");
      await b.shot("10-cancel");
      await b.click(`${dialog} button`, "Cancel plan");
      await b.until(`[...document.querySelectorAll("button")].some((x) => x.innerText.includes("Resume plan"))`, 8000, "resume button");
      await b.shot("11-canceling");
      await b.click("button", "Resume plan");
      await b.until(`[...document.querySelectorAll("button")].some((x) => x.innerText.includes("Cancel plan"))`, 8000, "cancel button back");
      const s = JSON.parse(await b.evaluate(`fetch("/api/billing/subscription").then((r) => r.text())`)).subscription;
      if (s.status !== "active") throw new Error(`status ${s.status}`);
    }],
    ["no sideways scroll after the changes", noSideways],
    ["full page", async () => {
      await b.shot("12-full", { full: true });
    }],
    ["/enterprise opens", async () => {
      await b.goto(`${base}/enterprise`);
      await b.until(`!!document.querySelector("h1")`, 10000, "heading");
      await b.sleep(400);
      await b.shot("13-enterprise");
      await noSideways();
    }],
  ]);
} finally {
  await b.close();
}
process.exit(ok ? 0 : 1);
