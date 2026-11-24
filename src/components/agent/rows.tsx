"use client";

import {
  AlertTriangle,
  Ban,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock,
  Download,
  ExternalLink,
  Info,
  Loader2,
  MessageCircleQuestion,
  Monitor,
  Plug,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { copy } from "@/content/agent";
import { api, errorMessage } from "@/lib/api";
import { Button, cn, Spinner } from "@/ui";
import type { ComputerStatus, FileRef, Row } from "./types";

type B = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" ? v : null);
const files = (v: unknown) => (Array.isArray(v) ? (v as FileRef[]) : []);

/** A member's or a generated file, drawn with its own address. */
function Media({ file, alt, large }: { file: FileRef; alt: string; large?: boolean }) {
  const box = cn("overflow-clip rounded-xl border border-border-subtle bg-surface-secondary", large ? "w-full" : "size-20");
  if (file.kind === "video") {
    return (
      <div className={box}>
        <video src={file.url} poster={file.posterUrl ?? undefined} controls={large} muted playsInline preload="metadata" className="size-full object-cover" aria-label={alt} />
      </div>
    );
  }
  if (file.kind === "audio") {
    return (
      <div className={cn("flex items-center rounded-xl border border-border-subtle bg-surface-secondary p-2", large ? "w-full" : "w-60")}>
        <audio src={file.url} controls preload="metadata" className="h-9 w-full" aria-label={alt} />
      </div>
    );
  }
  return (
    <div className={box}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={file.posterUrl ?? file.url} alt={alt} loading="lazy" className={cn("size-full object-cover", large && "h-auto")} />
    </div>
  );
}

function UserMessage({ body }: { body: B }) {
  const list = files(body.files);
  return (
    <div className="flex justify-end">
      <div className="flex max-w-[85%] flex-col items-end gap-2">
        {list.length ? (
          <div className="flex flex-wrap justify-end gap-2">
            {list.map((f) => (
              <Media key={f.id} file={f} alt="" />
            ))}
          </div>
        ) : null}
        {str(body.text) ? (
          <p className="rounded-2xl rounded-br-md bg-surface-secondary-strong px-4 py-[10px] text-sm leading-5 whitespace-pre-wrap text-text-primary [overflow-wrap:anywhere]">{str(body.text)}</p>
        ) : null}
      </div>
    </div>
  );
}

function AssistantMessage({ body }: { body: B }) {
  const streaming = body.streaming === true;
  return (
    <div className="flex gap-3">
      <span aria-hidden className="mt-[2px] flex size-6 shrink-0 items-center justify-center rounded-md bg-brand-tint text-brand">
        <Sparkles className="size-[14px]" strokeWidth={1.5} />
      </span>
      <p className="min-w-0 flex-1 pt-[2px] text-sm leading-6 whitespace-pre-wrap text-text-soft [overflow-wrap:anywhere]" aria-busy={streaming}>
        {str(body.text)}
        {streaming ? <span aria-hidden className="ml-[2px] inline-block h-4 w-[2px] translate-y-[3px] animate-pulse bg-brand" /> : null}
      </p>
    </div>
  );
}

function ToolIcon({ tool }: { tool: string }) {
  const c = "size-[14px]";
  if (tool.startsWith("computer_")) return <Monitor className={c} strokeWidth={1.5} aria-hidden />;
  if (tool.startsWith("app_") || tool === "connect_app") return <Plug className={c} strokeWidth={1.5} aria-hidden />;
  if (tool === "generate_media") return <Sparkles className={c} strokeWidth={1.5} aria-hidden />;
  return <Wrench className={c} strokeWidth={1.5} aria-hidden />;
}

/** One activity line. */
function ToolLine({ body }: { body: B }) {
  const status = str(body.status);
  const tool = str(body.tool);
  return (
    <li className="flex min-w-0 items-center gap-2 py-1 text-xs leading-4">
      <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-sm", status === "error" ? "text-danger" : "text-text-secondary")}>
        {status === "running" ? <Loader2 className="size-[14px] animate-spin text-brand" strokeWidth={1.5} aria-label={copy.chat.working} /> : status === "error" ? <CircleAlert className="size-[14px]" strokeWidth={1.5} aria-hidden /> : <ToolIcon tool={tool} />}
      </span>
      <span className={cn("min-w-0 flex-1 truncate", status === "error" ? "text-danger" : status === "running" ? "text-text-primary" : "text-text-nav")} title={str(body.summary) || tool}>
        {str(body.summary) || tool.replace(/_/g, " ")}
      </span>
      {status === "done" ? <Check className="size-[14px] shrink-0 text-text-tertiary" strokeWidth={1.5} aria-hidden /> : null}
    </li>
  );
}

/** A run of tool calls: the agent's plan as it works through it. Open while running. */
export function ToolGroup({ rows, computer }: { rows: Row[]; computer?: ComputerStatus | null }) {
  const running = rows.some((r) => r.body.status === "running");
  const [open, setOpen] = useState<boolean | null>(null);
  const shown = open ?? (running || rows.length <= 3);
  const usedComputer = rows.some((r) => str(r.body.tool).startsWith("computer_"));
  return (
    <div className="ml-9 rounded-xl border border-border-subtle bg-surface-sunken">
      <button
        type="button"
        aria-expanded={shown}
        onClick={() => setOpen(!shown)}
        className="flex h-9 w-full items-center gap-2 rounded-xl px-3 text-left text-xs leading-4 font-medium text-text-tab transition-colors duration-150 hover:text-text-primary"
      >
        {running ? <Spinner /> : <Wrench className="size-[14px]" strokeWidth={1.5} aria-hidden />}
        <span className="flex-1">
          {copy.rows.plan} · {copy.rows.steps(rows.length)}
        </span>
        <ChevronDown className={cn("size-4 transition-transform duration-150", !shown && "-rotate-90")} strokeWidth={1.5} aria-hidden />
      </button>
      {shown ? (
        <ol className="border-t border-border-subtle px-3 py-1">
          {rows.map((r) => (
            <ToolLine key={r.seq} body={r.body} />
          ))}
        </ol>
      ) : null}
      {usedComputer && computer?.screenshotUrl ? (
        <figure className="border-t border-border-subtle p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={computer.screenshotUrl} alt={copy.rows.screenshot} className="w-full max-w-[480px] rounded-lg border border-border-default bg-surface-secondary" />
          <figcaption className="mt-2 flex items-center gap-2 text-2xs leading-3 text-text-secondary">
            <Monitor className="size-3" strokeWidth={1.5} aria-hidden />
            {copy.rows.computer} · {computer.status}
          </figcaption>
        </figure>
      ) : null}
    </div>
  );
}

function CardFrame({ icon, title, children, tone = "default" }: { icon: ReactNode; title: string; children: ReactNode; tone?: "default" | "ask" | "error" }) {
  return (
    <section
      aria-label={title}
      className={cn(
        "ml-9 flex flex-col gap-3 rounded-2xl border bg-surface-secondary p-4",
        tone === "ask" ? "border-brand-chip" : tone === "error" ? "border-[#FF6B6B40]" : "border-border-subtle",
      )}
    >
      <header className="flex items-center gap-2 text-sm leading-5 font-medium text-text-primary">
        {icon}
        <span className="min-w-0 flex-1">{title}</span>
      </header>
      {children}
    </section>
  );
}

function StatusLine({ status, decision, answer }: { status: string; decision?: string; answer?: string }) {
  const label =
    status === "allowed" ? (decision === "always" ? copy.rows.always : copy.rows.allowed) : status === "denied" ? copy.rows.denied : status === "expired" ? copy.rows.expired : status === "answered" ? `${copy.rows.answered}: ${answer ?? ""}` : status;
  const Icon = status === "allowed" || status === "answered" ? CheckCircle2 : status === "denied" ? Ban : Clock;
  return (
    <p className={cn("flex items-center gap-2 text-xs leading-4 font-medium", status === "allowed" || status === "answered" ? "text-brand" : "text-text-secondary")}>
      <Icon className="size-[14px]" strokeWidth={1.5} aria-hidden />
      {label}
    </p>
  );
}

function useAnswer(approvalId: string) {
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const answer = async (body: Record<string, string>, key: string) => {
    setBusy(key);
    setProblem(null);
    try {
      await api(`/api/agent/approvals/${approvalId}`, { method: "POST", body });
    } catch (e) {
      setProblem(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };
  return { busy, problem, answer };
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-2xs leading-3 font-medium tracking-wide text-text-tertiary uppercase">{label}</dt>
      <dd className="min-w-0 text-sm leading-5 text-text-primary [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

function ApprovalCard({ body }: { body: B }) {
  const status = str(body.status);
  const choices = Array.isArray(body.choices) ? (body.choices as string[]) : ["allow", "deny"];
  const { busy, problem, answer } = useAnswer(str(body.approvalId));
  const tool = str(body.tool);
  const args = body.args && typeof body.args === "object" ? Object.entries(body.args as B) : [];
  const interval = num(body.intervalMinutes);
  const labels: Record<string, string> = { allow: copy.rows.allow, always: copy.rows.always, deny: copy.rows.deny };
  return (
    <CardFrame icon={<ShieldCheck className="size-4 text-brand" strokeWidth={1.5} aria-hidden />} title={str(body.title) || tool} tone={status === "pending" ? "ask" : "default"}>
      <dl className="grid gap-3 sm:grid-cols-[1fr_auto]">
        {tool === "generate_media" ? (
          <>
            <Field label={copy.rows.model}>{str(body.modelName) || str(body.modelId)}</Field>
            {str(body.priceLabel) ? <Field label={copy.rows.price}>{str(body.priceLabel)}</Field> : null}
            <div className="sm:col-span-2">
              <Field label={copy.schedules.prompt}>{str(body.prompt)}</Field>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-2 sm:col-span-2">
            {str(body.description) ? <p className="text-sm leading-5 text-text-nav">{str(body.description)}</p> : null}
            {str(body.prompt) ? <Field label={copy.schedules.prompt}>{str(body.prompt)}</Field> : null}
            {interval ? <Field label={copy.schedules.every}>{copy.rows.every(interval)}</Field> : null}
            {args.length ? (
              <dl className="grid gap-1 rounded-lg bg-surface-sunken p-3 font-mono text-xs leading-4">
                {args.map(([k, v]) => (
                  <div key={k} className="flex min-w-0 gap-2">
                    <dt className="shrink-0 text-text-secondary">{k}</dt>
                    <dd className="min-w-0 text-text-primary [overflow-wrap:anywhere]">{typeof v === "string" ? v : JSON.stringify(v)}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        )}
      </dl>
      {status === "pending" ? (
        <div className="flex flex-wrap gap-2">
          {choices.map((c) => (
            <Button key={c} variant={c === "allow" ? "lime" : c === "always" ? "soft" : "outline"} size="sm" disabled={!!busy} onClick={() => void answer({ decision: c }, c)}>
              {busy === c ? <Spinner /> : null}
              {labels[c] ?? c}
            </Button>
          ))}
        </div>
      ) : (
        <StatusLine status={status} decision={str(body.decision)} />
      )}
      {problem ? (
        <p role="alert" className="text-xs leading-4 text-danger">
          {problem}
        </p>
      ) : null}
    </CardFrame>
  );
}

function QuestionCard({ body }: { body: B }) {
  const status = str(body.status);
  const choices = Array.isArray(body.choices) ? (body.choices as string[]) : [];
  const { busy, problem, answer } = useAnswer(str(body.approvalId));
  const [text, setText] = useState("");
  return (
    <CardFrame icon={<MessageCircleQuestion className="size-4 text-brand" strokeWidth={1.5} aria-hidden />} title={str(body.question)} tone={status === "pending" ? "ask" : "default"}>
      {status === "pending" ? (
        <>
          {choices.length ? (
            <div className="flex flex-wrap gap-2">
              {choices.map((c) => (
                <Button key={c} variant="soft" size="sm" disabled={!!busy} onClick={() => void answer({ choice: c }, c)}>
                  {busy === c ? <Spinner /> : null}
                  {c}
                </Button>
              ))}
            </div>
          ) : null}
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim()) void answer({ choice: text.trim().slice(0, 500) }, "free");
            }}
          >
            <label className="sr-only" htmlFor={`answer-${str(body.approvalId)}`}>
              {copy.rows.answer}
            </label>
            <input
              id={`answer-${str(body.approvalId)}`}
              value={text}
              maxLength={500}
              onChange={(e) => setText(e.target.value)}
              placeholder={copy.rows.answer}
              className="h-8 min-w-0 flex-1 rounded-md border border-border-default bg-surface-field px-3 text-sm leading-5 text-text-primary outline-none placeholder:text-text-tertiary focus:border-border-strong"
            />
            <Button type="submit" variant="lime" size="sm" disabled={!text.trim() || !!busy}>
              {busy === "free" ? <Spinner /> : null}
              {copy.rows.sendAnswer}
            </Button>
          </form>
        </>
      ) : (
        <StatusLine status={status} answer={str(body.answer)} />
      )}
      {problem ? (
        <p role="alert" className="text-xs leading-4 text-danger">
          {problem}
        </p>
      ) : null}
    </CardFrame>
  );
}

function ResultCard({ body }: { body: B }) {
  const status = str(body.status);
  const list = files(body.files);
  const errors = Array.isArray(body.errors) ? (body.errors as unknown[]).map((e) => (typeof e === "string" ? e : str((e as B)?.message))).filter(Boolean) : [];
  const failed = status === "failed";
  return (
    <CardFrame
      icon={failed ? <AlertTriangle className="size-4 text-danger" strokeWidth={1.5} aria-hidden /> : status === "running" ? <Spinner /> : <Sparkles className="size-4 text-brand" strokeWidth={1.5} aria-hidden />}
      title={str(body.modelName) || str(body.modelId)}
      tone={failed ? "error" : "default"}
    >
      {str(body.prompt) ? <p className="line-clamp-2 text-xs leading-4 text-text-secondary">{str(body.prompt)}</p> : null}
      {status === "running" ? (
        <div className="shimmer aspect-video w-full max-w-[420px] rounded-xl bg-surface-tertiary" aria-label={copy.rows.resultRunning} />
      ) : null}
      {list.length ? (
        <ul className={cn("grid gap-2", list.length > 1 ? "grid-cols-2" : "grid-cols-1")} aria-label={str(body.prompt)}>
          {list.map((f) => (
            <li key={f.id} className="group relative max-w-[420px]">
              <Media file={f} alt={str(body.prompt)} large />
              <a
                href={`${f.url}?download=1`}
                aria-label={copy.rows.download}
                className="absolute top-2 right-2 flex size-8 items-center justify-center rounded-md bg-scrim text-text-primary opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
              >
                <Download className="size-4" strokeWidth={1.5} aria-hidden />
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      {failed || errors.length ? (
        <p role="alert" className="text-xs leading-4 text-danger">
          {str(body.message) || errors[0] || copy.rows.resultFailed}
        </p>
      ) : null}
    </CardFrame>
  );
}

function ConnectCard({ body }: { body: B }) {
  const app = str(body.app);
  const active = str(body.status) === "active";
  const [blocked, setBlocked] = useState(false);
  return (
    <CardFrame icon={<Plug className="size-4 text-brand" strokeWidth={1.5} aria-hidden />} title={copy.rows.connectApp(app)}>
      {str(body.reason) ? <p className="text-sm leading-5 text-text-nav">{str(body.reason)}</p> : null}
      {active ? (
        <StatusLine status="allowed" decision="" />
      ) : (
        <div className="flex items-center gap-2">
          <Button
            variant="lime"
            size="sm"
            onClick={() => {
              const w = window.open(str(body.url), "_blank", "popup,width=520,height=680");
              setBlocked(!w);
            }}
          >
            <ExternalLink className="size-4" strokeWidth={1.5} aria-hidden />
            {copy.rows.connect}
          </Button>
        </div>
      )}
      {blocked ? (
        <p role="alert" className="text-xs leading-4 text-danger">
          {copy.connectors.popupBlocked}
        </p>
      ) : null}
    </CardFrame>
  );
}

function Notice({ body }: { body: B }) {
  const level = str(body.level);
  const Icon = level === "error" ? CircleAlert : level === "warning" ? AlertTriangle : Info;
  return (
    <p
      role={level === "error" ? "alert" : undefined}
      className={cn(
        "ml-9 flex items-center gap-2 rounded-xl px-3 py-2 text-xs leading-4",
        level === "error" ? "bg-[#FF6B6B14] text-danger" : level === "warning" ? "bg-[#FF005B14] text-promo-soft" : "bg-border-subtle text-text-nav",
      )}
    >
      <Icon className="size-[14px] shrink-0" strokeWidth={1.5} aria-hidden />
      {str(body.text)}
    </p>
  );
}

/** One transcript row, drawn by its kind. Tool calls are grouped by the caller. */
export function RowView({ row }: { row: Row }) {
  const b = row.body;
  if (row.kind === "message") return b.role === "user" ? <UserMessage body={b} /> : <AssistantMessage body={b} />;
  if (row.kind === "card") {
    if (b.card === "approval") return <ApprovalCard body={b} />;
    if (b.card === "question") return <QuestionCard body={b} />;
    if (b.card === "result") return <ResultCard body={b} />;
    if (b.card === "connect") return <ConnectCard body={b} />;
    return null;
  }
  if (row.kind === "event") {
    return (
      <p className="flex items-center justify-center gap-2 text-xs leading-4 text-text-secondary">
        <Clock className="size-3" strokeWidth={1.5} aria-hidden />
        {str(b.text)}
      </p>
    );
  }
  if (row.kind === "notice") return <Notice body={b} />;
  return null;
}
