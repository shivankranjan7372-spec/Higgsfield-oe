/** Shapes from docs/api/agent.md. Written here, client-side, from the API page. */

export interface Chat {
  id: string;
  title: string;
  projectId: string | null;
  skillIds: string[];
  pinned: boolean;
  incognito: boolean;
  state: "idle" | "running" | "waiting";
  rev: number;
  createdAt: number;
  updatedAt: number;
}

export interface Turn {
  id: string;
  chatId: string;
  status: "queued" | "running" | "waiting" | "done" | "failed" | "stopped" | "interrupted";
  mode: string;
  model: string;
  steps: number;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
}

export interface FileRef {
  id: string;
  kind: "image" | "video" | "audio";
  url: string;
  posterUrl: string | null;
  width?: number | null;
  height?: number | null;
}

export interface Row {
  chatId: string;
  seq: number;
  updatedSeq: number;
  kind: "message" | "tool-call" | "card" | "event" | "notice";
  body: Record<string, unknown>;
  createdAt: number;
}

export interface AgentConfig {
  modes: { id: string; name: string; description?: string }[];
  defaultMode: string;
  models: { id: string; name: string; description?: string; tier: string }[];
  defaultModel: string;
  /** Who does the assistant's thinking: the built-in loop or an outside agent. */
  engine?: { id: string; name: string };
  services: Record<string, string>;
  limits: { maxSteps: number; turnSeconds: number; maxSchedules: number; messageMaxLength: number; maxFilesPerMessage: number };
}

export interface ShowcaseItem {
  id: string;
  category: string;
  title: string;
  prompt: string;
  skillId?: string | null;
}

export interface Project {
  id: string;
  name: string;
  instructions: string;
  fileIds: string[];
  chatCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  instructions: string;
  builtIn: boolean;
  category: string;
}

export interface ConnectorApp {
  slug: string;
  name: string;
  description: string;
  category: string;
  logoUrl: string | null;
  status: "none" | "pending" | "active";
}

export interface McpServer {
  id: string;
  name: string;
  url: string;
  createdAt: number;
}

export interface Schedule {
  id: string;
  chatId: string | null;
  title: string;
  prompt: string;
  intervalMinutes: number;
  enabled: boolean;
  nextRunAt: number;
  lastRunAt: number | null;
  createdAt: number;
}

export interface Memory {
  id: string;
  text: string;
  chatId: string | null;
  createdAt: number;
}

export interface ComputerStatus {
  status: "none" | "creating" | "running" | "suspended" | "error";
  lastUsedAt: number | null;
  screenshotAt: number | null;
  screenshotUrl: string | null;
}
