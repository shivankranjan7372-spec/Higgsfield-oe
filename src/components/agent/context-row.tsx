"use client";

import { Blocks, Check, Folder, FolderX, Unplug, Zap } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { routes } from "@/content/site";
import { copy, agentRoutes } from "@/content/agent";
import { useSession } from "@/lib/session";
import { cn, Popover, PopoverContent, PopoverTrigger } from "@/ui";
import { useConnectors, useProjects, useSkills } from "./data";

const item =
  "flex h-6 shrink-0 items-center whitespace-nowrap gap-[6px] rounded-full px-1 text-xs leading-4 font-medium text-text-primary transition-colors duration-150 hover:bg-border-subtle data-[state=open]:bg-border-subtle";

const row =
  "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm leading-5 font-medium text-text-primary transition-colors duration-150 hover:bg-border-subtle";

/**
 * The row under the composer: which project the chat belongs to, which skills it uses,
 * which apps are connected, and the MCP link. The owner decides what a change does.
 */
export function ContextRow({
  projectId,
  onProject,
  skillIds,
  onSkills,
}: {
  projectId: string | null;
  onProject: (id: string | null) => void;
  skillIds: string[];
  onSkills: (ids: string[]) => void;
}) {
  const { user } = useSession();
  const { data: projects } = useProjects();
  const { data: skills } = useSkills();
  const { data: connectors } = useConnectors();
  const [open, setOpen] = useState<null | "project" | "skills" | "apps">(null);
  const project = projects?.projects.find((p) => p.id === projectId);
  const connected = (connectors?.apps ?? []).filter((a) => a.status === "active");
  const toggle = (which: "project" | "skills" | "apps") => (o: boolean) => setOpen(o ? which : null);

  return (
    <div className="flex h-11 w-full items-center justify-center rounded-4xl">
      <div className="flex h-10 w-full items-center justify-between gap-2 px-3">
        <div className="flex min-w-0 items-center gap-3 overflow-x-auto scroll-none sm:gap-4">
          <Popover open={open === "project"} onOpenChange={toggle("project")}>
            <PopoverTrigger asChild>
              <button type="button" className={item} aria-label={`${copy.context.project}: ${project?.name ?? copy.context.noProject}`}>
                {project ? <Folder className="size-4 shrink-0" strokeWidth={1.5} aria-hidden /> : <FolderX className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />}
                <span className="max-w-[140px] truncate leading-6">{project?.name ?? copy.context.noProject}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-[260px]">
              <div className="flex h-8 items-center px-2 text-xs leading-4 font-medium text-text-tab">{copy.context.pickProject}</div>
              <button type="button" role="menuitemradio" aria-checked={!projectId} className={cn(row, !projectId && "bg-border-subtle")} onClick={() => (onProject(null), setOpen(null))}>
                <FolderX className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
                <span className="flex-1">{copy.context.noProject}</span>
                {!projectId ? <Check className="size-4" strokeWidth={1.5} aria-hidden /> : null}
              </button>
              {(projects?.projects ?? []).map((p) => (
                <button key={p.id} type="button" role="menuitemradio" aria-checked={p.id === projectId} className={cn(row, p.id === projectId && "bg-border-subtle")} onClick={() => (onProject(p.id), setOpen(null))}>
                  <Folder className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  {p.id === projectId ? <Check className="size-4" strokeWidth={1.5} aria-hidden /> : null}
                </button>
              ))}
              {user && projects && !projects.projects.length ? <p className="px-2 py-1 text-xs leading-4 text-text-secondary">{copy.context.noProjects}</p> : null}
              <Link href={agentRoutes.projects} className="mt-1 flex h-8 items-center rounded-md px-2 text-xs leading-4 font-medium text-brand hover:bg-border-subtle">
                {copy.context.manageProjects}
              </Link>
            </PopoverContent>
          </Popover>

          <Popover open={open === "skills"} onOpenChange={toggle("skills")}>
            <PopoverTrigger asChild>
              <button type="button" className={item} aria-label={`${copy.context.skills}${skillIds.length ? `: ${skillIds.length}` : ""}`}>
                <Zap className={cn("size-4 shrink-0", skillIds.length && "text-brand")} strokeWidth={1.5} aria-hidden />
                {copy.context.skills}
                {skillIds.length ? <span className="rounded-full bg-brand-tint px-[6px] text-2xs leading-4 text-brand">{skillIds.length}</span> : null}
              </button>
            </PopoverTrigger>
            <PopoverContent className="max-h-[360px] w-[300px] overflow-y-auto scroll-quiet">
              <div className="flex h-8 items-center px-2 text-xs leading-4 font-medium text-text-tab">{copy.context.pickSkills}</div>
              {(skills?.skills ?? []).map((s) => {
                const on = skillIds.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={on}
                    className={cn(row, "items-start", on && "bg-border-subtle")}
                    onClick={() => onSkills(on ? skillIds.filter((x) => x !== s.id) : [...skillIds, s.id].slice(0, 10))}
                  >
                    <Zap className={cn("mt-[2px] size-4 shrink-0", on ? "text-brand" : "text-text-secondary")} strokeWidth={1.5} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{s.name}</span>
                      {s.description ? <span className="block text-xs leading-4 font-normal text-text-secondary">{s.description}</span> : null}
                    </span>
                    {on ? <Check className="mt-[2px] size-4 shrink-0" strokeWidth={1.5} aria-hidden /> : null}
                  </button>
                );
              })}
              {user && skills && !skills.skills.length ? <p className="px-2 py-1 text-xs leading-4 text-text-secondary">{copy.context.noSkills}</p> : null}
              <Link href={agentRoutes.skills} className="mt-1 flex h-8 items-center rounded-md px-2 text-xs leading-4 font-medium text-brand hover:bg-border-subtle">
                {copy.context.manageSkills}
              </Link>
            </PopoverContent>
          </Popover>

          <Popover open={open === "apps"} onOpenChange={toggle("apps")}>
            <PopoverTrigger asChild>
              <button type="button" className={item}>
                <Blocks className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
                {copy.context.connectors}
                {connected.length ? <span className="rounded-full bg-brand-tint px-[6px] text-2xs leading-4 text-brand">{connected.length}</span> : null}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-[260px]">
              <div className="flex h-8 items-center px-2 text-xs leading-4 font-medium text-text-tab">{copy.context.connectedApps}</div>
              {connected.length ? (
                <ul>
                  {connected.map((a) => (
                    <li key={a.slug} className="flex h-8 items-center gap-2 px-2 text-sm leading-5">
                      <span className="size-[6px] rounded-full bg-brand" aria-hidden />
                      {a.name}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-2 py-1 text-xs leading-4 text-text-secondary">{copy.context.noneConnected}</p>
              )}
              <Link href={agentRoutes.connectors} className="mt-1 flex h-8 items-center rounded-md px-2 text-xs leading-4 font-medium text-brand hover:bg-border-subtle">
                {copy.context.manageConnectors}
              </Link>
            </PopoverContent>
          </Popover>
        </div>
        <Link href={routes.mcp} className={cn(item, "shrink-0")}>
          <Unplug className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
          {copy.context.tryMcp}
        </Link>
      </div>
    </div>
  );
}
