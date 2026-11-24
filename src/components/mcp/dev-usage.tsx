"use client";

import { useState } from "react";
import useSWR from "swr";
import useSWRInfinite from "swr/infinite";
import { formatCredits } from "@/config/economy";
import { dev } from "@/content/mcp";
import { errorMessage, fetcher } from "@/lib/api";
import { Button, cn } from "@/ui";
import { KEYS_URL, type KeysAnswer } from "./dev-keys";
import { Empty, ErrorLine, Panel, Skeleton, when, whenFull, type UsageRow, type UsageTotals } from "./dev-parts";

const t = dev.usage;
const PAGE = 50;

interface UsageAnswer {
  requests: UsageRow[];
  last24h: UsageTotals[];
}

export function UsagePanel() {
  const [keyId, setKeyId] = useState("");
  const keys = useSWR<KeysAnswer>(KEYS_URL, fetcher);
  const names = new Map(keys.data?.keys.map((k) => [k.id, k.name]) ?? []);

  const { data, error, isLoading, isValidating, size, setSize, mutate } = useSWRInfinite<UsageAnswer>(
    (index, prev: UsageAnswer | null) => {
      if (prev && prev.requests.length < PAGE) return null;
      const q = new URLSearchParams({ limit: String(PAGE) });
      if (keyId) q.set("key", keyId);
      const last = prev?.requests.at(-1);
      if (index > 0 && last) q.set("before", String(last.cursor));
      return `/api/developer/usage?${q}`;
    },
    fetcher,
  );

  const rows = data?.flatMap((p) => p.requests) ?? [];
  const totals = data?.[0]?.last24h ?? [];
  const sum = totals.reduce((a, r) => ({ requests: a.requests + r.requests, errors: a.errors + r.errors, credits: a.credits + r.credits }), { requests: 0, errors: 0, credits: 0 });
  const more = !!data && (data.at(-1)?.requests.length ?? 0) >= PAGE;
  const loadingMore = isValidating && size > (data?.length ?? 0);

  return (
    <Panel
      title={t.title}
      blurb={t.blurb}
      action={
        <label className="flex items-center gap-2 text-xs leading-4 font-medium text-text-nav">
          {t.keyFilter}
          <select
            value={keyId}
            onChange={(e) => {
              setKeyId(e.target.value);
              setSize(1);
            }}
            className="h-8 max-w-[220px] rounded-md border border-border-default bg-surface-field px-2 text-sm leading-5 text-text-primary"
          >
            <option value="">{t.allKeys}</option>
            {keys.data?.keys.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
                {k.revokedAt ? " (revoked)" : ""}
              </option>
            ))}
          </select>
        </label>
      }
    >
      <div className="grid grid-cols-3 gap-2">
        {[
          [t.requests, data ? String(sum.requests) : "–"],
          [t.errors, data ? String(sum.errors) : "–"],
          [t.credits, data ? formatCredits(sum.credits) : "–"],
        ].map(([label, value]) => (
          <div key={label} className="flex min-w-0 flex-col gap-1 rounded-2xl border border-border-subtle bg-surface-primary p-4">
            <span className="truncate text-xs leading-4 text-text-secondary">
              {label} · {t.last24}
            </span>
            <span className="font-mono text-2xl leading-8 font-semibold text-text-primary">{value}</span>
          </div>
        ))}
      </div>

      {error ? <ErrorLine message={errorMessage(error)} onRetry={() => mutate()} /> : null}
      {isLoading ? <Skeleton rows={4} /> : null}
      {data && rows.length === 0 ? <Empty text={t.empty} /> : null}
      {rows.length ? (
        <div className="scroll-quiet overflow-x-auto rounded-2xl border border-border-subtle">
          <table className="w-full min-w-[640px] text-left text-sm leading-5">
            <caption className="sr-only">{t.title}</caption>
            <thead className="bg-surface-primary text-xs leading-4 text-text-secondary">
              <tr>
                {t.cols.map((c) => (
                  <th key={c} scope="col" className="px-4 py-3 font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border-subtle transition-colors duration-150 hover:bg-surface-primary">
                  <td className="px-4 py-2 whitespace-nowrap text-text-nav" title={whenFull(r.createdAt)}>
                    {when(r.createdAt)}
                  </td>
                  <td className="max-w-[160px] truncate px-4 py-2 text-text-primary">{names.get(r.keyId) ?? r.keyId}</td>
                  <td className="px-4 py-2 font-mono text-xs text-text-nav">{r.method}</td>
                  <td className="max-w-[280px] truncate px-4 py-2 font-mono text-xs text-text-primary">{r.route}</td>
                  <td className={cn("px-4 py-2 font-mono text-xs", r.status >= 400 ? "text-danger" : "text-brand")}>{r.status}</td>
                  <td className="px-4 py-2 font-mono text-xs text-text-nav">{r.credits ? formatCredits(r.credits) : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {more ? (
        <Button variant="soft" size="md" className="self-center" disabled={loadingMore} onClick={() => setSize(size + 1)}>
          {t.more}
        </Button>
      ) : null}
    </Panel>
  );
}
