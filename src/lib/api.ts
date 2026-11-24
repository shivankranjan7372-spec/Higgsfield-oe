import type { publicUser } from "@/server/auth";

/* Types only: nothing from the server is bundled into the browser. */
export type { Job, JobStatus } from "@/server/jobs";
export type { Asset } from "@/server/assets";
export type SessionUser = ReturnType<typeof publicUser>;

/** What every failed call throws. `message` is already written for people; show it as is. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface Options {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  /** A plain object is sent as JSON. A `FormData` is sent as a file upload. */
  body?: unknown;
  signal?: AbortSignal;
}

/**
 * Calls our own API and returns the parsed answer. Throws `ApiError` on any failure, with the
 * server's `{ error: { code, message } }` when there is one.
 */
export async function api<T>(path: string, { method = "GET", body, signal }: Options = {}): Promise<T> {
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      signal,
      credentials: "same-origin",
      headers: body !== undefined && !isForm ? { "content-type": "application/json" } : undefined,
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    });
  } catch (cause) {
    if ((cause as Error)?.name === "AbortError") throw cause;
    throw new ApiError(0, "network", "Can't reach the server. Check your connection and try again.");
  }
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const e = (data as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiError(res.status, e?.code ?? "error", e?.message ?? "Something went wrong. Try again.");
  }
  return data as T;
}

/** For `useSWR(path, fetcher)`. */
export function fetcher<T>(path: string): Promise<T> {
  return api<T>(path);
}

/** The words to show for anything caught. */
export function errorMessage(e: unknown): string {
  return e instanceof ApiError ? e.message : "Something went wrong. Try again.";
}
