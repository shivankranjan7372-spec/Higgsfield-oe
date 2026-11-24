// A tiny headless-Chrome driver over the DevTools protocol. No dependencies (Node 22+).
//
//   import { launch } from "./browser.mjs";
//   const b = await launch({ width: 1440, height: 900, out: "/tmp/shots" });
//   await b.goto("http://127.0.0.1:3210/image");
//   await b.until(`!!document.querySelector("h1")`);
//   await b.click("button", "Generate");        // first <button> whose label or text contains "generate"
//   await b.type("hello");                      // into whatever has focus
//   await b.shot("01-home");                    // -> /tmp/shots/01-home.png
//   console.log(b.logs());                      // console errors, exceptions, failed requests
//   await b.close();
//
// It always uses a fresh throwaway profile, so it never touches a logged-in browser.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CHROME = [process.env.CHROME_BIN, "/usr/local/bin/google-chrome", "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"].filter(Boolean);

export async function launch({ width = 1440, height = 900, out = ".", mobile = width < 600 } = {}) {
  const bin = CHROME.find((p) => existsSync(p));
  if (!bin) throw new Error("no Chrome found. Set CHROME_BIN.");
  mkdirSync(out, { recursive: true });
  const profile = mkdtempSync(join(tmpdir(), "parallax-chrome-"));
  const port = 9400 + Math.floor(Math.random() * 500);
  const chrome = spawn(
    bin,
    ["--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars", "--no-first-run", `--user-data-dir=${profile}`, `--remote-debugging-port=${port}`, `--window-size=${width},${height}`, "about:blank"],
    { stdio: "ignore" },
  );

  let wsUrl = null;
  for (let i = 0; i < 75 && !wsUrl; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      wsUrl = list.find((t) => t.type === "page")?.webSocketDebuggerUrl ?? null;
    } catch {}
    if (!wsUrl) await sleep(200);
  }
  if (!wsUrl) {
    chrome.kill("SIGKILL");
    throw new Error("Chrome did not start");
  }

  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  let seq = 0;
  const waiting = new Map();
  const seen = [];
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && waiting.has(msg.id)) {
      const { resolve, reject } = waiting.get(msg.id);
      waiting.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    } else if (msg.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(msg.params.type)) {
      seen.push(`${msg.params.type}: ${msg.params.args.map((a) => a.value ?? a.description ?? "").join(" ")}`.slice(0, 400));
    } else if (msg.method === "Runtime.exceptionThrown") {
      seen.push(`exception: ${msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text}`.slice(0, 400));
    } else if (msg.method === "Network.responseReceived" && msg.params.response.status >= 400) {
      let path = "";
      try {
        path = new URL(msg.params.response.url).pathname;
      } catch {}
      seen.push(`http ${msg.params.response.status}: ${path}`);
    }
  };
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++seq;
      waiting.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });

  /** Runs an expression in the page and returns its (JSON-able) value. Promises are awaited. */
  async function evaluate(expression) {
    const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  }
  /** Waits until the expression is truthy. */
  async function until(expression, ms = 15000, what = expression) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (await evaluate(expression)) return true;
      await sleep(150);
    }
    throw new Error(`timed out waiting for: ${what}`);
  }
  /** Centre of the first visible match; with `text`, the first whose aria-label or text contains it. */
  async function centre(selector, text) {
    const pt = await evaluate(`(() => {
      const want = ${JSON.stringify(text ?? null)};
      const all = [...document.querySelectorAll(${JSON.stringify(selector)})].filter((e) => e.getClientRects().length > 0);
      const el = want === null ? all[0] : all.find((e) => ((e.getAttribute("aria-label") || "") + " " + e.textContent).toLowerCase().includes(want.toLowerCase()));
      if (!el) return null;
      el.scrollIntoView({ block: "nearest" });
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    })()`);
    if (!pt) throw new Error(`no visible element: ${selector}${text ? ` containing "${text}"` : ""}`);
    return pt;
  }
  async function hover(selector, text) {
    const { x, y } = await centre(selector, text);
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  }
  async function click(selector, text) {
    const { x, y } = await centre(selector, text);
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
    await sleep(120);
  }
  const KEYS = { Enter: 13, Escape: 27, Tab: 9, ArrowDown: 40, ArrowUp: 38, ArrowLeft: 37, ArrowRight: 39, Backspace: 8, Home: 36, End: 35 };
  /** Presses one named key: Enter, Escape, Tab, ArrowDown, ... */
  async function key(name) {
    const extra = name === "Enter" ? { text: "\r" } : {};
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: name, code: name, windowsVirtualKeyCode: KEYS[name] ?? 0, ...extra });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: name, code: name, windowsVirtualKeyCode: KEYS[name] ?? 0 });
    await sleep(80);
  }
  /** Types text into whatever has focus. */
  async function type(text) {
    await send("Input.insertText", { text });
    await sleep(80);
  }
  async function goto(url) {
    await send("Page.navigate", { url });
    await until(`document.readyState === "complete"`, 20000, `load of ${url}`);
    await sleep(600); // hydration and first data
  }
  async function reload() {
    await send("Page.reload");
    await sleep(300);
    await until(`document.readyState === "complete"`, 20000, "reload");
    await sleep(600);
  }
  /** Saves a PNG of the window (or the whole page with `{ full: true }`) and returns its path. */
  async function shot(name, { full = false } = {}) {
    const r = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: full });
    const file = join(out, `${name}.png`);
    writeFileSync(file, Buffer.from(r.data, "base64"));
    return file;
  }
  async function resize(w, h) {
    await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: w < 600 });
    await sleep(300);
  }
  async function close() {
    try {
      ws.close();
    } catch {}
    chrome.kill("SIGKILL");
    await sleep(200);
    rmSync(profile, { recursive: true, force: true });
  }

  return { send, evaluate, until, centre, hover, click, key, type, goto, reload, shot, resize, close, sleep, logs: () => [...new Set(seen)] };
}

/** Runs named steps, keeps going after a failure, and prints a short report. Returns true when all passed. */
export async function scenario(browser, steps) {
  const lines = [];
  let n = 0;
  for (const [name, fn] of steps) {
    n++;
    try {
      const note = await fn();
      lines.push(`ok    ${name}${note ? `  (${note})` : ""}`);
    } catch (e) {
      lines.push(`FAIL  ${name}: ${e.message}`);
      try {
        await browser.shot(`fail-${String(n).padStart(2, "0")}`);
      } catch {}
    }
  }
  console.log(lines.join("\n"));
  const logs = browser.logs();
  console.log(logs.length ? `\nbrowser log (${logs.length}):\n${logs.slice(0, 30).join("\n")}` : "\nbrowser log: clean");
  return !lines.some((l) => l.startsWith("FAIL"));
}
