// Community, post, profile and contest screens, walked through by three visitors:
// Ada (shares a picture and enters a contest), Ben (likes, follows, votes, recreates) and a
// signed-out visitor who becomes a guest.
// Run it with: python3 tests/run.py tests/ui/community.mjs
import { launch, scenario } from "./browser.mjs";

const [base, out, W = "1440", H = "900"] = process.argv.slice(2);
const b = await launch({ width: Number(W), height: Number(H), out });
const feed = `ul[aria-label="Fresh from the community"] li`;
const stamp = Date.now().toString(36);
let ada = "";
let postId = "";

const post = (path, body) =>
  `fetch(${JSON.stringify(path)}, { method: "POST", headers: { "content-type": "application/json" }, body: ${JSON.stringify(JSON.stringify(body ?? {}))} }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }))`;

async function signUp(name) {
  await b.evaluate(post("/api/auth/logout"));
  const r = await b.evaluate(post("/api/auth/signup", { email: `${name.toLowerCase()}-${stamp}@example.com`, password: "password123", name }));
  if (r.status !== 200) throw new Error(`signup ${r.status}: ${JSON.stringify(r.body)}`);
  return r.body.user.handle;
}

async function noSideways(where) {
  const wide = await b.evaluate(`document.documentElement.scrollWidth - window.innerWidth`);
  if (wide > 1) throw new Error(`${where} is ${wide}px wider than the window`);
}

let ok = false;
try {
  ok = await scenario(b, [
    ["signed out, /community opens with the sub-nav and an empty feed", async () => {
      await b.goto(`${base}/community`);
      await b.until(`!!document.querySelector('nav[aria-label="Community"]')`, 15000, "sub-nav");
      await b.until(`document.body.innerText.includes("Nobody has shared anything yet")`, 15000, "empty feed");
      await b.until(`document.body.innerText.includes("Nothing featured yet")`, 15000, "empty carousel");
      await b.shot("01-empty");
      await noSideways("/community");
    }],
    ["signed out, sharing asks to create an account", async () => {
      await b.click("button", "Share your work");
      await b.until(`!!document.querySelector('[role="dialog"]') && document.querySelector('[role="dialog"]').innerText.includes("Create a free account")`, 5000, "sign-in ask");
      await b.shot("02-publish-signed-out");
      await b.key("Escape");
      await b.until(`!document.querySelector('[role="dialog"]')`, 3000, "dialog closed");
    }],
    ["Ada signs up and makes a picture", async () => {
      ada = await signUp("Ada");
      const r = await b.evaluate(post("/api/jobs", { modelId: "flux-schnell", prompt: "a quiet harbour at dawn, soft mist", values: { aspect: "16:9" } }));
      if (r.status !== 200) throw new Error(`job ${r.status}: ${JSON.stringify(r.body)}`);
      await b.until(`fetch("/api/assets?source=generated").then((r) => r.json()).then((d) => d.assets.length > 0)`, 60000, "a finished picture");
      return `handle ${ada}`;
    }],
    ["Ada shares it from /community", async () => {
      await b.goto(`${base}/community`);
      await b.click("button", "Share your work");
      await b.until(`document.querySelectorAll('[role="dialog"] [role="radio"]').length > 0`, 10000, "her results");
      await b.click('[role="dialog"] input');
      await b.type("Harbour at dawn");
      await b.click('[role="dialog"] textarea');
      await b.type("First light over still water.");
      await b.click('[role="dialog"] input[placeholder^="Up to 8"]');
      await b.type("harbour, Morning Light");
      await b.shot("03-publish-form");
      await b.click('[role="dialog"] button[type="submit"]', "Share");
      await b.until(`!!document.querySelector('[role="dialog"] a[href^="/community/post/"]')`, 10000, "link to the new post");
      postId = await b.evaluate(`document.querySelector('[role="dialog"] a[href^="/community/post/"]').getAttribute("href").split("/").pop()`);
      await b.click('[role="dialog"] a', "Open your post");
      await b.until(`location.pathname.startsWith("/community/post/") && !!document.querySelector("h1")`, 15000, "post page");
      await b.until(`document.querySelector("h1").innerText.includes("Harbour at dawn")`, 10000, "title");
      await b.sleep(500);
      await b.shot("04-own-post");
      await noSideways("post page");
      return postId;
    }],
    ["Ada comments, edits and sees her settings", async () => {
      await b.until(`document.body.innerText.includes("a quiet harbour at dawn")`, 5000, "prompt shown");
      await b.click("textarea#comment-body");
      await b.type("Taken just before sunrise.");
      await b.click('form button[type="submit"]', "Post");
      await b.until(`[...document.querySelectorAll('ul[aria-label="Comments"] li')].some((l) => l.innerText.includes("before sunrise"))`, 8000, "comment listed");
      await b.click("button", "Edit");
      await b.until(`!!document.querySelector('[role="dialog"] input')`, 5000, "edit window");
      await b.evaluate(`(() => { const i = document.querySelector('[role="dialog"] input'); i.select(); })()`);
      await b.type("Harbour at first light");
      await b.click('[role="dialog"] button[type="submit"]', "Save changes");
      await b.until(`document.querySelector("h1").innerText.includes("first light")`, 8000, "new title");
      await b.shot("05-own-post-edited");
    }],
    ["Ada enters the open contest", async () => {
      await b.goto(`${base}/contests`);
      await b.until(`document.querySelectorAll('ul[aria-label="Contests"] li').length >= 3`, 10000, "three contests");
      await b.shot("06-contests");
      await noSideways("/contests");
      await b.click('ul[aria-label="Contests"] a', "Quiet Cities");
      await b.until(`location.pathname === "/contests/quiet-cities" && !!document.querySelector("h1")`, 15000, "contest page");
      await b.sleep(600);
      await b.shot("07-contest");
      await noSideways("contest page");
      await b.click("button", "Enter a post");
      await b.until(`document.querySelectorAll('[role="dialog"] [role="radio"]').length > 0`, 10000, "her posts");
      await b.click('[role="dialog"] [role="radio"]');
      await b.click('[role="dialog"] button', "Enter a post");
      await b.until(`document.body.innerText.includes("You are in")`, 10000, "entered");
      await b.click('[role="tab"]', "Rules");
      await b.until(`!!document.querySelector("ol li")`, 5000, "rules");
      await b.shot("08-contest-rules");
    }],
    ["Ben signs up and sees Ada's post in the carousel and the feed", async () => {
      await signUp("Ben");
      await b.goto(`${base}/community`);
      await b.until(`document.querySelectorAll('${feed}').length >= 1`, 15000, "a tile");
      await b.until(`[...document.querySelectorAll("h2")].some((h) => h.innerText.includes("Harbour at first light"))`, 10000, "featured title");
      await b.sleep(800);
      await b.shot("09-feed");
      await noSideways("/community with posts");
      await b.hover(feed);
      await b.sleep(300);
      await b.shot("10-tile-hover");
    }],
    ["Ben likes and saves from the tile", async () => {
      await b.hover(feed);
      await b.click(`${feed} button[aria-label="Like"]`);
      await b.until(`!!document.querySelector('${feed} button[aria-pressed="true"][aria-label="Unlike"]')`, 8000, "liked");
      await b.click(`${feed} button[aria-label="Save"]`);
      await b.until(`!!document.querySelector('${feed} button[aria-pressed="true"][aria-label="Saved"]')`, 8000, "saved");
    }],
    ["feed filters narrow and clear", async () => {
      await b.click('[role="group"] button', "New");
      await b.until(`document.querySelectorAll('${feed}').length >= 1`, 8000, "new tab");
      await b.click('[role="group"] button', "All kinds");
      await b.until(`document.querySelectorAll('[role="menuitemradio"]').length === 4`, 5000, "kind menu");
      await b.shot("11-kind-menu");
      await b.click('[role="menuitemradio"]', "Videos");
      await b.until(`document.body.innerText.includes("No posts match these filters")`, 8000, "filtered empty");
      await b.shot("12-filtered-empty");
      await b.click("button", "Clear filters");
      await b.until(`document.querySelectorAll('${feed}').length >= 1`, 8000, "back again");
      await b.click('[role="group"] button', "Top");
      await b.until(`!!document.querySelector('[role="group"] button[aria-label^="Period"]')`, 5000, "period picker");
    }],
    ["saved view lists the save", async () => {
      await b.click('nav[aria-label="Community"] a', "Saved");
      await b.until(`document.querySelectorAll('ul[aria-label="Saved posts"] li').length === 1`, 8000, "saved post");
      await b.click('nav[aria-label="Community"] a', "Creators");
      await b.until(`[...document.querySelectorAll('ul[aria-label="Creators"] li')].some((l) => l.innerText.includes("Ada"))`, 8000, "Ada listed");
      await b.shot("13-creators");
    }],
    ["Ben follows Ada and comments on the post", async () => {
      await b.goto(`${base}/community/post/${postId}`);
      await b.until(`!!document.querySelector("h1")`, 15000, "post");
      await b.click("button", "Follow");
      await b.until(`[...document.querySelectorAll("button")].some((x) => x.innerText.trim() === "Following")`, 8000, "following");
      await b.click("textarea#comment-body");
      await b.type("Lovely stillness.");
      await b.click('form button[type="submit"]', "Post");
      await b.until(`[...document.querySelectorAll('ul[aria-label="Comments"] li')].some((l) => l.innerText.includes("Lovely stillness"))`, 8000, "comment");
      await b.click('ul[aria-label="Comments"] button', "Delete");
      await b.until(`![...document.querySelectorAll('ul[aria-label="Comments"] li')].some((l) => l.innerText.includes("Lovely stillness"))`, 8000, "comment removed");
      await b.shot("14-post-visitor");
    }],
    ["Ben reports it from the menu", async () => {
      await b.click("button", "Report");
      await b.until(`document.querySelectorAll('[role="menuitemradio"]').length === 7`, 5000, "reasons");
      await b.key("Escape");
      await b.until(`document.querySelectorAll('[role="menuitemradio"]').length === 0`, 3000, "menu closed");
    }],
    ["Recreate opens the image studio with the model and prompt", async () => {
      await b.click("button", "Recreate");
      await b.until(`location.pathname === "/image" && location.search.includes("model=flux-schnell") && location.search.includes("prompt=")`, 15000, "studio address");
      return await b.evaluate(`location.pathname + location.search`);
    }],
    ["Ada's profile shows her post and Ben as a follower", async () => {
      await b.goto(`${base}/u/${ada}`);
      await b.until(`!!document.querySelector("h1") && document.querySelectorAll('ul[aria-label^="Posts"] li').length === 1`, 15000, "profile with a post");
      await b.sleep(400);
      await b.shot("15-profile");
      await noSideways("profile");
      await b.click('[role="tab"]', "Followers");
      await b.until(`[...document.querySelectorAll('ul[aria-label="Followers"] li')].some((l) => l.innerText.includes("Ben"))`, 8000, "Ben in followers");
      await b.click("button", "Hide their posts");
      await b.until(`document.body.innerText.includes("You have hidden")`, 5000, "hidden");
      await b.click("button", "Show their posts");
      await b.until(`!document.body.innerText.includes("You have hidden")`, 5000, "shown again");
    }],
    ["Ben votes for Ada's entry", async () => {
      await b.goto(`${base}/contests/quiet-cities?tab=entries`);
      await b.until(`document.querySelectorAll('ul[aria-label="Entries"] li').length === 1`, 15000, "an entry");
      await b.click('ul[aria-label="Entries"] button', "Vote");
      await b.until(`!!document.querySelector('ul[aria-label="Entries"] button[aria-pressed="true"]')`, 8000, "voted");
      await b.shot("16-contest-entries");
    }],
    ["a missing post and contest say so", async () => {
      await b.goto(`${base}/community/post/pst_doesnotexist`);
      await b.until(`document.body.innerText.includes("not here anymore")`, 10000, "post not found");
      await b.goto(`${base}/contests/nope`);
      await b.until(`document.body.innerText.includes("does not exist")`, 10000, "contest not found");
    }],
    ["signed out: reading works, a like makes a guest, comments ask to join", async () => {
      await b.evaluate(post("/api/auth/logout"));
      await b.goto(`${base}/community/post/${postId}`);
      await b.until(`!!document.querySelector("h1")`, 15000, "post");
      await b.until(`document.body.innerText.includes("Create a free account to comment")`, 5000, "comment invite");
      await b.click("button", "Like");
      await b.until(`[...document.querySelectorAll("button[aria-pressed='true']")].some((x) => x.innerText.includes("Unlike"))`, 10000, "guest like");
      const me = await b.evaluate(`fetch("/api/auth/me").then((r) => r.json())`);
      if (!me.user?.isGuest) throw new Error("no guest account was made");
      await b.shot("17-guest-post");
      await b.goto(`${base}/community?view=following`);
      await b.until(`!!document.querySelector('section[aria-label="From people you follow"]') && document.body.innerText.includes("Follow members to see their work here")`, 10000, "following view");
      await b.shot("18-guest-following");
    }],
  ]);
} finally {
  await b.close();
}
process.exit(ok ? 0 : 1);
