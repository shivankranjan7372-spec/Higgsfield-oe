// The agent: home, a live chat with every kind of row, the sidebar, connectors and
// the smaller pages. Run it with: python3 tests/run.py tests/ui/agent.mjs
// (the runner starts the app in mock mode and calls: node tests/ui/agent.mjs <base-url> <out-dir> [width] [height])
import { launch, scenario } from "./browser.mjs";

const [base, out, W = "1440", H = "900"] = process.argv.slice(2);
const narrow = Number(W) < 1024;
const b = await launch({ width: Number(W), height: Number(H), out });
const wide = async () => {
  if (await b.evaluate(`document.documentElement.scrollWidth > window.innerWidth + 1`)) throw new Error("page is wider than the window");
};
const has = (text) => `document.body.innerText.includes(${JSON.stringify(text)})`;
/** On a phone the sidebar is a sheet behind the menu button. */
const openSidebar = async () => {
  if (!narrow) return;
  await b.click('button[aria-label="Open menu"]');
  await b.until(`!!document.querySelector('nav[aria-label="Agent"]')`, 5000, "sidebar sheet");
  await b.sleep(300);
};
const send = async (text) => {
  await b.click("#agent-prompt");
  await b.type(text);
  await b.key("Enter");
};
let chatUrl = "";

let ok = false;
try {
  ok = await scenario(b, [
    ["open /agent and see the home", async () => {
      await b.goto(`${base}/agent`);
      await b.until(`!!document.querySelector("h1") && !!document.querySelector("#agent-prompt")`, 30000, "headline and composer");
      await b.until(`document.querySelectorAll('button[aria-label^="Use this example"]').length >= 3`, 20000, "example cards");
      await b.sleep(800);
      await b.shot("01-home");
      await wide();
      if (narrow) return "sidebar hidden behind menu";
      if (!(await b.evaluate(`!!document.querySelector('nav[aria-label="Agent"]')`))) throw new Error("no sidebar");
      if (!(await b.evaluate(has("No chats yet")))) throw new Error("no empty chat list");
    }],
    ["the logo goes home", async () => {
      const href = await b.evaluate(`[...document.querySelectorAll('a[aria-label="Back to the home page"]')].map((a) => a.getAttribute("href")).join(",")`);
      if (!href.split(",").includes("/")) throw new Error(`logo links to ${href}`);
    }],
    ["a pill filters the examples", async () => {
      const before = await b.evaluate(`document.querySelectorAll('button[aria-label^="Use this example"]').length`);
      await b.click('[role="tab"]', "Marketing");
      await b.until(`document.querySelector('[role="tab"][aria-selected="true"]').textContent.includes("Marketing")`, 3000, "Marketing selected");
      const after = await b.evaluate(`document.querySelectorAll('button[aria-label^="Use this example"]').length`);
      if (!(after > 0 && after < before)) throw new Error(`cards ${before} -> ${after}`);
      await b.shot("02-pill");
      await b.click('[role="tab"]', "All");
      return `${before} -> ${after}`;
    }],
    ["a card fills the composer", async () => {
      await b.click('button[aria-label^="Use this example"]');
      await b.until(`document.querySelector("#agent-prompt").value.length > 10`, 3000, "prompt filled");
      await b.sleep(500);
      await b.shot("03-card-filled");
      await b.evaluate(`(() => { const t = document.querySelector("#agent-prompt"); const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set; set.call(t, ""); t.dispatchEvent(new Event("input", { bubbles: true })); })()`);
    }],
    ["the model picker lists models from the config", async () => {
      await b.click('button[aria-label^="Assistant model"]');
      await b.until(`document.querySelectorAll('[role="menuitemradio"]').length >= 2`, 5000, "models");
      await b.sleep(300);
      await b.shot("04-models");
      await b.key("Escape");
      await b.until(`document.querySelectorAll('[role="menuitemradio"]').length === 0`, 3000, "closed");
      const where = await b.evaluate(`document.activeElement?.getAttribute("aria-label") || ""`);
      if (!where.startsWith("Assistant model")) throw new Error(`focus went to "${where}"`);
    }],
    ["the mode menu shows both modes", async () => {
      await b.click('button[aria-label^="Approval mode"]');
      await b.until(`document.querySelectorAll('[role="menuitemradio"]').length === 2`, 5000, "two modes");
      await b.sleep(300);
      await b.shot("05-modes");
      await b.key("Escape");
    }],
    ["sending starts a chat that asks before generating", async () => {
      await send("generate an image of a red fox in the snow");
      await b.until(`location.pathname.includes("/agent/c/")`, 30000, "chat page");
      chatUrl = await b.evaluate(`location.href`);
      await b.until(`!!document.querySelector('section[aria-label^="Generate"]')`, 30000, "approval card");
      await b.sleep(500);
      await b.shot("06-approval");
      await wide();
    }],
    ["allowing it shows the result", async () => {
      await b.click('section[aria-label^="Generate"] button', "Allow");
      // Only pictures on screen count: the home page stays in the document, hidden, after the move to
      // the chat, and its example pictures that were never scrolled to have not loaded.
      const shown = `[...document.querySelectorAll('section ul img')].filter((i) => i.getClientRects().length)`;
      await b.until(`${shown}.length > 0`, 60000, "a generated picture");
      await b.until(`${shown}.every((i) => i.complete && i.naturalWidth > 0)`, 15000, "picture loaded");
      await b.until(has("All done"), 20000, "the closing reply");
      await b.sleep(500);
      await b.shot("07-result");
    }],
    ["a question card takes an answer", async () => {
      await send("ask me Do you like the colours?");
      await b.until(`!!document.querySelector('section[aria-label="Do you like the colours?"] input')`, 30000, "question card");
      await b.sleep(400);
      await b.shot("08-question");
      await b.click('section[aria-label="Do you like the colours?"] button', "Yes");
      await b.until(has("Answered: Yes"), 15000, "answered");
    }],
    ["the cloud computer shows its screen", async () => {
      await send("look up paper lanterns on the web");
      await b.until(`!!document.querySelector('img[alt="Screen of your cloud computer"]')`, 30000, "screenshot");
      await b.until(`document.querySelectorAll('[aria-busy="true"]').length === 0 && ${has("All done")}`, 20000, "reply done");
      await b.sleep(500);
      await b.shot("09-computer");
    }],
    ["stop ends a running turn", async () => {
      await send("[slow] take your time");
      await b.until(`!!document.querySelector('button[aria-label="Stop"]')`, 10000, "stop button");
      await b.shot("10-running");
      await b.click('button[aria-label="Stop"]');
      await b.until(`!document.querySelector('button[aria-label="Stop"]')`, 15000, "stopped");
      await b.sleep(600);
      await b.shot("11-stopped");
    }],
    ["an app action needs a connection first", async () => {
      await send("email sam@example.com hello there");
      await b.until(`!!document.querySelector('section[aria-label^="Connect"]')`, 30000, "connect card");
      await b.sleep(400);
      await b.shot("12-connect-card");
      await wide();
    }],
    ["the chat is in the sidebar: pin, rename, search", async () => {
      await openSidebar();
      await b.until(`document.querySelectorAll('nav ul[aria-label="Chats"] li').length >= 1`, 10000, "a chat in the list");
      await b.click('button[aria-label^="Chat actions"]');
      await b.click('[role="menuitemradio"]', "Pin");
      await b.until(`!!document.querySelector('nav [aria-label="Pinned"]')`, 5000, "pinned");
      await b.click('button[aria-label^="Chat actions"]');
      await b.click('[role="menuitemradio"]', "Rename");
      await b.until(`!!document.querySelector('nav form input')`, 3000, "rename box");
      await b.evaluate(`(() => { const i = document.querySelector('nav form input'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(i, ""); i.dispatchEvent(new Event("input", { bubbles: true })); })()`);
      await b.type("Fox poster");
      await b.key("Enter");
      await b.until(`document.querySelector('nav ul[aria-label="Chats"]').innerText.includes("Fox poster")`, 5000, "renamed");
      await b.click('button[aria-label="Search chats"]');
      await b.type("zzz-nothing");
      await b.until(has("No chats match that."), 5000, "no match");
      await b.shot("13-sidebar-search");
      await b.click('button[aria-label="Search chats"]');
      if (narrow) await b.key("Escape");
    }],
    ["connectors: connect and disconnect", async () => {
      await b.goto(`${base}/agent/connectors`);
      await b.until(`document.querySelectorAll('button[aria-label^="Connect "], button[aria-label^="Disconnect "]').length >= 6`, 20000, "six apps");
      await b.click('button[aria-label="Connect Calendar"]');
      await b.until(`!!document.querySelector('button[aria-label="Disconnect Calendar"]')`, 10000, "calendar connected");
      await b.sleep(400);
      await b.shot("14-connectors");
      await wide();
      await b.click('button[aria-label="Disconnect Calendar"]');
      await b.until(`!!document.querySelector('button[aria-label="Connect Calendar"]')`, 10000, "calendar disconnected");
    }],
    ["the connect landing page finishes a connection", async () => {
      await b.goto(`${base}/agent/connect/mail?connected_account_id=mock_ca_mail`);
      await b.until(`document.body.innerText.includes("is connected") || document.body.innerText.includes("did not") || document.body.innerText.includes("waiting")`, 15000, "a result");
      await b.sleep(300);
      await b.shot("15-connect-landing");
      return await b.evaluate(`document.querySelector('[role="status"] p').textContent`);
    }],
    ["projects: create one", async () => {
      await b.goto(`${base}/agent/projects`);
      await b.until(has("No projects yet"), 20000, "empty projects");
      await b.click("button", "New project");
      await b.click("#new-project-name");
      await b.type("Spring launch");
      await b.click("button", "Create project");
      await b.until(`document.querySelectorAll('main li').length >= 1 && ${has("Spring launch")}`, 10000, "project listed");
      await b.shot("16-projects");
      await wide();
    }],
    ["skills list the built-ins", async () => {
      await b.goto(`${base}/agent/skills`);
      await b.until(has("Built in"), 20000, "built-in skills");
      await b.shot("17-skills");
      await wide();
    }],
    ["schedules: create one", async () => {
      await b.goto(`${base}/agent/schedules`);
      await b.until(has("No schedules yet"), 20000, "empty schedules");
      await b.click("button", "New schedule");
      await b.click("#sch-title");
      await b.type("Daily moon");
      await b.click("#sch-prompt");
      await b.type("Make a picture of tonight's moon");
      await b.click("button", "Create schedule");
      await b.until(has("Every 1 day"), 10000, "schedule listed");
      await b.shot("18-schedules");
      await wide();
    }],
    ["memory page opens", async () => {
      await b.goto(`${base}/agent/memory`);
      await b.until(`(document.querySelector("h1")?.textContent ?? "").includes("Memory") && !document.querySelector("main .shimmer")`, 20000, "memory");
      await b.shot("19-memory");
    }],
    ["the chat reloads with its transcript, then is deleted", async () => {
      await b.goto(chatUrl);
      await b.until(`!!document.querySelector('section ul img')`, 30000, "transcript back");
      await b.sleep(500);
      await b.shot("20-reload");
      await openSidebar();
      await b.click('button[aria-label^="Chat actions"]');
      await b.click('[role="menuitemradio"]', "Delete");
      await b.until(`!!document.querySelector('[role="dialog"]')`, 3000, "confirm");
      await b.click('[role="dialog"] button', "Delete");
      await b.until(`location.pathname === "/agent"`, 15000, "back home");
      await b.until(has("No chats yet") + ` || ${narrow}`, 10000, "empty list again");
    }],
    ["an unknown chat says so", async () => {
      await b.goto(`${base}/agent/c/sch_nope`);
      await b.until(`!!document.querySelector('[role="alert"]')`, 20000, "not found");
      await b.shot("21-missing");
    }],
  ]);
} finally {
  await b.close();
}
process.exit(ok ? 0 : 1);
