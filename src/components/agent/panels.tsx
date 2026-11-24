"use client";

import { Brain, CalendarClock, Folder, Plug, Plus, Search, Server, Trash2, Zap } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import useSWR from "swr";
import { routes } from "@/content/site";
import { copy, agentRoutes } from "@/content/agent";
import { api, errorMessage, fetcher } from "@/lib/api";
import { useNow } from "@/lib/browser";
import { useSession } from "@/lib/session";
import { Button, ButtonLink, cn, Spinner, Switch } from "@/ui";
import { keys, useConnectors, useProjects, useSkills } from "./data";
import { IconPlate } from "./icons";
import { AgentShell, } from "./shell";
import type { SideId } from "./sidebar";
import type { Chat, Memory, Project, Schedule, Skill } from "./types";

const input =
  "w-full rounded-lg border border-border-default bg-surface-field px-3 text-sm leading-5 text-text-primary outline-none placeholder:text-text-tertiary focus:border-border-strong";
const card = "rounded-2xl border border-border-subtle bg-surface-secondary";

function Page({ active, title, lead, icon, actions, children }: { active: SideId; title: string; lead: string; icon: ReactNode; actions?: ReactNode; children: ReactNode }) {
  const { user, loading } = useSession();
  return (
    <AgentShell active={active}>
      <div className="min-h-0 flex-1 overflow-y-auto scroll-quiet">
        <div className="mx-auto flex w-full max-w-[880px] flex-col gap-6 px-4 pt-20 pb-12">
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <IconPlate className="mt-1 size-8 rounded-lg">{icon}</IconPlate>
              <div className="min-w-0">
                <h1 className="font-display text-2xl leading-8 font-bold tracking-[-0.025em] text-text-primary uppercase">{title}</h1>
                <p className="mt-1 max-w-[560px] text-sm leading-5 text-text-secondary">{lead}</p>
              </div>
            </div>
            {user ? actions : null}
          </header>
          {loading ? <div className="shimmer h-40 rounded-2xl bg-surface-secondary" /> : user ? children : <SignedOut />}
        </div>
      </div>
    </AgentShell>
  );
}

function SignedOut() {
  return (
    <div className={cn(card, "flex flex-col items-start gap-3 p-6")}>
      <p className="text-base leading-6 font-semibold">{copy.signedOut.title}</p>
      <p className="text-sm leading-5 text-text-secondary">{copy.signedOut.body}</p>
      <div className="flex gap-2">
        <ButtonLink href={`${routes.join}?next=${encodeURIComponent(agentRoutes.home)}`} variant="lime" size="md">
          {copy.signedOut.cta}
        </ButtonLink>
        <ButtonLink href={agentRoutes.home} variant="outline" size="md">
          {copy.nav.newChat}
        </ButtonLink>
      </div>
    </div>
  );
}

function Problem({ text, onRetry }: { text: string | null; onRetry?: () => void }) {
  if (!text) return null;
  return (
    <p role="alert" className="flex items-center gap-3 text-sm leading-5 text-danger">
      {text}
      {onRetry ? (
        <Button size="sm" variant="outline" onClick={onRetry}>
          {copy.retry}
        </Button>
      ) : null}
    </p>
  );
}

function Empty({ text }: { text: string }) {
  return <p className={cn(card, "p-6 text-sm leading-5 text-text-secondary")}>{text}</p>;
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="shimmer h-16 rounded-2xl bg-surface-secondary" />
      ))}
    </div>
  );
}

/* --------------------------------- connectors --------------------------------- */

export function ConnectorsPanel() {
  const [q, setQ] = useState("");
  const term = q.trim();
  const all = useConnectors();
  const searched = useSWR<typeof all.data>(term ? `${keys.connectors}?search=${encodeURIComponent(term)}` : null, fetcher);
  const data = term ? searched.data : all.data;
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const reload = () => Promise.all([all.mutate(), term ? searched.mutate() : null]);

  const connect = async (slug: string) => {
    setBusy(slug);
    setProblem(null);
    // Open the window first, inside the click, so pop-up blockers allow it.
    const w = window.open("about:blank", "_blank", "popup,width=520,height=680");
    try {
      const res = await api<{ url: string }>(`/api/agent/connectors/apps/${slug}/connect`, { method: "POST" });
      if (w) w.location.href = res.url;
      else setProblem(copy.connectors.popupBlocked);
      await reload();
    } catch (e) {
      w?.close();
      setProblem(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async (slug: string) => {
    setBusy(slug);
    setProblem(null);
    try {
      await api(`/api/agent/connectors/apps/${slug}/disconnect`, { method: "POST" });
      await reload();
    } catch (e) {
      setProblem(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const groups = new Map<string, NonNullable<typeof data>["apps"]>();
  for (const app of data?.apps ?? []) groups.set(app.category, [...(groups.get(app.category) ?? []), app]);

  return (
    <Page active="connectors" title={copy.connectors.title} lead={copy.connectors.lead} icon={<Plug className="size-4" strokeWidth={1.5} />}>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-secondary" strokeWidth={1.5} aria-hidden />
        <label htmlFor="app-search" className="sr-only">
          {copy.connectors.search}
        </label>
        <input id="app-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={copy.connectors.search} className={cn(input, "h-10 pl-9")} />
      </div>
      <Problem text={problem} />
      {all.error && !data ? <Problem text={errorMessage(all.error)} onRetry={() => void all.mutate()} /> : null}
      {!data && !all.error ? <ListSkeleton /> : null}
      {data && !data.apps.length ? <Empty text={copy.connectors.empty} /> : null}
      {[...groups].map(([category, apps]) => (
        <section key={category} className="flex flex-col gap-2">
          <h2 className="text-xs leading-[18px] font-medium text-text-muted">{category}</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {apps.map((app) => (
              <li key={app.slug} className={cn(card, "flex items-center gap-3 p-4")}>
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-tertiary font-display text-base font-bold" aria-hidden>
                  {app.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={app.logoUrl} alt="" className="size-6 object-contain" />
                  ) : (
                    app.name.charAt(0)
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm leading-5 font-medium">
                    <span className="truncate">{app.name}</span>
                    {app.status === "active" ? <span className="rounded-full bg-brand-tint px-[6px] text-2xs leading-4 text-brand">{copy.connectors.connected}</span> : null}
                    {app.status === "pending" ? <span className="rounded-full bg-border-subtle px-[6px] text-2xs leading-4 text-text-secondary">{copy.connectors.pending}</span> : null}
                  </p>
                  <p className="truncate text-xs leading-4 text-text-secondary">{app.description}</p>
                </div>
                {app.status === "active" ? (
                  <Button variant="outline" size="sm" disabled={busy === app.slug} onClick={() => void disconnect(app.slug)} aria-label={`${copy.connectors.disconnect} ${app.name}`}>
                    {busy === app.slug ? <Spinner /> : null}
                    {copy.connectors.disconnect}
                  </Button>
                ) : (
                  <Button variant="lime" size="sm" disabled={busy === app.slug} onClick={() => void connect(app.slug)} aria-label={`${copy.connectors.connect} ${app.name}`}>
                    {busy === app.slug ? <Spinner /> : null}
                    {copy.connectors.connect}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
      <McpServers />
    </Page>
  );
}

function McpServers() {
  const { data, mutate } = useSWR<{ servers: { id: string; name: string; url: string }[] }>(keys.mcp, fetcher);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setProblem(null);
    try {
      await api(keys.mcp, { method: "POST", body: { name: name.trim(), url: url.trim() } });
      setName("");
      setUrl("");
      await mutate();
    } catch (err) {
      setProblem(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await api(`${keys.mcp}/${id}`, { method: "DELETE" });
      await mutate();
    } catch (err) {
      setProblem(errorMessage(err));
    }
  };

  return (
    <section className={cn(card, "flex flex-col gap-3 p-5")} aria-labelledby="mcp-title">
      <div className="flex items-center gap-2">
        <Server className="size-4 text-text-secondary" strokeWidth={1.5} aria-hidden />
        <h2 id="mcp-title" className="text-sm leading-5 font-medium">
          {copy.connectors.mcpTitle}
        </h2>
      </div>
      <p className="text-xs leading-4 text-text-secondary">{copy.connectors.mcpLead}</p>
      {data?.servers.length ? (
        <ul className="flex flex-col gap-1">
          {data.servers.map((s) => (
            <li key={s.id} className="flex items-center gap-3 rounded-lg bg-border-subtle px-3 py-2 text-sm leading-5">
              <span className="font-medium">{s.name}</span>
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-text-secondary">{s.url}</span>
              <button type="button" aria-label={`${copy.connectors.remove} ${s.name}`} onClick={() => void remove(s.id)} className="rounded-md p-1 text-text-secondary hover:bg-border-default hover:text-text-primary">
                <Trash2 className="size-4" strokeWidth={1.5} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : data ? (
        <p className="text-xs leading-4 text-text-tertiary">{copy.connectors.mcpEmpty}</p>
      ) : null}
      <form onSubmit={(e) => void add(e)} className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="mcp-name">
          {copy.connectors.mcpName}
        </label>
        <input id="mcp-name" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder={copy.connectors.mcpName} className={cn(input, "h-9 sm:w-40")} />
        <label className="sr-only" htmlFor="mcp-url">
          {copy.connectors.mcpUrl}
        </label>
        <input id="mcp-url" required type="url" maxLength={500} value={url} onChange={(e) => setUrl(e.target.value)} placeholder={copy.connectors.mcpUrl} className={cn(input, "h-9 min-w-0 flex-1")} />
        <Button type="submit" variant="soft" size="sm" className="h-9" disabled={busy}>
          {copy.connectors.mcpAdd}
        </Button>
      </form>
      <Problem text={problem} />
    </section>
  );
}

/* --------------------------------- projects --------------------------------- */

function ProjectRow({ project, onChange }: { project: Project; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(project.name);
  const [instructions, setInstructions] = useState(project.instructions);
  const [problem, setProblem] = useState<string | null>(null);
  const detail = useSWR<{ project: Project; chats: Chat[] }>(open ? `/api/agent/projects/${project.id}` : null, fetcher);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setProblem(null);
    try {
      await api(`/api/agent/projects/${project.id}`, { method: "PATCH", body: { name: name.trim(), instructions } });
      onChange();
    } catch (err) {
      setProblem(errorMessage(err));
    }
  };
  const remove = async () => {
    try {
      await api(`/api/agent/projects/${project.id}`, { method: "DELETE" });
      onChange();
    } catch (err) {
      setProblem(errorMessage(err));
    }
  };

  return (
    <li className={card}>
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 rounded-2xl p-4 text-left transition-colors duration-150 hover:bg-border-subtle">
        <Folder className="size-5 shrink-0 text-text-secondary" strokeWidth={1.5} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm leading-5 font-medium">{project.name}</span>
          <span className="block truncate text-xs leading-4 text-text-secondary">{project.instructions || "—"}</span>
        </span>
        <span className="shrink-0 text-xs leading-4 text-text-secondary">{copy.projects.chats(project.chatCount)}</span>
      </button>
      {open ? (
        <div className="flex flex-col gap-4 border-t border-border-subtle p-4">
          <form onSubmit={(e) => void save(e)} className="flex flex-col gap-2">
            <label className="text-xs leading-4 text-text-secondary" htmlFor={`pn-${project.id}`}>
              {copy.projects.name}
            </label>
            <input id={`pn-${project.id}`} required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} className={cn(input, "h-9")} />
            <label className="text-xs leading-4 text-text-secondary" htmlFor={`pi-${project.id}`}>
              {copy.projects.instructions}
            </label>
            <textarea id={`pi-${project.id}`} maxLength={8000} rows={3} value={instructions} onChange={(e) => setInstructions(e.target.value)} className={cn(input, "py-2")} />
            <div className="flex gap-2">
              <Button type="submit" variant="lime" size="sm">
                {copy.projects.save}
              </Button>
              <Button variant="outline" size="sm" onClick={() => void remove()}>
                {copy.projects.delete}
              </Button>
            </div>
          </form>
          <div className="flex flex-col gap-1">
            <p className="text-xs leading-4 font-medium text-text-muted">{copy.projects.open}</p>
            {detail.data?.chats.length ? (
              <ul className="flex flex-col">
                {detail.data.chats.map((c) => (
                  <li key={c.id}>
                    <Link href={`${agentRoutes.chat}/${c.id}`} className="flex h-8 items-center rounded-lg px-2 text-sm leading-5 text-text-nav hover:bg-border-subtle hover:text-text-primary">
                      <span className="truncate">{c.title || copy.nav.newChat}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : detail.data ? (
              <p className="text-xs leading-4 text-text-tertiary">{copy.projects.noChats}</p>
            ) : (
              <div className="shimmer h-8 rounded-lg bg-surface-tertiary" />
            )}
          </div>
          <Problem text={problem} />
        </div>
      ) : null}
    </li>
  );
}

export function ProjectsPanel() {
  const { data, error, mutate } = useProjects();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setProblem(null);
    try {
      await api(keys.projects, { method: "POST", body: { name: name.trim(), instructions } });
      setName("");
      setInstructions("");
      setCreating(false);
      await mutate();
    } catch (err) {
      setProblem(errorMessage(err));
    }
  };

  return (
    <Page
      active="projects"
      title={copy.projects.title}
      lead={copy.projects.lead}
      icon={<Folder className="size-4" strokeWidth={1.5} />}
      actions={
        <Button variant="lime" size="md" onClick={() => setCreating((c) => !c)} aria-expanded={creating}>
          <Plus className="size-4" strokeWidth={1.5} aria-hidden />
          {copy.projects.new}
        </Button>
      }
    >
      {creating ? (
        <form onSubmit={(e) => void create(e)} className={cn(card, "flex flex-col gap-2 p-4")}>
          <label className="text-xs leading-4 text-text-secondary" htmlFor="new-project-name">
            {copy.projects.name}
          </label>
          <input id="new-project-name" autoFocus required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} className={cn(input, "h-9")} />
          <label className="text-xs leading-4 text-text-secondary" htmlFor="new-project-instructions">
            {copy.projects.instructions}
          </label>
          <textarea id="new-project-instructions" rows={3} maxLength={8000} value={instructions} onChange={(e) => setInstructions(e.target.value)} className={cn(input, "py-2")} />
          <div>
            <Button type="submit" variant="lime" size="sm" disabled={!name.trim()}>
              {copy.projects.create}
            </Button>
          </div>
          <Problem text={problem} />
        </form>
      ) : null}
      {error ? <Problem text={errorMessage(error)} onRetry={() => void mutate()} /> : null}
      {!data && !error ? <ListSkeleton /> : null}
      {data && !data.projects.length && !creating ? <Empty text={copy.projects.empty} /> : null}
      {data?.projects.length ? (
        <ul className="flex flex-col gap-2">
          {data.projects.map((p) => (
            <ProjectRow key={`${p.id}-${p.updatedAt}`} project={p} onChange={() => void mutate()} />
          ))}
        </ul>
      ) : null}
    </Page>
  );
}

/* ---------------------------------- skills ---------------------------------- */

function SkillForm({ skill, onDone }: { skill?: Skill; onDone: () => void }) {
  const [name, setName] = useState(skill?.name ?? "");
  const [description, setDescription] = useState(skill?.description ?? "");
  const [instructions, setInstructions] = useState(skill?.instructions ?? "");
  const [problem, setProblem] = useState<string | null>(null);
  const idp = skill?.id ?? "new";
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setProblem(null);
    try {
      await api(skill ? `${keys.skills}/${skill.id}` : keys.skills, { method: skill ? "PATCH" : "POST", body: { name: name.trim(), description, instructions } });
      onDone();
    } catch (err) {
      setProblem(errorMessage(err));
    }
  };
  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-2">
      <label className="text-xs leading-4 text-text-secondary" htmlFor={`sn-${idp}`}>
        {copy.skills.name}
      </label>
      <input id={`sn-${idp}`} required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} className={cn(input, "h-9")} />
      <label className="text-xs leading-4 text-text-secondary" htmlFor={`sd-${idp}`}>
        {copy.skills.description}
      </label>
      <input id={`sd-${idp}`} maxLength={300} value={description} onChange={(e) => setDescription(e.target.value)} className={cn(input, "h-9")} />
      <label className="text-xs leading-4 text-text-secondary" htmlFor={`si-${idp}`}>
        {copy.skills.instructions}
      </label>
      <textarea id={`si-${idp}`} required rows={4} maxLength={8000} value={instructions} onChange={(e) => setInstructions(e.target.value)} className={cn(input, "py-2")} />
      <div>
        <Button type="submit" variant="lime" size="sm" disabled={!name.trim() || !instructions.trim()}>
          {skill ? copy.projects.save : copy.skills.create}
        </Button>
      </div>
      <Problem text={problem} />
    </form>
  );
}

export function SkillsPanel() {
  const { data, error, mutate } = useSkills();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const remove = async (id: string) => {
    try {
      await api(`${keys.skills}/${id}`, { method: "DELETE" });
      await mutate();
    } catch {}
  };
  return (
    <Page
      active="skills"
      title={copy.skills.title}
      lead={copy.skills.lead}
      icon={<Zap className="size-4" strokeWidth={1.5} />}
      actions={
        <Button variant="lime" size="md" onClick={() => setCreating((c) => !c)} aria-expanded={creating}>
          <Plus className="size-4" strokeWidth={1.5} aria-hidden />
          {copy.skills.new}
        </Button>
      }
    >
      {creating ? (
        <div className={cn(card, "p-4")}>
          <SkillForm
            onDone={() => {
              setCreating(false);
              void mutate();
            }}
          />
        </div>
      ) : null}
      {error ? <Problem text={errorMessage(error)} onRetry={() => void mutate()} /> : null}
      {!data && !error ? <ListSkeleton /> : null}
      <ul className="grid gap-2 sm:grid-cols-2">
        {(data?.skills ?? []).map((s) => (
          <li key={s.id} className={cn(card, "flex flex-col gap-2 p-4", editing === s.id && "sm:col-span-2")}>
            <div className="flex items-center gap-2">
              <Zap className="size-4 shrink-0 text-brand" strokeWidth={1.5} aria-hidden />
              <p className="min-w-0 flex-1 truncate text-sm leading-5 font-medium">{s.name}</p>
              <span className="shrink-0 rounded-full bg-border-subtle px-2 text-2xs leading-4 text-text-secondary">{s.builtIn ? copy.skills.builtIn : s.category}</span>
            </div>
            <p className="line-clamp-2 text-xs leading-4 text-text-secondary">{s.description || s.instructions}</p>
            {!s.builtIn ? (
              editing === s.id ? (
                <SkillForm
                  skill={s}
                  onDone={() => {
                    setEditing(null);
                    void mutate();
                  }}
                />
              ) : (
                <div className="flex gap-2">
                  <Button size="xs" variant="soft" className="font-medium" onClick={() => setEditing(s.id)}>
                    {copy.chat.rename}
                  </Button>
                  <Button size="xs" variant="ghost" className="font-medium" onClick={() => void remove(s.id)}>
                    {copy.skills.delete}
                  </Button>
                </div>
              )
            ) : null}
          </li>
        ))}
      </ul>
    </Page>
  );
}

/* --------------------------------- schedules --------------------------------- */

function when(ms: number | null, now: number | null) {
  if (!ms) return copy.schedules.never;
  if (!now) return "";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(ms));
}

export function SchedulesPanel() {
  const { data, error, mutate } = useSWR<{ schedules: Schedule[] }>(useSession().user ? keys.schedules : null, fetcher);
  const now = useNow();
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [interval, setInterval] = useState(1440);
  const [problem, setProblem] = useState<string | null>(null);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setProblem(null);
    try {
      await api(keys.schedules, { method: "POST", body: { title: title.trim(), prompt: prompt.trim(), intervalMinutes: interval } });
      setTitle("");
      setPrompt("");
      setCreating(false);
      await mutate();
    } catch (err) {
      setProblem(errorMessage(err));
    }
  };
  const patch = async (id: string, body: Record<string, unknown>) => {
    setProblem(null);
    try {
      await api(`${keys.schedules}/${id}`, { method: "PATCH", body });
      await mutate();
    } catch (err) {
      setProblem(errorMessage(err));
    }
  };
  const remove = async (id: string) => {
    try {
      await api(`${keys.schedules}/${id}`, { method: "DELETE" });
      await mutate();
    } catch (err) {
      setProblem(errorMessage(err));
    }
  };

  return (
    <Page
      active="schedules"
      title={copy.schedules.title}
      lead={copy.schedules.lead}
      icon={<CalendarClock className="size-4" strokeWidth={1.5} />}
      actions={
        <Button variant="lime" size="md" onClick={() => setCreating((c) => !c)} aria-expanded={creating}>
          <Plus className="size-4" strokeWidth={1.5} aria-hidden />
          {copy.schedules.new}
        </Button>
      }
    >
      {creating ? (
        <form onSubmit={(e) => void create(e)} className={cn(card, "flex flex-col gap-2 p-4")}>
          <label className="text-xs leading-4 text-text-secondary" htmlFor="sch-title">
            {copy.schedules.name}
          </label>
          <input id="sch-title" autoFocus required maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} className={cn(input, "h-9")} />
          <label className="text-xs leading-4 text-text-secondary" htmlFor="sch-prompt">
            {copy.schedules.prompt}
          </label>
          <textarea id="sch-prompt" required rows={3} maxLength={4000} value={prompt} onChange={(e) => setPrompt(e.target.value)} className={cn(input, "py-2")} />
          <fieldset className="flex flex-wrap items-center gap-2">
            <legend className="mb-1 text-xs leading-4 text-text-secondary">{copy.schedules.every}</legend>
            {copy.schedules.intervals.map((o) => (
              <button
                key={o.minutes}
                type="button"
                aria-pressed={interval === o.minutes}
                onClick={() => setInterval(o.minutes)}
                className={cn("h-8 rounded-md px-3 text-xs leading-4 font-medium transition-colors duration-150", interval === o.minutes ? "bg-brand-tint text-brand" : "bg-border-subtle text-text-tab hover:text-text-primary")}
              >
                {o.label}
              </button>
            ))}
          </fieldset>
          <div>
            <Button type="submit" variant="lime" size="sm" disabled={!title.trim() || !prompt.trim()}>
              {copy.schedules.create}
            </Button>
          </div>
        </form>
      ) : null}
      <Problem text={problem} />
      {error ? <Problem text={errorMessage(error)} onRetry={() => void mutate()} /> : null}
      {!data && !error ? <ListSkeleton /> : null}
      {data && !data.schedules.length && !creating ? <Empty text={copy.schedules.empty} /> : null}
      <ul className="flex flex-col gap-2">
        {(data?.schedules ?? []).map((s) => (
          <li key={s.id} className={cn(card, "flex flex-col gap-3 p-4 sm:flex-row sm:items-center")}>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-sm leading-5 font-medium">
                <span className="truncate">{s.title}</span>
                <span className="shrink-0 text-xs font-normal text-text-secondary">{copy.rows.every(s.intervalMinutes)}</span>
              </p>
              <p className="truncate text-xs leading-4 text-text-secondary">{s.prompt}</p>
              <p className="mt-1 text-2xs leading-3 text-text-tertiary">
                {s.enabled ? `${copy.schedules.next}: ${when(s.nextRunAt, now)}` : copy.schedules.paused} · {copy.schedules.last}: {when(s.lastRunAt, now)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Switch checked={s.enabled} onCheckedChange={(on: boolean) => void patch(s.id, { enabled: on })} aria-label={s.enabled ? copy.schedules.pause : copy.schedules.resume} />
              <Button size="sm" variant="soft" onClick={() => void patch(s.id, { runNow: true })}>
                {copy.schedules.runNow}
              </Button>
              {s.chatId ? (
                <ButtonLink size="sm" variant="outline" href={`${agentRoutes.chat}/${s.chatId}`}>
                  {copy.schedules.openChat}
                </ButtonLink>
              ) : null}
              <button type="button" aria-label={`${copy.schedules.delete} ${s.title}`} onClick={() => void remove(s.id)} className="rounded-md p-2 text-text-secondary hover:bg-border-subtle hover:text-text-primary">
                <Trash2 className="size-4" strokeWidth={1.5} aria-hidden />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </Page>
  );
}

/* ---------------------------------- memory ---------------------------------- */

export function MemoryPanel() {
  const { data, error, mutate } = useSWR<{ memories: Memory[] }>(useSession().user ? keys.memory : null, fetcher);
  const forget = async (id: string) => {
    try {
      await api(`${keys.memory}/${id}`, { method: "DELETE" });
      await mutate();
    } catch {}
  };
  return (
    <Page active="memory" title={copy.memory.title} lead={copy.memory.lead} icon={<Brain className="size-4" strokeWidth={1.5} />}>
      {error ? <Problem text={errorMessage(error)} onRetry={() => void mutate()} /> : null}
      {!data && !error ? <ListSkeleton /> : null}
      {data && !data.memories.length ? <Empty text={copy.memory.empty} /> : null}
      <ul className="flex flex-col gap-2">
        {(data?.memories ?? []).map((m) => (
          <li key={m.id} className={cn(card, "flex items-center gap-3 p-4")}>
            <p className="min-w-0 flex-1 text-sm leading-5">{m.text}</p>
            <Button size="sm" variant="outline" onClick={() => void forget(m.id)}>
              {copy.memory.forget}
            </Button>
          </li>
        ))}
      </ul>
    </Page>
  );
}
