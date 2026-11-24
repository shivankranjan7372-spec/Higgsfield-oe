/**
 * Proves every catalog entry can run as written: the model exists and can run, the fixed
 * values are legal for it, the media slots exist and can hold what the form allows, the
 * template only names real fields and fits the model's prompt limit, and every price the
 * form can show is an exact price row. Pure: no Node, no database.
 */
import { getModel, quoteJob, resolveValues, type Control, type Filled, type ModelDef, type Values } from "@/registry";
import { checkFields, render, templateNames } from "./template";
import { CATEGORIES, type AppDef } from "./types";

/** Paths under /api/apps/ that are not app ids. */
export const RESERVED_IDS = new Set(["pinned", "recent", "check"]);

const ID = /^[a-z0-9][a-z0-9-]{1,35}$/;
const FIELD_ID = /^[a-z0-9_]{1,40}$/;

/** How many files sit in each model slot when every input holds `pick(input)` files. */
export function filledFor(app: AppDef, pick: (i: AppDef["inputs"][number]) => number): Filled {
  const filled: Filled = {};
  for (const i of app.inputs) filled[i.slot] = (filled[i.slot] ?? 0) + pick(i);
  return filled;
}

function candidates(c: Control): unknown[] {
  switch (c.type) {
    case "select":
      return c.options.map((o) => o.value);
    case "slider":
      return [...new Set([c.min, c.default, c.max])];
    case "toggle":
      return [true, false];
    case "text":
      return [""];
  }
}

/** The longest prompt the form can produce: every text field full, every choice at its longest. */
function longestPrompt(app: AppDef): number {
  let n = app.template.length;
  for (const f of app.fields) {
    if (f.type === "text") n += f.maxLength;
    else if (f.type === "choice") n += Math.max(...f.options.map((o) => (o.prompt ?? o.label).length));
    else n += 20;
  }
  return n;
}

function checkModelApp(app: AppDef, model: ModelDef, problems: string[]) {
  const say = (msg: string) => problems.push(`${app.id}: ${msg}`);
  if (model.status !== "available") say(`model ${model.id} is ${model.status}`);
  if (app.result !== model.output) say(`result ${app.result} but the model makes ${model.output}`);
  if (!model.prompt && app.template.trim()) say("the model takes no prompt");

  const controls = new Map(model.controls.map((c) => [c.id, c]));
  for (const id of Object.keys(app.values)) if (!controls.has(id)) say(`fixed value for unknown control "${id}"`);
  for (const id of app.open) {
    if (!controls.has(id)) say(`open control "${id}" does not exist`);
  }

  // Slots: they exist, and the form can neither underfill nor overfill them.
  const slots = new Map(model.slots.map((s) => [s.id, s]));
  for (const i of app.inputs) {
    if (!slots.has(i.slot)) say(`input "${i.id}" maps to missing slot "${i.slot}"`);
    if (i.min < 0 || i.max < 1 || i.min > i.max) say(`input "${i.id}" has bad limits`);
  }
  const most = filledFor(app, (i) => i.max);
  const least = filledFor(app, (i) => i.min);
  for (const s of model.slots) {
    if ((most[s.id] ?? 0) > s.max) say(`slot "${s.id}" takes ${s.max}, the form allows ${most[s.id]}`);
    if (s.min > 0 && (least[s.id] ?? 0) < s.min && !s.when) say(`slot "${s.id}" needs ${s.min}, the form can send fewer`);
  }

  // Fixed values must survive resolveValues unchanged, with the form at its minimum and its maximum.
  for (const filled of [least, most]) {
    const resolved = resolveValues(model, app.values, filled);
    for (const [k, v] of Object.entries(app.values)) {
      if (String(resolved[k]) !== String(v)) say(`fixed value ${k}=${v} is not legal (becomes ${resolved[k]})`);
    }
  }

  // Prompt length and price: defaults, and every option of every open control.
  if (model.prompt && longestPrompt(app) > model.prompt.maxLength) say(`the longest prompt (${longestPrompt(app)}) is over the model's ${model.prompt.maxLength}`);
  let prompt = "";
  try {
    prompt = render(app, checkFields(app, Object.fromEntries(app.fields.filter((f) => f.type === "text" && f.required && !f.default).map((f) => [f.id, "sample"]))));
  } catch (err) {
    say(`defaults do not pass the form check: ${(err as Error).message}`);
  }
  if (model.prompt?.required && !prompt) say("the default prompt is empty");
  const variants: Values[] = [{}];
  for (const id of app.open) {
    const c = controls.get(id);
    if (c) for (const v of candidates(c)) variants.push({ [id]: v as string });
  }
  for (const filled of [least, most]) {
    for (const extra of variants) {
      const values = resolveValues(model, { ...app.values, ...extra }, filled);
      const q = quoteJob(model, { prompt: prompt || "sample", values, filled, count: 1 });
      if (!q.exact) say(`no exact price for ${JSON.stringify(extra)} with ${JSON.stringify(filled)}`);
    }
  }
}

/** Returns a list of problems. Empty means the catalog is sound. */
export function checkCatalog(list: AppDef[]): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  const categories = new Set(CATEGORIES.map((c) => c.id));
  for (const app of list) {
    const say = (msg: string) => problems.push(`${app.id}: ${msg}`);
    if (!ID.test(app.id) || RESERVED_IDS.has(app.id)) say("bad id");
    if (seen.has(app.id)) say("duplicate id");
    seen.add(app.id);
    if (!categories.has(app.category)) say(`unknown category ${app.category}`);
    if (!app.name.trim() || !app.pitch.trim()) say("needs a name and a pitch");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(app.added)) say("bad added date");

    const fieldIds = new Set<string>();
    for (const f of app.fields) {
      if (!FIELD_ID.test(f.id) || fieldIds.has(f.id)) say(`bad or duplicate field id "${f.id}"`);
      fieldIds.add(f.id);
      if (f.type === "choice" && !f.options.some((o) => o.value === f.default)) say(`field "${f.id}" default is not an option`);
      if (f.type === "choice" && new Set(f.options.map((o) => o.value)).size !== f.options.length) say(`field "${f.id}" repeats an option`);
      if (f.type === "number" && (f.default < f.min || f.default > f.max || f.step <= 0)) say(`field "${f.id}" default is out of range`);
      if (f.type === "colour" && !/^#[0-9a-f]{6}$/.test(f.default)) say(`field "${f.id}" default is not #rrggbb`);
      if (f.type === "text" && f.default.length > f.maxLength) say(`field "${f.id}" default is too long`);
    }
    const inputIds = new Set<string>();
    for (const i of app.inputs) {
      if (!FIELD_ID.test(i.id) || inputIds.has(i.id)) say(`bad or duplicate input id "${i.id}"`);
      inputIds.add(i.id);
    }
    const named = templateNames(app.template);
    for (const n of named) if (!fieldIds.has(n)) say(`template names unknown field "${n}"`);
    for (const f of fieldIds) if (!named.includes(f)) say(`field "${f}" is not used by the template`);

    if (app.status === "soon") {
      if (app.modelId && getModel(app.modelId)?.status === "available") say("soon, but its model can run");
      continue;
    }
    const model = getModel(app.modelId);
    if (!model) {
      say(`unknown model ${app.modelId}`);
      continue;
    }
    checkModelApp(app, model, problems);
  }
  return problems;
}
