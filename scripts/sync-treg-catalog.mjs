#!/usr/bin/env node
/**
 * Trims a Treg catalog snapshot to what the app needs at runtime:
 * price rules (for quotes) and result descriptors (for the worker).
 *
 *   node scripts/sync-treg-catalog.mjs <snapshot.json> [out.json]
 *
 * The snapshot is the public catalog (GET https://treg.to/catalog/endpoints/<id>)
 * saved as { priced: [...], utility: [...] }. No secrets are involved.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const src = process.argv[2];
const dest = resolve(process.argv[3] ?? "src/registry/treg-catalog.json");
if (!src) {
  console.error("usage: node scripts/sync-treg-catalog.mjs <snapshot.json> [out.json]");
  process.exit(1);
}

const snap = JSON.parse(readFileSync(src, "utf8"));
const out = {};

function trimCost(cost) {
  if (!cost) return null;
  const c = {};
  if (Array.isArray(cost.table)) {
    c.table = cost.table.map((row) => {
      const r = { when: row.when ?? {}, value: row.value };
      if (row.times) r.times = row.times;
      if (row.times_min != null) r.timesMin = row.times_min;
      return r;
    });
  }
  if (cost.value != null) {
    c.value = cost.value;
    c.per = cost.per ?? 1;
    c.unit = cost.unit ?? "call";
  }
  if (cost.fallback?.value != null) c.ceiling = cost.fallback.value;
  if (cost.settle) c.settle = cost.settle;
  return c;
}

function trimAsync(a) {
  if (!a) return null;
  const d = { interval: a.interval ?? null };
  // The provider's own status word, and the words that end a job. The worker reads these
  // when Treg's summary state is not one it knows.
  if (a.status?.path) d.statusPath = a.status.path;
  if (Array.isArray(a.status?.success)) d.success = a.status.success;
  if (Array.isArray(a.status?.failure)) d.failure = a.status.failure;
  if (a.result?.path) d.resultPath = a.result.path;
  if (a.result?.fetch) {
    d.fetch = a.result.fetch;
    const p = a.result.fetch_param ?? {};
    d.fetchParam = { name: p.name ?? "id", valueFrom: p.value_from ?? a.id_from ?? "id" };
  }
  return d;
}

/** Provider headers the gateway insists on, with the values it accepts ([] means any). */
function requiredHeaders(headers) {
  const need = Object.entries(headers ?? {}).filter(([, spec]) => spec?.required);
  return need.length ? Object.fromEntries(need.map(([name, spec]) => [name, Array.isArray(spec.enum) ? spec.enum.map(String) : []])) : null;
}

for (const row of [...(snap.priced ?? []), ...(snap.utility ?? [])]) {
  const input = row.input ?? {};
  const headers = requiredHeaders(input.headers);
  out[row.id] = {
    provider: row.provider,
    platform: row.platform ?? null,
    name: row.name,
    method: row.method,
    path: row.path,
    params: [...Object.keys(input.pathParams ?? {}), ...Object.keys(input.queryParams ?? {})],
    cost: trimCost(row.cost),
    async: trimAsync(row.async),
    ...(headers ? { headers } : {}),
  };
}

const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(
  dest,
  JSON.stringify({ captured: snap.captured ?? null, source: "https://treg.to/catalog", endpoints: sorted }, null, 1) + "\n",
);
console.log(`wrote ${Object.keys(sorted).length} endpoints to ${dest}`);
