"use client";

import useSWR from "swr";
import { dev } from "@/content/mcp";
import { errorMessage, fetcher } from "@/lib/api";
import { cn } from "@/ui";
import { CodeBlock } from "./copy";
import { ErrorLine, Panel, Pill, Skeleton } from "./dev-parts";

const t = dev.reference;
export const OPENAPI_URL = "/api/v1/openapi.json";

type Schema = {
  type?: string;
  description?: string;
  properties?: Record<string, Schema>;
  required?: string[];
  $ref?: string;
  enum?: unknown[];
  format?: string;
  default?: unknown;
};
interface Param {
  name: string;
  in: string;
  required?: boolean;
  description?: string;
  schema?: Schema;
}
interface Operation {
  operationId: string;
  summary: string;
  description?: string;
  "x-scope"?: string;
  parameters?: Param[];
  requestBody?: { content: Record<string, { schema: Schema }> };
}
interface OpenApi {
  info: { title: string; description?: string };
  servers: { url: string }[];
  paths: Record<string, Record<string, Operation>>;
}

const methodTone: Record<string, string> = {
  GET: "bg-[#D1FE1726] text-brand",
  POST: "bg-[#5B8CFF26] text-[#9DB8FF]",
  PATCH: "bg-[#FFB54726] text-[#FFCB80]",
  DELETE: "bg-[#FF6B6B26] text-danger",
};

function sample(s: Schema | undefined, key: string): unknown {
  if (!s) return "...";
  if (s.default !== undefined) return s.default;
  if (s.enum?.length) return s.enum[0];
  if (key === "modelId") return "flux-schnell";
  if (key === "prompt") return "a lighthouse in fog";
  switch (s.type) {
    case "integer":
    case "number":
      return 1;
    case "boolean":
      return true;
    case "object":
      return {};
    case "array":
      return [];
    default:
      return "...";
  }
}

function curl(server: string, path: string, method: string, op: Operation): string {
  const query = (op.parameters ?? []).filter((p) => p.in === "query" && p.name === "limit").map((p) => `${p.name}=10`);
  const url = `${server}${path.replace(/\{(\w+)\}/g, (_m, n: string) => `$${n.toUpperCase()}`)}${query.length ? `?${query.join("&")}` : ""}`;
  const lines = [`curl -s${method === "GET" ? "" : ` -X ${method}`} "${url}" \\`, `  -H "Authorization: Bearer $PARALLAX_KEY"`];
  const json = op.requestBody?.content["application/json"]?.schema;
  const multipart = op.requestBody?.content["multipart/form-data"];
  if (json) {
    const body: Record<string, unknown> = {};
    for (const k of json.required?.length ? json.required : Object.keys(json.properties ?? {}).slice(0, 2)) body[k] = sample(json.properties?.[k], k);
    if (json.properties?.prompt && !("prompt" in body)) body.prompt = sample(json.properties.prompt, "prompt");
    lines[lines.length - 1] += " \\";
    lines.push(`  -H "Content-Type: application/json" \\`, `  -d '${JSON.stringify(body)}'`);
  } else if (multipart) {
    lines[lines.length - 1] += " \\";
    lines.push(`  -F "file=@picture.png"`);
  } else if (path.endsWith("/content")) {
    lines[lines.length - 1] += " \\";
    lines.push("  -o result.bin");
  }
  return lines.join("\n");
}

export function ReferencePanel() {
  const { data, error, isLoading, mutate } = useSWR<OpenApi>(OPENAPI_URL, fetcher);
  const server = data?.servers[0]?.url ?? "";
  const ops = data
    ? Object.entries(data.paths).flatMap(([path, byMethod]) => Object.entries(byMethod).map(([m, op]) => ({ path, method: m.toUpperCase(), op })))
    : [];

  return (
    <Panel
      title={t.title}
      blurb={t.blurb}
      action={
        <a
          href={OPENAPI_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-8 items-center rounded-md bg-border-subtle px-3 text-sm leading-4 font-medium text-text-primary transition-colors duration-150 hover:bg-border-default"
        >
          {t.openapi}
        </a>
      }
    >
      {error ? <ErrorLine message={errorMessage(error)} onRetry={() => mutate()} /> : null}
      {isLoading ? <Skeleton rows={4} /> : null}
      {data ? (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10">
          <nav aria-label="Routes" className="hidden flex-col gap-[2px] lg:sticky lg:top-4 lg:flex lg:self-start">
            {ops.map(({ path, method, op }) => (
              <a
                key={op.operationId}
                href={`#op-${op.operationId}`}
                className="flex items-center gap-2 rounded-lg px-2 py-[6px] text-xs leading-4 text-text-nav transition-colors duration-150 hover:bg-border-subtle hover:text-text-primary"
              >
                <span className="w-11 shrink-0 font-mono text-2xs font-semibold text-text-secondary">{method}</span>
                <span className="truncate">{op.summary || path}</span>
              </a>
            ))}
          </nav>
          <div className="flex min-w-0 flex-col gap-4">
            {data.info.description ? <p className="max-w-[720px] text-sm leading-5 text-text-nav">{data.info.description}</p> : null}
            <ul aria-label="API routes" className="flex flex-col gap-4">
              {ops.map(({ path, method, op }) => (
                <li key={op.operationId} id={`op-${op.operationId}`} className="flex min-w-0 scroll-mt-6 flex-col gap-3 rounded-2xl border border-border-subtle bg-surface-primary p-4 md:p-5">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className={cn("inline-flex h-6 items-center rounded-md px-2 font-mono text-xs leading-4 font-semibold", methodTone[method] ?? "bg-border-subtle")}>{method}</span>
                    <code className="min-w-0 font-mono text-sm leading-5 break-all text-text-primary">/api{path}</code>
                    {op["x-scope"] ? <Pill tone={op["x-scope"] === "generate" ? "brand" : "neutral"}>{`${t.scope}: ${op["x-scope"]}`}</Pill> : null}
                  </div>
                  <h3 className="text-base leading-6 font-semibold text-text-primary">{op.summary}</h3>
                  {op.description ? <p className="text-sm leading-5 text-text-nav">{op.description}</p> : null}
                  {op.parameters?.length ? (
                    <div className="flex flex-col gap-1">
                      <span className="text-xs leading-4 font-medium text-text-secondary">{t.params}</span>
                      <dl className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-4 gap-y-1 text-xs leading-5">
                        {op.parameters.map((p) => (
                          <div key={`${p.in}-${p.name}`} className="contents">
                            <dt className="font-mono text-text-primary">
                              {p.name}
                              <span className="text-text-tertiary"> · {p.in}</span>
                            </dt>
                            <dd className="text-text-nav">{p.description ?? p.schema?.type ?? ""}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ) : null}
                  {op.requestBody ? (
                    <div className="flex flex-col gap-1">
                      <span className="text-xs leading-4 font-medium text-text-secondary">{t.body}</span>
                      <dl className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-4 gap-y-1 text-xs leading-5">
                        {Object.values(op.requestBody.content).flatMap(({ schema }) =>
                          Object.entries(schema.properties ?? {}).map(([k, v]) => (
                            <div key={k} className="contents">
                              <dt className="font-mono text-text-primary">
                                {k}
                                {schema.required?.includes(k) ? <span className="text-brand"> *</span> : null}
                              </dt>
                              <dd className="text-text-nav">{v.description ?? v.type ?? ""}</dd>
                            </div>
                          )),
                        )}
                      </dl>
                    </div>
                  ) : null}
                  <CodeBlock code={curl(server, path, method, op)} label={`${t.example}: curl`} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </Panel>
  );
}
