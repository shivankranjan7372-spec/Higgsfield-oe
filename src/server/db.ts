import "server-only";

import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { DatabaseSync, type StatementSync } from "node:sqlite";

/**
 * One SQLite file, opened once per process. SQLite keeps the whole product runnable
 * with `npm run dev` and nothing else installed.
 */

export type Param = string | number | bigint | null | Uint8Array;

interface Holder {
  db?: DatabaseSync;
  statements?: Map<string, StatementSync>;
  depth?: number;
}

// Kept on globalThis so hot reload in development does not open a second connection.
const holder = ((globalThis as unknown as { __parallaxDb?: Holder }).__parallaxDb ??= {});

export function dataDir(): string {
  return process.env.PARALLAX_DATA_DIR ?? path.join(/* turbopackIgnore: true */ process.cwd(), "data");
}

function migrationsDir(): string {
  return path.join(/* turbopackIgnore: true */ process.cwd(), "migrations");
}

function migrate(database: DatabaseSync) {
  database.exec("CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)");
  const done = new Set((database.prepare("SELECT name FROM _migrations").all() as { name: string }[]).map((r) => r.name));
  const files = fs.readdirSync(migrationsDir()).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();
  for (const file of files) {
    if (done.has(file)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir(), file), "utf8");
    database.exec("BEGIN IMMEDIATE");
    try {
      database.exec(sql);
      database.prepare("INSERT INTO _migrations (name, applied_at) VALUES (?, ?)").run(file, Date.now());
      database.exec("COMMIT");
    } catch (err) {
      database.exec("ROLLBACK");
      throw new Error(`Migration ${file} failed: ${(err as Error).message}`);
    }
  }
}

export function db(): DatabaseSync {
  if (holder.db) return holder.db;
  const dir = dataDir();
  fs.mkdirSync(path.join(dir, "assets"), { recursive: true });
  const database = new DatabaseSync(path.join(dir, "parallax.db"));
  database.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  migrate(database);
  holder.db = database;
  holder.statements = new Map();
  holder.depth = 0;
  return database;
}

function statement(sql: string): StatementSync {
  const database = db();
  let s = holder.statements!.get(sql);
  if (!s) {
    s = database.prepare(sql);
    holder.statements!.set(sql, s);
  }
  return s;
}

export function get<T>(sql: string, ...params: Param[]): T | undefined {
  return statement(sql).get(...params) as T | undefined;
}

export function all<T>(sql: string, ...params: Param[]): T[] {
  return statement(sql).all(...params) as T[];
}

export function run(sql: string, ...params: Param[]): { changes: number; lastInsertRowid: number } {
  const r = statement(sql).run(...params);
  return { changes: Number(r.changes), lastInsertRowid: Number(r.lastInsertRowid) };
}

/** Runs `fn` in one write transaction. Nested calls join the outer transaction. */
export function tx<T>(fn: () => T): T {
  const database = db();
  if ((holder.depth ?? 0) > 0) return fn();
  database.exec("BEGIN IMMEDIATE");
  holder.depth = 1;
  try {
    const out = fn();
    database.exec("COMMIT");
    return out;
  } catch (err) {
    database.exec("ROLLBACK");
    throw err;
  } finally {
    holder.depth = 0;
  }
}

/** `job_x7Gk2...`. URL-safe, and safe inside file names and provider metadata. */
export function newId(prefix: string): string {
  return `${prefix}_${randomBytes(12).toString("base64url").replace(/[-_]/g, "x")}`;
}

export function parseJson<T>(text: string | null | undefined, fallback: T): T {
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}
