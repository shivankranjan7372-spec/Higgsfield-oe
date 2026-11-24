"use client";

import { ChevronLeft, CircleAlert, Download, Lock, Play, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { LoginDialog } from "@/components/entry/login-dialog";
import { appCopy, appsCopy } from "@/content/apps";
import { routes } from "@/content/site";
import { formatCredits } from "@/config/economy";
import { api, ApiError, errorMessage, fetcher, type Asset, type Job } from "@/lib/api";
import { useNow } from "@/lib/browser";
import { refreshSession, setBalance, useSession } from "@/lib/session";
import { isActive } from "@/lib/studio";
import { Artwork, ButtonLink, Spinner, Tag, cn } from "@/ui";
import { ControlInput, FieldInput, InputTile, Row, Thumb, panel } from "./form-parts";
import type { AppDetail, AppRun, FieldValue, Price } from "./types";

type Values = Record<string, FieldValue>;

function defaultsOf(app: AppDetail) {
  const fields: Values = {};
  for (const f of app.form.fields) fields[f.id] = f.default;
  const values: Values = {};
  for (const c of app.form.controls) values[c.id] = c.default;
  return { fields, values };
}

export function AppRunnerSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-8 px-4 pt-10 pb-20" aria-busy>
      <div className="shimmer h-5 w-24 rounded-md bg-surface-secondary" />
      <div className="flex items-center gap-4">
        <div className="shimmer size-16 rounded-xl bg-surface-secondary" />
        <div className="flex flex-1 flex-col gap-2">
          <div className="shimmer h-8 w-64 max-w-full rounded-md bg-surface-secondary" />
          <div className="shimmer h-5 w-96 max-w-full rounded-md bg-surface-secondary" />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[400px_minmax(0,1fr)]">
        <div className="shimmer h-[480px] rounded-2xl bg-[#131517]" />
        <div className="shimmer h-[360px] rounded-2xl bg-[#131517]" />
      </div>
    </div>
  );
}

/* ───────────────────────── results ───────────────────────── */

const tile = "group relative aspect-square overflow-clip rounded-xl bg-surface-secondary";
const overlayButton =
  "flex size-7 items-center justify-center rounded-md bg-[#00000080] text-text-primary backdrop-blur-sm transition-colors duration-150 hover:bg-[#000000B3]";

function Done({ job, asset }: { job: Job; asset: Asset }) {
  return (
    <li className={tile} data-state="done">
      {asset.kind === "video" ? (
        <video src={asset.url} poster={asset.posterUrl ?? undefined} controls playsInline className="size-full object-cover" />
      ) : asset.kind === "audio" ? (
        <div className="flex size-full flex-col items-center justify-center gap-3 p-4">
          <p className="text-xs leading-4 text-text-secondary">{job.modelName}</p>
          <audio src={asset.url} controls className="w-full" />
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={asset.posterUrl ?? asset.url} alt={`Made with ${job.modelName}`} loading="lazy" className="size-full object-cover" />
      )}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-end p-2 opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
        <a href={`${asset.url}?download=1`} download aria-label={appCopy.download} title={appCopy.download} className={cn(overlayButton, "pointer-events-auto")}>
          <Download className="size-4" strokeWidth={1.5} aria-hidden />
        </a>
      </div>
    </li>
  );
}

function Pending({ job }: { job: Job }) {
  const now = useNow();
  const running = job.status === "running" && job.startedAt !== null;
  const share = running && now !== null && job.eta > 0 ? Math.min(0.95, Math.max(0.02, (now - job.startedAt! / 1000) / job.eta)) : 0;
  return (
    <>
      {Array.from({ length: Math.max(1, job.count) }, (_, i) => (
        <li key={`${job.id}:${i}`} className={cn(tile, "shimmer")} data-state="pending">
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center">
            <Spinner className="text-text-tab" label={running ? appCopy.making : appCopy.inLine} />
            <p className="text-sm leading-5 text-text-primary">{running ? appCopy.making : appCopy.inLine}</p>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-[2px] bg-border-subtle">
            <div className="h-full bg-brand transition-[width] duration-1000 ease-linear" style={{ width: `${share * 100}%` }} />
          </div>
        </li>
      ))}
    </>
  );
}

function Failed({ job, onRetry }: { job: Job; onRetry?: () => void }) {
  return (
    <li className={tile} data-state="failed">
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
        <CircleAlert className="size-5 text-danger" strokeWidth={1.5} aria-hidden />
        <p className="line-clamp-3 text-sm leading-5 text-text-primary">{job.error?.message ?? appCopy.failed}</p>
        <p className="text-xs leading-4 text-text-secondary">{appCopy.refunded}</p>
        {onRetry ? (
          <button type="button" onClick={onRetry} className="mt-1 flex h-8 items-center gap-1 rounded-md bg-border-subtle px-3 text-sm leading-4 font-medium text-text-primary transition-colors duration-150 hover:bg-border-default">
            <RotateCcw className="size-4" strokeWidth={1.5} aria-hidden />
            {appCopy.retry}
          </button>
        ) : null}
      </div>
    </li>
  );
}

function RunTiles({ run, onRetry }: { run: AppRun; onRetry?: () => void }) {
  return (
    <>
      {run.jobs.map((job) =>
        isActive(job) ? (
          <Pending key={job.id} job={job} />
        ) : job.status === "failed" ? (
          <Failed key={job.id} job={job} onRetry={onRetry} />
        ) : (
          job.assets.map((a) => <Done key={a.id} job={job} asset={a} />)
        ),
      )}
    </>
  );
}

function When({ at }: { at: number }) {
  const now = useNow();
  if (now === null) return null;
  const mins = Math.round((now * 1000 - at) / 60000);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const text = mins < 60 ? rtf.format(-mins, "minute") : mins < 60 * 24 ? rtf.format(-Math.round(mins / 60), "hour") : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(at);
  return <time dateTime={new Date(at).toISOString()}>{text}</time>;
}

/* ───────────────────────── the page ───────────────────────── */

export function AppRunner({ id }: { id: string }) {
  const { user, loading: sessionLoading } = useSession();
  const { data, error, isLoading, mutate: reloadApp } = useSWR<{ app: AppDetail }>(`/api/apps/${encodeURIComponent(id)}`, fetcher);
  const app = data?.app;

  const [fields, setFields] = useState<Values>({});
  const [values, setValues] = useState<Values>({});
  const [files, setFiles] = useState<Record<string, Asset[]>>({});
  const [count, setCount] = useState(1);
  const [price, setPrice] = useState<Price | null>(null);
  const [priceProblem, setPriceProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<{ message: string; member?: boolean } | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const formTop = useRef<HTMLDivElement>(null);

  // Fill the form with the app's own defaults once it arrives.
  const loadedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!app || loadedFor.current === app.id) return;
    loadedFor.current = app.id;
    const d = defaultsOf(app);
    setFields(d.fields);
    setValues(d.values);
    setFiles({});
    setCount(1);
    setPrice(app.price);
  }, [app]);

  const available = app?.status === "available";

  // The live price: asked again shortly after each change.
  const priceBody = useMemo(
    () => JSON.stringify({ fields, values, inputs: Object.fromEntries(Object.entries(files).map(([k, v]) => [k, v.length])), count }),
    [fields, values, files, count],
  );
  useEffect(() => {
    if (!app || !available || loadedFor.current !== app.id) return;
    let live = true;
    const t = window.setTimeout(async () => {
      try {
        const r = await api<{ price: Price }>(`/api/apps/${app.id}/price`, { method: "POST", body: JSON.parse(priceBody) });
        if (live) {
          setPrice(r.price);
          setPriceProblem(null);
        }
      } catch (e) {
        if (live) setPriceProblem(errorMessage(e));
      }
    }, 250);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [app, available, priceBody]);

  // The member's runs of this app, polled while anything is still being made.
  const runs = useSWR<{ runs: AppRun[] }>(user && app ? `/api/apps/${app.id}/runs?limit=12` : null, fetcher);
  const list = runs.data?.runs ?? [];
  const working = list.some((r) => r.jobs.some(isActive));
  const { mutate: reloadRuns } = runs;
  useEffect(() => {
    if (!working) return;
    const t = window.setInterval(() => void reloadRuns(), 1500);
    return () => window.clearInterval(t);
  }, [working, reloadRuns]);
  const wasWorking = useRef(false);
  useEffect(() => {
    if (wasWorking.current && !working) void refreshSession();
    wasWorking.current = working;
  }, [working]);

  const needSession = useCallback(() => {
    if (user) return true;
    setLoginOpen(true);
    return false;
  }, [user]);

  async function start(body: { fields: Values; values: Values; inputs: Record<string, string[]>; count: number }) {
    if (!app || !needSession()) return;
    setProblem(null);
    setBusy(true);
    try {
      const r = await api<{ run: AppRun; balance: number }>(`/api/apps/${app.id}/run`, { method: "POST", body });
      void setBalance(r.balance);
      await reloadRuns((d) => ({ runs: [r.run, ...(d?.runs ?? [])] }), { revalidate: true });
    } catch (e) {
      const member = e instanceof ApiError && (e.status === 401 || e.status === 403) && e.code !== "forbidden";
      setProblem({ message: errorMessage(e), member });
    } finally {
      setBusy(false);
    }
  }

  function runNow() {
    void start({ fields, values, inputs: Object.fromEntries(Object.entries(files).map(([k, v]) => [k, v.map((a) => a.id)])), count });
  }

  async function refill(run: AppRun) {
    if (!app) return;
    const d = defaultsOf(app);
    setFields({ ...d.fields, ...run.fields });
    setValues({ ...d.values, ...run.values });
    setCount(Math.min(app.form.maxCount, Math.max(1, run.jobs.reduce((n, j) => n + j.count, 0) || 1)));
    formTop.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    const next: Record<string, Asset[]> = {};
    await Promise.all(
      Object.entries(run.inputs).map(async ([k, ids]) => {
        const found = await Promise.all(ids.map((a) => api<{ asset: Asset }>(`/api/assets/${a}`).then((r) => r.asset).catch(() => null)));
        next[k] = found.filter((a): a is Asset => a !== null);
      }),
    );
    setFiles(next);
  }

  if (isLoading && !app) return <AppRunnerSkeleton />;
  if (!app) {
    const missing = error instanceof ApiError && error.status === 404;
    return (
      <div className="mx-auto flex w-full max-w-[1280px] flex-col items-start gap-4 px-4 pt-10 pb-20">
        <Link href={routes.apps} className="flex items-center gap-1 text-sm leading-5 font-medium text-[#FFFFFF99] transition-colors duration-150 hover:text-text-primary">
          <ChevronLeft className="size-4" strokeWidth={1.5} aria-hidden />
          {appCopy.back}
        </Link>
        <div role="alert" className={cn(panel, "flex w-full flex-col items-start gap-3 p-6")}>
          <p className="text-sm leading-5 text-text-primary">{missing ? appCopy.notFound : errorMessage(error)}</p>
          {missing ? (
            <ButtonLink href={routes.apps} variant="outline" size="sm">
              {appCopy.back}
            </ButtonLink>
          ) : (
            <button type="button" onClick={() => void reloadApp()} className="h-8 rounded-md border border-border-default px-3 text-sm font-medium text-text-primary hover:bg-border-subtle">
              {appsCopy.retry}
            </button>
          )}
        </div>
      </div>
    );
  }

  const missingInputs = app.form.inputs.filter((i) => (files[i.id]?.length ?? 0) < i.min);
  const latest = list[0];
  const earlier = list.slice(1);
  const signedOut = !sessionLoading && !user;
  const runLabel = !available ? appCopy.unavailable : signedOut ? appCopy.signInToRun : busy ? appCopy.running : appCopy.run;

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-8 px-4 pt-10 pb-20">
      <Link href={routes.apps} className="flex w-fit items-center gap-1 rounded-md text-sm leading-5 font-medium text-[#FFFFFF99] transition-colors duration-150 hover:text-text-primary">
        <ChevronLeft className="size-4" strokeWidth={1.5} aria-hidden />
        {appCopy.back}
      </Link>

      <header className="flex items-start gap-4">
        <Artwork name={`apps/${app.id}`} className={cn("size-16 shrink-0 overflow-clip rounded-xl", !available && "opacity-50")} />
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl leading-8 font-bold tracking-[-0.02em] text-text-primary uppercase sm:text-3xl sm:leading-[36px]">{app.name}</h1>
            {!available ? <Tag tone="neutral">{appsCopy.soon}</Tag> : app.badge ? <Tag tone="solid">{appsCopy.badge[app.badge]}</Tag> : null}
          </div>
          <p className="text-sm leading-5 text-[#FFFFFF99]">{app.pitch}</p>
          <p className="text-xs leading-4 text-text-tertiary">
            {[app.categoryLabel, appCopy.makes[app.result], app.modelName ? appCopy.madeWith(app.modelName) : null].filter(Boolean).join(" · ")}
          </p>
        </div>
      </header>

      {!available ? (
        <div role="status" className={cn(panel, "flex items-start gap-3 p-4")}>
          <Lock className="mt-[2px] size-4 shrink-0 text-text-secondary" strokeWidth={1.5} aria-hidden />
          <div className="flex flex-col gap-1">
            <p className="text-sm leading-5 font-medium text-text-primary">{appCopy.unavailable}</p>
            <p className="text-sm leading-5 text-text-secondary">{app.note ?? appCopy.unavailableBody}</p>
          </div>
        </div>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[400px_minmax(0,1fr)]">
        <div ref={formTop} className="scroll-mt-20">
          <form
            aria-label={app.name}
            onSubmit={(e) => {
              e.preventDefault();
              runNow();
            }}
            className={cn(panel, "flex flex-col gap-5 p-4")}
          >
            <fieldset disabled={!available} className={cn("flex min-w-0 flex-col gap-5", !available && "opacity-50")}>
              {app.form.inputs.map((input) => (
                <InputTile key={input.id} input={input} files={files[input.id] ?? []} onChange={(next) => setFiles((f) => ({ ...f, [input.id]: next }))} needSession={needSession} />
              ))}
              {app.form.fields.map((field) => (
                <FieldInput key={field.id} field={field} value={fields[field.id]} onChange={(v) => setFields((f) => ({ ...f, [field.id]: v }))} />
              ))}
              {app.form.controls.map((control) => (
                <ControlInput key={control.id} control={control} value={values[control.id]} onChange={(v) => setValues((f) => ({ ...f, [control.id]: v }))} />
              ))}
              {app.form.maxCount > 1 ? (
                <Row label={appCopy.count}>
                  <div role="radiogroup" aria-label={appCopy.count} className="flex gap-2">
                    {Array.from({ length: app.form.maxCount }, (_, i) => i + 1).map((n) => (
                      <button
                        key={n}
                        type="button"
                        role="radio"
                        aria-checked={count === n}
                        onClick={() => setCount(n)}
                        className={cn(
                          "flex h-9 w-11 items-center justify-center rounded-lg text-sm leading-5 font-medium transition-colors duration-150",
                          count === n ? "bg-[#2E3031] text-text-soft" : "bg-[#FFFFFF0A] text-[#FFFFFF99] hover:bg-border-default hover:text-text-primary",
                        )}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </Row>
              ) : null}
            </fieldset>

            {problem ? (
              <div role="alert" className="flex flex-col items-start gap-2 rounded-xl bg-[#FF6B6B14] p-3">
                <p className="text-sm leading-5 text-danger">{problem.message}</p>
                {problem.member ? (
                  <ButtonLink href={`${routes.join}?next=${encodeURIComponent(`${routes.apps}/${app.id}`)}`} variant="lime" size="sm">
                    {appCopy.createAccount}
                  </ButtonLink>
                ) : null}
              </div>
            ) : null}
            {priceProblem && available ? <p className="text-xs leading-4 text-text-secondary">{priceProblem}</p> : null}

            <button
              type={signedOut ? "button" : "submit"}
              onClick={signedOut ? () => setLoginOpen(true) : undefined}
              disabled={!available || busy || (!signedOut && missingInputs.length > 0)}
              title={missingInputs.length > 0 ? `Add ${missingInputs.map((i) => i.label).join(", ")} first.` : undefined}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-text-primary text-sm leading-5 font-semibold text-[#131517] shadow-[#E6E6E6_0px_1px_0px_inset,#C1C1C1_0px_-2px_0px_inset,#C1C1C1_0px_-3px_0px] transition-colors duration-150 hover:bg-text-soft disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? <Spinner label={appCopy.running} /> : <Play className="size-3 fill-current" strokeWidth={1.5} aria-hidden />}
              {runLabel}
              {available && price ? <span className="font-mono text-xs leading-4 text-[#131517B3]">· {formatCredits(price.millicredits)} {appCopy.credits}</span> : null}
            </button>
            {signedOut && available ? <p className="text-xs leading-4 text-text-secondary">{appCopy.signInBody}</p> : null}
            {!signedOut && missingInputs.length > 0 && available ? (
              <p className="text-xs leading-4 text-text-secondary">Add {missingInputs.map((i) => i.label).join(", ")} to run.</p>
            ) : null}
          </form>
        </div>

        <div className="flex min-w-0 flex-col gap-8">
          <section aria-label={appCopy.result} className="flex flex-col gap-4">
            <h2 className="font-display text-xl leading-7 font-bold tracking-[-0.02em] text-text-primary uppercase">{appCopy.result}</h2>
            {runs.isLoading && !runs.data ? (
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                <div className="shimmer aspect-square rounded-xl bg-surface-secondary" />
              </div>
            ) : latest ? (
              <div className="flex flex-col gap-3">
                <ul aria-label="Latest results" className="grid grid-cols-2 gap-2 md:grid-cols-3">
                  <RunTiles run={latest} onRetry={available ? () => void start({ fields: latest.fields, values: latest.values, inputs: latest.inputs, count: Math.max(1, latest.jobs.reduce((n, j) => n + j.count, 0)) }) : undefined} />
                </ul>
                <div className="flex items-center gap-3 text-xs leading-4 text-text-tertiary">
                  <When at={latest.createdAt} />
                  <button type="button" onClick={() => void refill(latest)} className="rounded-md px-2 py-1 font-medium text-[#FFFFFF99] transition-colors duration-150 hover:bg-border-subtle hover:text-text-primary">
                    {appCopy.useInputs}
                  </button>
                </div>
              </div>
            ) : (
              <div className={cn(panel, "flex aspect-[16/7] min-h-[160px] items-center justify-center p-6 text-center")}>
                <p className="max-w-[320px] text-sm leading-5 text-text-secondary">{appCopy.resultEmpty}</p>
              </div>
            )}
          </section>

          {user ? (
            <section aria-label={appCopy.history} className="flex flex-col gap-4">
              <h2 className="font-display text-xl leading-7 font-bold tracking-[-0.02em] text-text-primary uppercase">{appCopy.history}</h2>
              {runs.error ? (
                <p role="alert" className="text-sm leading-5 text-danger">
                  {errorMessage(runs.error)}
                </p>
              ) : earlier.length === 0 ? (
                <p className="text-sm leading-5 text-text-secondary">{appCopy.historyEmpty}</p>
              ) : (
                <ul aria-label={appCopy.history} className="flex flex-col gap-2">
                  {earlier.map((run) => (
                    <li key={run.id} className={cn(panel, "flex flex-wrap items-center gap-3 p-3")} data-run={run.id}>
                      <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                        {run.jobs.flatMap((j) =>
                          j.status === "succeeded"
                            ? j.assets.map((a) => (
                                <a key={a.id} href={`${a.url}?download=1`} download aria-label={appCopy.download} title={appCopy.download} className="group relative size-14 overflow-clip rounded-lg">
                                  <Thumb asset={a} className="size-full" />
                                  <span className="absolute inset-0 flex items-center justify-center bg-[#00000080] opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
                                    <Download className="size-4 text-text-primary" strokeWidth={1.5} aria-hidden />
                                  </span>
                                </a>
                              ))
                            : [
                                <span key={j.id} className={cn("flex size-14 items-center justify-center rounded-lg bg-surface-secondary", isActive(j) && "shimmer")} title={j.error?.message}>
                                  {isActive(j) ? <Spinner className="text-text-tab" label={appCopy.making} /> : <CircleAlert className="size-4 text-danger" strokeWidth={1.5} aria-label={appCopy.failed} />}
                                </span>,
                              ],
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2 text-xs leading-4 text-text-tertiary">
                        <When at={run.createdAt} />
                        <button type="button" onClick={() => void refill(run)} className="rounded-md px-2 py-1 font-medium text-[#FFFFFF99] transition-colors duration-150 hover:bg-border-subtle hover:text-text-primary">
                          {appCopy.useInputs}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}
        </div>
      </div>
      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} mode="join" next={`${routes.apps}/${app.id}`} />
    </div>
  );
}
