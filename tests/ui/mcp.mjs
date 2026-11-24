// The MCP page and the developer console, from a first visit to a working key.
// Run it with: python3 tests/run.py tests/ui/mcp.mjs
// (the runner starts the app in mock mode and calls: node tests/ui/mcp.mjs <base-url> <out-dir> [width] [height])
import { launch, scenario } from "./browser.mjs";

const [base, out, W = "1440", H = "900"] = process.argv.slice(2);
const b = await launch({ width: Number(W), height: Number(H), out });
const noSideways = async () => {
  if (await b.evaluate(`document.documentElement.scrollWidth > window.innerWidth + 1 || window.innerWidth > ${Number(W)} + 1`)) throw new Error("page is wider than the window");
};
// The page scrolls smoothly; the driver clicks where an element is when it asks, so jump instead.
const open = async (url) => {
  await b.goto(url);
  await b.evaluate(`document.documentElement.style.scrollBehavior = "auto"`);
};
const text = () => b.evaluate(`document.body.innerText`);
const email = `dev-${Date.now()}@example.com`;
let secret = "";
let ok = false;
try {
  ok = await scenario(b, [
    ["open /mcp and see the hero", async () => {
      await open(`${base}/mcp`);
      await b.until(`!!document.querySelector("h1") && document.querySelectorAll('ul[aria-label="Tools"] > li').length === 8`);
      await b.sleep(600);
      await b.shot("01-mcp");
      await b.shot("01b-mcp-full", { full: true });
      const h1 = await b.evaluate(`document.querySelector("h1").innerText`);
      if (!/parallax/i.test(h1)) throw new Error(`hero says "${h1}"`);
    }],
    ["no sideways scroll on /mcp", noSideways],
    ["the server address is built from this origin", async () => {
      const want = `${base}/api/mcp`;
      await b.until(`document.querySelector('#connect').innerText.includes(${JSON.stringify(want)})`, 5000, "the address");
      return want;
    }],
    ["the client bar switches the snippet", async () => {
      await b.click('[role="tab"]', "Terminal");
      await b.until(`document.querySelector('#connect pre').innerText.includes("curl -s -X POST")`, 3000, "a curl snippet");
      await b.click('[role="tab"]', "Python");
      await b.until(`document.querySelector('#connect pre').innerText.includes("import os, requests")`, 3000, "a python snippet");
      await b.click('[role="tab"]', "Config file");
      await b.until(`document.querySelector('#connect pre').innerText.includes('"mcpServers"')`, 3000, "a config snippet");
    }],
    ["copy puts the snippet on the clipboard", async () => {
      await b.click('#connect button[aria-label$="snippet"]');
      await b.until(`[...document.querySelectorAll("#connect button")].some((x) => x.innerText.includes("Copied"))`, 3000, "Copied");
      await b.sleep(200);
      await b.shot("02-copied");
      const clip = await b.evaluate(`navigator.clipboard.readText().catch(() => "")`);
      return clip ? `clipboard holds ${clip.length} characters` : "clipboard not readable in headless Chrome; the button reported success";
    }],
    ["How to connect? scrolls to the steps", async () => {
      await b.evaluate(`window.scrollTo(0, 0)`);
      await b.click("a", "How to connect?");
      await b.until(`window.scrollY > 1000 && document.querySelector("#connect").getBoundingClientRect().top < window.innerHeight - 100`, 5000, "connect in view");
      await b.sleep(400);
      await b.shot("03-connect");
    }],
    ["the add button opens a dialog and Escape closes it", async () => {
      await b.evaluate(`window.scrollTo(0, 0)`);
      await b.click("button", "Add Parallax to your agent");
      await b.until(`!!document.querySelector('[role="dialog"] pre')`, 3000, "dialog with snippet");
      await b.sleep(300);
      await b.shot("04-dialog");
      await b.key("Escape");
      await b.until(`!document.querySelector('[role="dialog"]')`, 3000, "dialog closed");
    }],
    ["tool search and filters", async () => {
      await b.click('input[type="search"]');
      await b.type("get_balance");
      await b.until(`document.querySelectorAll('ul[aria-label="Tools"] > li').length === 1`, 3000, "one tool");
      await b.click('button[aria-label="Clear search"]');
      await b.click("button[aria-pressed]", "Generate scope");
      await b.until(`document.querySelectorAll('ul[aria-label="Tools"] > li').length === 1 && !!document.querySelector('[data-tool="generate"]')`, 3000, "generate only");
      await b.click("button[aria-pressed]", "All tools");
      await b.click('[role="tab"]', "Audio");
      await b.until(`document.querySelectorAll('ul[aria-label="Example asks"] > li').length === 2`, 3000, "two audio asks");
      await b.click('[role="tab"]', "Popular");
    }],
    ["the console asks a visitor to sign in", async () => {
      await open(`${base}/developer`);
      await b.until(`document.body.innerText.includes("Build with Parallax")`, 10000, "explainer");
      await b.sleep(300);
      await b.shot("05-console-signed-out");
      await noSideways();
    }],
    ["the reference works for anyone", async () => {
      await b.click('[role="tab"]', "Reference");
      await b.until(`document.querySelectorAll('ul[aria-label="API routes"] > li').length >= 12`, 10000, "routes");
      await b.sleep(300);
      await b.shot("06-reference");
      await noSideways();
      const t = await text();
      if (!t.includes("curl -s")) throw new Error("no curl examples");
    }],
    ["sign up, and the keys tab is empty", async () => {
      const r = await b.evaluate(`fetch("/api/auth/signup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: ${JSON.stringify(email)}, password: "correct horse 42" }) }).then((r) => r.status)`);
      if (r !== 200 && r !== 201) throw new Error(`signup answered ${r}`);
      await open(`${base}/developer?tab=keys`);
      await b.until(`document.body.innerText.includes("No keys yet")`, 10000, "empty state");
      await b.shot("07-keys-empty");
    }],
    ["create a key and see the secret once", async () => {
      await b.click("button", "Create key");
      await b.until(`!!document.querySelector('[role="dialog"] input')`, 3000, "form");
      await b.type("CI server");
      await b.click('[role="dialog"] button[type="submit"]');
      await b.until(`!!document.querySelector("[data-secret]")`, 5000, "the secret");
      secret = await b.evaluate(`document.querySelector("[data-secret]").innerText.trim()`);
      if (!secret.startsWith("pxk_")) throw new Error("secret looks wrong");
      await b.click('[role="dialog"] button', "Copy secret");
      await b.until(`document.querySelector('[role="dialog"]').innerText.includes("Copied")`, 3000, "copied");
      await b.sleep(200);
      await b.shot("08-secret");
      await b.click('[role="dialog"] button', "I have saved it");
      await b.until(`!document.querySelector('[role="dialog"]') && document.querySelectorAll("[data-key-id]").length === 1`, 3000, "one key");
      await b.shot("09-keys");
    }],
    ["the key works on the MCP server", async () => {
      const r = JSON.parse(await b.evaluate(`fetch("/api/mcp", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer ${secret}", "MCP-Protocol-Version": "2025-11-25" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) }).then((r) => r.text())`));
      const names = r.result.tools.map((t) => t.name).sort().join(",");
      if (names !== "generate,get_balance,get_generation,get_model,list_files,list_generations,list_models,quote") throw new Error(`tools: ${names}`);
      await b.evaluate(`fetch("/api/v1/balance", { headers: { authorization: "Bearer ${secret}" } })`);
      return "8 tools, as the page lists";
    }],
    ["rename the key", async () => {
      await b.click("button", "Rename CI server");
      await b.until(`!!document.querySelector('[role="dialog"] input')`, 3000, "form");
      await b.evaluate(`(() => { const i = document.querySelector('[role="dialog"] input'); i.select(); })()`);
      await b.type("Build box");
      await b.click('[role="dialog"] button[type="submit"]');
      await b.until(`!document.querySelector('[role="dialog"]') && document.body.innerText.includes("Build box")`, 5000, "renamed");
    }],
    ["usage lists the calls and filters by key", async () => {
      await b.click('[role="tab"]', "Usage");
      await b.until(`document.querySelectorAll("tbody tr").length >= 2`, 10000, "two rows");
      const t = await text();
      if (!t.includes("/mcp tools/list") || !t.includes("/v1/balance")) throw new Error("routes missing");
      const id = await b.evaluate(`document.querySelector("select option:nth-child(2)").value`);
      await b.evaluate(`(() => { const s = document.querySelector("select"); const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set; set.call(s, ${JSON.stringify(id)}); s.dispatchEvent(new Event("change", { bubbles: true })); })()`);
      await b.until(`document.querySelectorAll("tbody tr").length >= 2`, 5000, "rows for the key");
      await b.sleep(300);
      await b.shot("10-usage");
      await noSideways();
    }],
    ["webhooks: add an endpoint or see why not", async () => {
      await b.click('[role="tab"]', "Webhooks");
      await b.until(`document.body.innerText.includes("No endpoints yet")`, 10000, "empty state");
      await b.shot("11-hooks-empty");
      await b.click("button", "Add endpoint");
      await b.until(`!!document.querySelector('[role="dialog"] input[type="url"]')`, 3000, "form");
      await b.type("http://example.com/hook");
      await b.click('[role="dialog"] button[type="submit"]');
      await b.until(`!!document.querySelector('[role="dialog"] [role="alert"]')`, 10000, "a refusal for plain http");
      await b.sleep(200);
      await b.shot("12-hook-refused");
      const msg = await b.evaluate(`document.querySelector('[role="dialog"] [role="alert"]').innerText`);
      await b.key("Escape");
      return msg;
    }],
    ["revoke the key", async () => {
      await b.click('[role="tab"]', "API keys");
      await b.click("button", "Revoke Build box");
      await b.until(`!!document.querySelector('[role="dialog"]')`, 3000, "confirm");
      await b.click('[role="dialog"] button', "Revoke");
      await b.until(`!document.querySelector('[role="dialog"]') && document.querySelector("[data-key-id]").innerText.includes("Revoked")`, 5000, "revoked");
      await b.shot("13-revoked");
      const code = await b.evaluate(`fetch("/api/v1/balance", { headers: { authorization: "Bearer ${secret}" } }).then((r) => r.status)`);
      if (code !== 401) throw new Error(`revoked key answered ${code}`);
    }],
  ]);
} finally {
  await b.close();
}
process.exit(ok ? 0 : 1);
