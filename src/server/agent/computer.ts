import "server-only";

import { deflateSync, crc32 } from "node:zlib";
import { all, get, run } from "@/server/db";
import { ApiError } from "@/server/errors";
import { limits, serviceMode } from "./config";
import { publish } from "./hub";

/**
 * One cloud computer per member, created on first use and suspended when idle.
 * Live: the Orgo REST API. Mock: a pretend computer that echoes commands and returns
 * a tiny PNG drawn in code.
 */

export interface Shot {
  png: Buffer;
  width: number;
  height: number;
}

export interface ComputerClient {
  readonly live: boolean;
  create(name: string): Promise<{ externalId: string }>;
  resume(externalId: string): Promise<void>;
  suspend(externalId: string): Promise<void>;
  screenshot(externalId: string): Promise<Shot>;
  click(externalId: string, x: number, y: number, button: string, double: boolean): Promise<void>;
  type(externalId: string, text: string): Promise<void>;
  key(externalId: string, key: string): Promise<void>;
  scroll(externalId: string, x: number, y: number, direction: "up" | "down", amount: number): Promise<void>;
  bash(externalId: string, command: string): Promise<{ output: string; exitCode: number }>;
}

/* ---------------------------------- live ---------------------------------- */

const ORGO = "https://www.orgo.ai/api";

class OrgoComputer implements ComputerClient {
  readonly live = true;
  private workspaceId: string | null = process.env.ORGO_WORKSPACE_ID || null;

  private async call<T>(method: string, path: string, body?: unknown, timeoutMs = 60_000): Promise<T> {
    const res = await fetch(ORGO + path, {
      method,
      headers: { Authorization: `Bearer ${process.env.ORGO_API_KEY}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text();
    if (!res.ok) {
      let code = String(res.status);
      try {
        code = (JSON.parse(text) as { code?: string }).code ?? code;
      } catch {
        /* not JSON */
      }
      // Branch on the code, never log the body: it may echo request details.
      throw new Error(`computer service error ${code}`);
    }
    return (text ? JSON.parse(text) : {}) as T;
  }

  private async workspace(): Promise<string> {
    if (this.workspaceId) return this.workspaceId;
    // Note: with an account key this creates a default workspace when there is none.
    const list = await this.call<{ id: string }[] | { workspaces?: { id: string }[] }>("GET", "/workspaces");
    const items = Array.isArray(list) ? list : (list.workspaces ?? []);
    if (!items[0]) throw new Error("no computer workspace");
    this.workspaceId = items[0].id;
    return this.workspaceId;
  }

  async create(name: string) {
    const ws = await this.workspace();
    const c = await this.call<{ id: string }>("POST", "/computers", { workspace_id: ws, name, os: "linux", ram: 4, cpu: 2, resolution: "1280x720x24" }, 180_000);
    // Suspend after idle minutes on Orgo's side as well, as a second safety net.
    await this.call("PATCH", `/computers/${c.id}/resize`, { auto_stop_minutes: Math.round(limits.computerIdleMs() / 60_000) }).catch(() => {});
    return { externalId: c.id };
  }
  async resume(id: string) {
    await this.call("POST", `/computers/${id}/resume`, {}, 120_000);
  }
  async suspend(id: string) {
    await this.call("POST", `/computers/${id}/suspend`, {});
  }
  async screenshot(id: string): Promise<Shot> {
    const r = await this.call<{ image: string; width: number; height: number }>("GET", `/computers/${id}/screenshot?response_format=base64&format=png`);
    const b64 = r.image.replace(/^data:[^,]+,/, "");
    return { png: Buffer.from(b64, "base64"), width: r.width, height: r.height };
  }
  async click(id: string, x: number, y: number, button: string, double: boolean) {
    await this.call("POST", `/computers/${id}/click`, { x, y, button, double });
  }
  async type(id: string, text: string) {
    // Long text runs into the 30 s action cap, so send it in pieces.
    for (let i = 0; i < text.length; i += 1500) await this.call("POST", `/computers/${id}/type`, { text: text.slice(i, i + 1500) });
  }
  async key(id: string, key: string) {
    await this.call("POST", `/computers/${id}/key`, { key });
  }
  async scroll(id: string, x: number, y: number, direction: "up" | "down", amount: number) {
    await this.call("POST", `/computers/${id}/scroll`, { x, y, direction, amount });
  }
  async bash(id: string, command: string) {
    const r = await this.call<{ output: string; exit_code: number }>("POST", `/computers/${id}/bash`, { command, timeout: 120 }, 180_000);
    return { output: r.output ?? "", exitCode: r.exit_code ?? 0 };
  }
}

/* ---------------------------------- mock ---------------------------------- */

/** A small solid-colour PNG, built by hand so the mock needs no files. */
export function tinyPng(width = 64, height = 36, rgb: [number, number, number] = [40, 90, 160]): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolour
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const o = y * (width * 3 + 1);
    for (let x = 0; x < width; x++) raw.set(rgb, o + 1 + x * 3);
  }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

class MockComputer implements ComputerClient {
  readonly live = false;
  async create() {
    return { externalId: `mock-${Math.random().toString(36).slice(2, 10)}` };
  }
  async resume() {}
  async suspend() {}
  async screenshot(): Promise<Shot> {
    return { png: tinyPng(), width: 64, height: 36 };
  }
  async click() {}
  async type() {}
  async key() {}
  async scroll() {}
  async bash(_id: string, command: string) {
    return { output: `mock computer ran: ${command}`, exitCode: 0 };
  }
}

const holder = globalThis as unknown as { __agentComputer?: ComputerClient };

export function computerClient(): ComputerClient {
  const live = serviceMode("computer") === "live";
  if (!holder.__agentComputer || holder.__agentComputer.live !== live) holder.__agentComputer = live ? new OrgoComputer() : new MockComputer();
  return holder.__agentComputer;
}

/* ------------------------------ per member box ----------------------------- */

interface ComputerRow {
  user_id: string;
  external_id: string | null;
  status: "creating" | "running" | "suspended" | "error";
  screenshot: Uint8Array | null;
  screenshot_at: number | null;
  last_used_at: number;
  created_at: number;
}

export interface ComputerStatus {
  status: "none" | ComputerRow["status"];
  lastUsedAt: number | null;
  screenshotAt: number | null;
  /** Latest screenshot, served by Parallax. Null until the first one. */
  screenshotUrl: string | null;
}

export function computerStatus(userId: string): ComputerStatus {
  const r = get<ComputerRow>("SELECT * FROM super_computers WHERE user_id = ?", userId);
  if (!r) return { status: "none", lastUsedAt: null, screenshotAt: null, screenshotUrl: null };
  return {
    status: r.status,
    lastUsedAt: r.last_used_at,
    screenshotAt: r.screenshot_at,
    screenshotUrl: r.screenshot ? `/api/agent/computer/screenshot?v=${r.screenshot_at}` : null,
  };
}

export function latestScreenshot(userId: string): Buffer | null {
  const r = get<{ screenshot: Uint8Array | null }>("SELECT screenshot FROM super_computers WHERE user_id = ?", userId);
  return r?.screenshot ? Buffer.from(r.screenshot) : null;
}

function setStatus(userId: string, status: ComputerRow["status"]) {
  run("UPDATE super_computers SET status = ? WHERE user_id = ?", status, userId);
  publish(userId, "computer", computerStatus(userId));
}

// Creating the same member's computer twice at once would make two; one promise per member.
const starting = ((globalThis as unknown as { __agentStarting?: Map<string, Promise<string>> }).__agentStarting ??= new Map());

/** The member's computer id, creating or waking it as needed. */
export async function ensureComputer(userId: string): Promise<string> {
  const r = get<ComputerRow>("SELECT * FROM super_computers WHERE user_id = ?", userId);
  if (r?.external_id && r.status === "running") {
    run("UPDATE super_computers SET last_used_at = ? WHERE user_id = ?", Date.now(), userId);
    return r.external_id;
  }
  const pending = starting.get(userId);
  if (pending) return pending;
  const p = (async () => {
    const client = computerClient();
    const now = Date.now();
    if (r?.external_id && r.status !== "error") {
      setStatus(userId, "creating");
      await client.resume(r.external_id);
      run("UPDATE super_computers SET status = 'running', last_used_at = ? WHERE user_id = ?", Date.now(), userId);
      publish(userId, "computer", computerStatus(userId));
      return r.external_id;
    }
    run(
      `INSERT INTO super_computers (user_id, status, last_used_at, created_at) VALUES (?, 'creating', ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET status = 'creating', external_id = NULL`,
      userId,
      now,
      now,
    );
    publish(userId, "computer", computerStatus(userId));
    try {
      const { externalId } = await client.create(`parallax-${userId.slice(-10)}`);
      run("UPDATE super_computers SET external_id = ?, status = 'running', last_used_at = ? WHERE user_id = ?", externalId, Date.now(), userId);
      publish(userId, "computer", computerStatus(userId));
      return externalId;
    } catch (err) {
      setStatus(userId, "error");
      throw err;
    }
  })().finally(() => starting.delete(userId));
  starting.set(userId, p);
  return p;
}

export function saveScreenshot(userId: string, png: Buffer) {
  run("UPDATE super_computers SET screenshot = ?, screenshot_at = ?, last_used_at = ? WHERE user_id = ?", png, Date.now(), Date.now(), userId);
  publish(userId, "computer", computerStatus(userId));
}

/** Suspends computers nobody has used for a while. Called by the background sweep. */
export async function suspendIdle() {
  const cutoff = Date.now() - limits.computerIdleMs();
  for (const r of all<ComputerRow>("SELECT * FROM super_computers WHERE status = 'running' AND last_used_at < ?", cutoff)) {
    try {
      if (r.external_id) await computerClient().suspend(r.external_id);
      setStatus(r.user_id, "suspended");
    } catch {
      /* try again on the next sweep */
    }
  }
}

export function computerUnavailable(): ApiError {
  return new ApiError(503, "computer_unavailable", "Your cloud computer could not start. Try again in a minute.");
}
