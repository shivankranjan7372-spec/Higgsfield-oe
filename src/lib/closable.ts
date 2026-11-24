import { guideHint, promo } from "@/content/site";

/*
 * Things a person can close for good: the promo strip, the guide hint, the guide cards in the
 * agent and Shot Planner side panels.
 *
 * What is closed lives in localStorage and is mirrored onto <html data-closed="promo guide">
 * by a tiny script in the page head, before the first paint. CSS in globals.css hides
 * anything marked `data-closable="<name>"` whose name is in that list. Because no React
 * state is involved, a closed strip never flashes and the server and browser always agree.
 *
 * To add one: give it a name and a version id here, add its selector to the rule in
 * globals.css, and put `data-closable="<name>"` on its outer element.
 */
export const closable = {
  promo: promo.id,
  guide: guideHint.id,
  agentGuide: "agent-guide-1",
  cinemaGuide: "cinema-guide-1",
} as const;

export type ClosableName = keyof typeof closable;

const STORE = "parallax:closed";

function mark(name: ClosableName) {
  const root = document.documentElement;
  const now = new Set((root.getAttribute("data-closed") ?? "").split(" ").filter(Boolean));
  now.add(name);
  root.setAttribute("data-closed", [...now].join(" "));
}

/** Hides it now and on every later visit, until its id in `closable` changes. */
export function closeForGood(name: ClosableName) {
  mark(name);
  try {
    const saved: unknown = JSON.parse(window.localStorage.getItem(STORE) ?? "[]");
    const list = new Set(Array.isArray(saved) ? saved.filter((x): x is string => typeof x === "string") : []);
    list.add(`${name}:${closable[name]}`);
    window.localStorage.setItem(STORE, JSON.stringify([...list]));
  } catch {
    // Private mode or a full disk: it stays closed for this page view only.
  }
}

/** Hides it for this page view without remembering, for example when an offer runs out. */
export function hideNow(name: ClosableName) {
  mark(name);
}

/**
 * Runs in the page head before anything is drawn. It is plain text on purpose: it must not
 * wait for React. It hides what was closed earlier, and the promo once it is over or off.
 */
export const bootScript = `(function(){try{var c=${JSON.stringify(closable)},s=[],o=[];try{s=JSON.parse(localStorage.getItem(${JSON.stringify(STORE)})||"[]")}catch(e){}for(var k in c){if(s.indexOf(k+":"+c[k])>-1)o.push(k)}if(o.indexOf("promo")<0&&(${JSON.stringify(!promo.enabled)}||Date.now()>=${Date.parse(promo.endsAt)}))o.push("promo");if(o.length)document.documentElement.setAttribute("data-closed",o.join(" "))}catch(e){}})();`;
