import "server-only";

import { getModel } from "@/registry";
import { all, get } from "@/server/db";

/**
 * Spend numbers for charts. Read only, from `ledger` and `jobs`. A credit is "spent" when
 * a job's hold became a charge; holds still running and released holds do not count.
 */

const DAY = 86_400_000;

export interface Usage {
  from: number;
  to: number;
  days: number;
  tzOffsetMinutes: number;
  totals: { spent: number; granted: number; toppedUp: number; generations: number; failed: number };
  perDay: { date: string; spent: number; generations: number }[];
  perKind: { kind: string; spent: number; generations: number }[];
  perModel: { modelId: string; name: string; kind: string; spent: number; generations: number }[];
}

/** `tzOffsetMinutes` is minutes east of UTC (UTC+2 = 120), so days split at the member's midnight. */
export function usage(userId: string, days: number, tzOffsetMinutes: number): Usage {
  const shift = tzOffsetMinutes * 60_000;
  const now = Date.now();
  const todayStart = Math.floor((now + shift) / DAY) * DAY - shift;
  const from = todayStart - (days - 1) * DAY;

  const daily = all<{ d: number; spent: number; n: number }>(
    `SELECT CAST((l.created_at + ?) / ${DAY} AS INTEGER) AS d, -SUM(l.amount) AS spent, COUNT(*) AS n
       FROM ledger l WHERE l.user_id = ? AND l.kind = 'charge' AND l.created_at >= ?
      GROUP BY d`,
    shift,
    userId,
    from,
  );
  const byDay = new Map(daily.map((r) => [r.d, r]));
  const perDay: Usage["perDay"] = [];
  for (let i = 0; i < days; i++) {
    const d = Math.floor((from + shift) / DAY) + i;
    const r = byDay.get(d);
    perDay.push({ date: new Date(d * DAY).toISOString().slice(0, 10), spent: r?.spent ?? 0, generations: r?.n ?? 0 });
  }

  const perModelRows = all<{ kind: string; model_id: string; spent: number; n: number }>(
    `SELECT j.kind, j.model_id, -SUM(l.amount) AS spent, COUNT(*) AS n
       FROM ledger l JOIN jobs j ON j.id = l.job_id AND j.user_id = l.user_id
      WHERE l.user_id = ? AND l.kind = 'charge' AND l.created_at >= ?
      GROUP BY j.kind, j.model_id ORDER BY spent DESC`,
    userId,
    from,
  );
  const kinds = new Map<string, { spent: number; generations: number }>();
  for (const r of perModelRows) {
    const k = kinds.get(r.kind) ?? { spent: 0, generations: 0 };
    k.spent += r.spent;
    k.generations += r.n;
    kinds.set(r.kind, k);
  }

  const sums = get<{ granted: number; topped: number; spent: number }>(
    `SELECT COALESCE(SUM(CASE WHEN kind = 'grant' THEN amount END), 0) AS granted,
            COALESCE(SUM(CASE WHEN kind = 'topup' THEN amount END), 0) AS topped,
            COALESCE(-SUM(CASE WHEN kind = 'charge' THEN amount END), 0) AS spent
       FROM ledger WHERE user_id = ? AND created_at >= ?`,
    userId,
    from,
  )!;
  const jobs = get<{ ok: number; failed: number }>(
    `SELECT COALESCE(SUM(status = 'succeeded'), 0) AS ok, COALESCE(SUM(status = 'failed'), 0) AS failed
       FROM jobs WHERE user_id = ? AND created_at >= ?`,
    userId,
    from,
  )!;

  return {
    from,
    to: now,
    days,
    tzOffsetMinutes,
    totals: { spent: sums.spent, granted: sums.granted, toppedUp: sums.topped, generations: jobs.ok, failed: jobs.failed },
    perDay,
    perKind: [...kinds.entries()].map(([kind, v]) => ({ kind, ...v })).sort((a, b) => b.spent - a.spent),
    perModel: perModelRows.map((r) => ({ modelId: r.model_id, name: getModel(r.model_id)?.name ?? r.model_id, kind: r.kind, spent: r.spent, generations: r.n })),
  };
}
