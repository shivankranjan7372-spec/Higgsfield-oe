import "server-only";

import { all, get, run, tx } from "./db";

/**
 * The credit ledger. Append-only; the balance is the sum of the rows.
 * Amounts are integers in millicredits.
 */

export type LedgerKind = "grant" | "topup" | "hold" | "charge" | "release" | "refund" | "adjust";

export interface LedgerRow {
  id: number;
  user_id: string;
  kind: LedgerKind;
  amount: number;
  job_id: string | null;
  note: string | null;
  created_at: number;
}

export function balance(userId: string): number {
  return get<{ total: number }>("SELECT COALESCE(SUM(amount), 0) AS total FROM ledger WHERE user_id = ?", userId)!.total;
}

export function grant(userId: string, kind: LedgerKind, amount: number, note: string, jobId: string | null = null) {
  run("INSERT INTO ledger (user_id, kind, amount, job_id, note, created_at) VALUES (?, ?, ?, ?, ?, ?)", userId, kind, Math.round(amount), jobId, note, Date.now());
}

/** Reserves the price of a job. Call inside the transaction that inserts the job. */
export function hold(userId: string, jobId: string, amount: number, note: string) {
  grant(userId, "hold", -Math.abs(amount), note, jobId);
}

/** The job produced its result: the hold becomes the charge. */
export function settle(jobId: string) {
  run("UPDATE ledger SET kind = 'charge' WHERE job_id = ? AND kind = 'hold'", jobId);
}

/** The job produced nothing: give the hold back. Safe to call twice. */
export function release(jobId: string, note: string) {
  tx(() => {
    const held = get<LedgerRow>("SELECT * FROM ledger WHERE job_id = ? AND kind = 'hold'", jobId);
    if (!held) return;
    if (get("SELECT 1 FROM ledger WHERE job_id = ? AND kind = 'release'", jobId)) return;
    grant(held.user_id, "release", -held.amount, note, jobId);
  });
}

/** Wallet history, newest first. A hold that was released is shown as nothing happened. */
export function history(userId: string, limit: number, before?: number): LedgerRow[] {
  return all<LedgerRow>(
    `SELECT l.* FROM ledger l
      WHERE l.user_id = ? AND l.id < ?
        AND l.kind != 'release'
        AND NOT (l.kind = 'hold' AND EXISTS (SELECT 1 FROM ledger r WHERE r.job_id = l.job_id AND r.kind = 'release'))
      ORDER BY l.id DESC LIMIT ?`,
    userId,
    before ?? Number.MAX_SAFE_INTEGER,
    limit,
  );
}
