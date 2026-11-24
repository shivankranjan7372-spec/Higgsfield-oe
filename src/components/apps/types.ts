/** Shapes the Apps API returns (docs/api/apps.md). */
import type { Job } from "@/lib/api";
import type { Control } from "@/registry";

export interface Price {
  millicredits: number;
  credits: string;
  perResult: number;
  count: number;
}

export interface AppSummary {
  id: string;
  name: string;
  category: string;
  categoryLabel: string;
  pitch: string;
  tags: string[];
  status: "available" | "soon";
  note: string | null;
  badge: "new" | "trending" | null;
  result: "image" | "video" | "audio";
  modelId: string | null;
  modelName: string | null;
  added: string;
  runs: number;
  price: Price | null;
  pinned: boolean | null;
  lastRunAt?: number;
}

export interface Category {
  id: string;
  label: string;
  count: number;
}

export interface Catalog {
  apps: AppSummary[];
  categories: Category[];
  tags: { id: string; count: number }[];
}

interface FieldBase {
  id: string;
  label: string;
  hint?: string;
}

export type AppField =
  | (FieldBase & { type: "text"; required: boolean; default: string; placeholder?: string; maxLength: number })
  | (FieldBase & { type: "choice"; options: { value: string; label: string }[]; default: string })
  | (FieldBase & { type: "number"; min: number; max: number; step: number; default: number; unit?: string })
  | (FieldBase & { type: "colour"; default: string });

export interface AppInput {
  id: string;
  label: string;
  hint?: string | null;
  accept: ("image" | "video" | "audio")[];
  min: number;
  max: number;
}

export interface AppDetail extends AppSummary {
  eta: number | null;
  form: { fields: AppField[]; inputs: AppInput[]; controls: Control[]; maxCount: number };
}

export type FieldValue = string | number | boolean;

export interface AppRun {
  id: string;
  appId: string;
  fields: Record<string, FieldValue>;
  values: Record<string, FieldValue>;
  inputs: Record<string, string[]>;
  jobs: Job[];
  createdAt: number;
  cursor: number;
}
