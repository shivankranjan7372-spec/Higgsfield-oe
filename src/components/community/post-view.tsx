"use client";

import { ArrowLeft, Bookmark, Flag, Heart, Link2, Pencil, Trash2, Wand2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { communityWords as w, reportReasons } from "@/content/community";
import { routes } from "@/content/site";
import { api, errorMessage, fetcher } from "@/lib/api";
import { useNow } from "@/lib/browser";
import { getModel } from "@/registry";
import { Button, ButtonLink, Dialog, DialogContent, MenuItem, Popover, PopoverClose, PopoverContent, PopoverTrigger, Spinner, Switch, cn } from "@/ui";
import { Avatar, EmptyState, ErrorLine, ago, count, day, profileHref, useGate } from "./bits";
import { usePostActions } from "./post-tile";
import { CommunitySubNav } from "./sub-nav";
import type { Comment, Post } from "./types";

const field =
  "w-full rounded-lg border border-border-subtle bg-surface-field px-3 py-2 text-sm leading-5 text-text-primary placeholder:text-text-tertiary outline-none transition-colors duration-150 focus:border-border-strong";

interface Recreate {
  modelId: string;
  prompt: string;
  values: Record<string, unknown>;
  droppedInputs: boolean;
}

/** Where "Recreate" sends the visitor, by the model's kind. */
export function studioFor(modelId: string, prompt: string) {
  const kind = getModel(modelId)?.kind;
  const base = kind === "video" ? routes.video : kind === "audio" || kind === "music" ? routes.audio : routes.image;
  return `${base}?model=${encodeURIComponent(modelId)}&prompt=${encodeURIComponent(prompt)}`;
}

function settingRows(r: Recreate) {
  const model = getModel(r.modelId);
  return Object.entries(r.values).map(([id, v]) => {
    const c = model?.controls.find((x) => x.id === id);
    let shown = String(v);
    if (c?.type === "select") shown = c.options.find((o) => o.value === v)?.label ?? shown;
    if (typeof v === "boolean") shown = v ? "On" : "Off";
    return { id, label: c?.label ?? id, value: shown };
  });
}

function EditDialog({ post, open, onOpenChange, onSaved }: { post: Post; open: boolean; onOpenChange: (o: boolean) => void; onSaved: (p: Post) => void }) {
  const [title, setTitle] = useState(post.title);
  const [description, setDescription] = useState(post.description);
  const [tags, setTags] = useState(post.tags.join(", "));
  const [recreate, setRecreate] = useState(post.allowRecreate);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setProblem(null);
    try {
      const r = await api<{ post: Post }>(`/api/community/posts/${post.id}`, {
        method: "PATCH",
        body: { title, description, tags: tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 8), allowRecreate: recreate },
      });
      onSaved(r.post);
      onOpenChange(false);
    } catch (err) {
      setProblem(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={w.post.edit} className="max-w-[480px]">
        <form onSubmit={save} className="flex flex-col gap-4 p-6 pt-4">
          <label className="flex flex-col gap-1 text-xs leading-4 font-medium text-text-secondary">
            {w.publish.titleLabel}
            <input className={field} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-xs leading-4 font-medium text-text-secondary">
            {w.publish.descriptionLabel}
            <textarea className={cn(field, "min-h-[72px]")} value={description} maxLength={2000} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-xs leading-4 font-medium text-text-secondary">
            {w.publish.tagsLabel}
            <input className={field} value={tags} onChange={(e) => setTags(e.target.value)} placeholder={w.publish.tagsHint} />
          </label>
          <div className="flex items-center justify-between gap-4">
            <label htmlFor="edit-recreate" className="text-sm leading-5 font-medium">
              {w.publish.recreateLabel}
            </label>
            <Switch id="edit-recreate" checked={recreate} onCheckedChange={setRecreate} />
          </div>
          {problem ? <p role="alert" className="text-sm leading-5 text-danger">{problem}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="md" onClick={() => onOpenChange(false)}>
              {w.post.cancel}
            </Button>
            <Button type="submit" variant="lime" size="md" disabled={busy}>
              {w.post.save_changes}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Comments({ post, onCount }: { post: Post; onCount: (d: number) => void }) {
  const now = useNow();
  const gate = useGate();
  const key = `/api/community/posts/${post.id}/comments?limit=100`;
  const { data, error, isLoading, mutate } = useSWR<{ comments: Comment[]; nextCursor: string | null }>(key, fetcher);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setProblem(null);
    try {
      const r = await gate.run("member", () => api<{ comment: Comment }>(`/api/community/posts/${post.id}/comments`, { method: "POST", body: { body } }));
      if (r) {
        setBody("");
        onCount(1);
        await mutate((d) => ({ comments: [...(d?.comments ?? []), r.comment], nextCursor: d?.nextCursor ?? null }), { revalidate: false });
      }
    } catch (err) {
      setProblem(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  async function remove(c: Comment) {
    setProblem(null);
    try {
      await api(`/api/community/comments/${c.id}`, { method: "DELETE" });
      onCount(-1);
      await mutate((d) => ({ comments: (d?.comments ?? []).filter((x) => x.id !== c.id), nextCursor: d?.nextCursor ?? null }), { revalidate: false });
    } catch (err) {
      setProblem(errorMessage(err));
    }
  }

  return (
    <section aria-label={w.post.comments} className="flex flex-col gap-3">
      <h2 className="text-sm leading-5 font-semibold text-text-primary">
        {w.post.comments} <span className="font-medium text-text-secondary">{count(post.counts.comments)}</span>
      </h2>
      {isLoading ? (
        <div className="flex flex-col gap-2" role="status" aria-label={w.feed.loading}>
          <div className="shimmer h-12 rounded-lg bg-surface-secondary" />
          <div className="shimmer h-12 rounded-lg bg-surface-secondary" />
        </div>
      ) : error ? (
        <ErrorLine error={error} onRetry={() => mutate()} />
      ) : data?.comments.length ? (
        <ul className="flex flex-col gap-3" aria-label={w.post.comments}>
          {data.comments.map((c) => (
            <li key={c.id} className="group flex gap-2">
              <Link href={profileHref(c.author.handle)} aria-label={c.author.name}>
                <Avatar author={c.author} size={28} />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
                <div className="flex items-center gap-2 text-xs leading-4">
                  <Link href={profileHref(c.author.handle)} className="truncate font-semibold text-text-primary hover:underline">
                    {c.author.name || c.author.handle}
                  </Link>
                  <span className="shrink-0 text-text-tertiary">{ago(c.createdAt, now)}</span>
                  {c.canDelete ? (
                    <button type="button" onClick={() => remove(c)} aria-label={`${w.post.delete} comment`} className="ml-auto flex size-6 shrink-0 items-center justify-center rounded-md text-text-tertiary transition-colors duration-150 hover:bg-border-subtle hover:text-danger">
                      <Trash2 className="size-[14px]" strokeWidth={1.5} aria-hidden />
                    </button>
                  ) : null}
                </div>
                <p className="text-sm leading-5 break-words whitespace-pre-wrap text-text-nav">{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm leading-5 text-text-secondary">{w.post.noComments}</p>
      )}
      {gate.member ? (
        <form onSubmit={send} className="flex items-end gap-2">
          <label className="sr-only" htmlFor="comment-body">
            {w.post.commentPlaceholder}
          </label>
          <textarea
            id="comment-body"
            value={body}
            maxLength={1000}
            rows={1}
            onChange={(e) => setBody(e.target.value)}
            placeholder={w.post.commentPlaceholder}
            className={cn(field, "min-h-10 resize-none")}
          />
          <Button type="submit" variant="lime" size="md" disabled={busy || !body.trim()}>
            {w.post.commentSend}
          </Button>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-surface-secondary p-3">
          <p className="min-w-0 flex-1 text-sm leading-5 text-text-secondary">{w.post.commentSignIn}</p>
          <ButtonLink href={`${routes.join}?next=${encodeURIComponent(`${routes.post}/${post.id}`)}`} variant="lime" size="sm">
            {w.createAccount}
          </ButtonLink>
        </div>
      )}
      {problem ? <p role="alert" className="text-sm leading-5 text-danger">{problem}</p> : null}
      {gate.dialog}
    </section>
  );
}

const action =
  "flex h-8 items-center gap-1 rounded-md bg-border-subtle px-3 text-sm leading-4 font-medium text-text-primary transition-colors duration-150 hover:bg-border-default disabled:opacity-40";

function Loaded({ initial }: { initial: Post }) {
  const router = useRouter();
  const { post, setPost, toggle, problem: tileProblem, dialog, gate } = usePostActions(initial);
  const [problem, setProblem] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const isAuthor = !!post.viewer?.isAuthor;
  const canRecreate = post.allowRecreate || isAuthor;
  const recreate = useSWR<Recreate>(canRecreate ? `/api/community/posts/${post.id}/recreate` : null, fetcher, { shouldRetryOnError: false });

  useEffect(() => {
    api(`/api/community/posts/${initial.id}/view`, { method: "POST" }).catch(() => {});
  }, [initial.id]);

  async function follow() {
    setProblem(null);
    const on = !!post.viewer?.followingAuthor;
    try {
      const r = await gate.run("member", () => api<{ following: boolean }>(`/api/profiles/${post.author.handle}/follow`, { method: on ? "DELETE" : "POST" }));
      if (r) setPost((p) => ({ ...p, viewer: p.viewer ? { ...p.viewer, followingAuthor: r.following } : p.viewer }));
    } catch (e) {
      setProblem(errorMessage(e));
    }
  }
  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setNote(w.post.copied);
    } catch {
      setNote(window.location.href);
    }
  }
  async function report(reason: string) {
    setProblem(null);
    try {
      const r = await gate.run("member", () => api(`/api/community/posts/${post.id}/report`, { method: "POST", body: { reason } }));
      if (r) setNote(w.post.reported);
    } catch (e) {
      setProblem(errorMessage(e));
    }
  }
  async function doRecreate() {
    setBusy(true);
    setProblem(null);
    try {
      const r = recreate.data ?? (await api<Recreate>(`/api/community/posts/${post.id}/recreate`));
      router.push(studioFor(r.modelId, r.prompt));
    } catch (e) {
      setProblem(errorMessage(e));
      setBusy(false);
    }
  }
  async function unpublish() {
    setBusy(true);
    setProblem(null);
    try {
      await api(`/api/community/posts/${post.id}`, { method: "DELETE" });
      router.push(profileHref(post.author.handle));
    } catch (e) {
      setProblem(errorMessage(e));
      setBusy(false);
    }
  }

  const ratio = post.media.width && post.media.height ? `${post.media.width} / ${post.media.height}` : post.kind === "audio" ? "1 / 1" : "16 / 9";

  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <div className="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-4 bg-black p-4 lg:p-8 lg:pt-14">
        <BackLink className="self-start lg:absolute lg:top-4 lg:left-8" />
        <div className="flex max-h-[calc(100dvh-180px)] w-full max-w-full items-center justify-center" style={{ aspectRatio: ratio, maxWidth: "min(100%, 1100px)" }}>
          {post.kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.media.url} alt={post.title || post.prompt || "Shared picture"} className="max-h-full max-w-full rounded-[13px] border border-[#FFFFFF26] object-contain [box-shadow:#0000008C_0px_24px_64px]" />
          ) : post.kind === "video" ? (
            <video src={post.media.url} poster={post.media.posterUrl ?? undefined} controls autoPlay muted loop playsInline className="max-h-full max-w-full rounded-[13px] border border-[#FFFFFF26]" />
          ) : (
            <div className="flex w-full max-w-[560px] flex-col gap-4 rounded-2xl bg-surface-secondary p-6">
              <audio src={post.media.url} controls className="w-full" />
            </div>
          )}
        </div>
      </div>
      <aside className="flex w-full flex-col gap-6 border-border-subtle bg-surface-primary p-4 lg:w-[400px] lg:shrink-0 lg:border-l lg:p-6">
        <div className="flex items-center gap-3">
          <Link href={profileHref(post.author.handle)} className="flex min-w-0 flex-1 items-center gap-[13px]">
            <Avatar author={post.author} size={31} />
            <span className="flex min-w-0 flex-col gap-px">
              <span className="text-xs leading-4 font-medium text-text-idle">{w.featured.by}</span>
              <span className="truncate text-base leading-5 font-medium text-text-primary hover:underline">{post.author.name || post.author.handle}</span>
            </span>
          </Link>
          {isAuthor ? null : (
            <Button variant={post.viewer?.followingAuthor ? "outline" : "white"} size="sm" onClick={follow}>
              {post.viewer?.followingAuthor ? w.profile.unfollow : w.profile.follow}
            </Button>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl leading-7 font-bold tracking-[-0.0375em] break-words text-text-primary">{post.title}</h1>
          {post.description ? <p className="text-sm leading-5 whitespace-pre-wrap text-text-nav">{post.description}</p> : null}
          {post.tags.length ? (
            <ul className="flex flex-wrap gap-1" aria-label="Tags">
              {post.tags.map((t) => (
                <li key={t} className="rounded-full bg-border-subtle px-2 py-[2px] text-xs leading-4 text-text-tab">
                  #{t}
                </li>
              ))}
            </ul>
          ) : null}
          <p className="text-xs leading-4 text-text-tertiary">
            {day(post.publishedAt)} · {count(post.counts.views)} {w.post.views}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={action} aria-pressed={!!post.viewer?.liked} onClick={() => toggle("like")}>
            <Heart className={cn("size-4", post.viewer?.liked && "fill-current text-promo")} strokeWidth={1.5} aria-hidden />
            {post.viewer?.liked ? w.post.unlike : w.post.like} <span className="text-text-tab">{count(post.counts.likes)}</span>
          </button>
          <button type="button" className={action} aria-pressed={!!post.viewer?.saved} onClick={() => toggle("save")}>
            <Bookmark className={cn("size-4", post.viewer?.saved && "fill-current text-brand")} strokeWidth={1.5} aria-hidden />
            {post.viewer?.saved ? w.post.unsave : w.post.save}
          </button>
          <button type="button" className={action} onClick={share}>
            <Link2 className="size-4" strokeWidth={1.5} aria-hidden />
            {w.post.share}
          </button>
          {isAuthor ? null : (
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className={action}>
                  <Flag className="size-4" strokeWidth={1.5} aria-hidden />
                  {w.post.report}
                </button>
              </PopoverTrigger>
              <PopoverContent look="panel" className="w-[220px] p-2">
                {reportReasons.map((r) => (
                  <PopoverClose key={r.id} asChild>
                    <MenuItem onClick={() => report(r.id)}>{r.label}</MenuItem>
                  </PopoverClose>
                ))}
              </PopoverContent>
            </Popover>
          )}
        </div>
        {note ? <p role="status" className="text-xs leading-4 text-brand">{note}</p> : null}
        {problem || tileProblem ? <p role="alert" className="text-sm leading-5 text-danger">{problem ?? tileProblem}</p> : null}

        <div className="flex flex-col gap-3 rounded-2xl bg-surface-secondary p-4">
          {post.model ? (
            <div className="flex items-center justify-between gap-2 text-xs leading-4">
              <span className="text-text-secondary">{w.post.model}</span>
              <span className="truncate font-medium text-text-primary">{post.model.name}</span>
            </div>
          ) : null}
          {post.prompt !== null ? (
            <div className="flex flex-col gap-1">
              <span className="text-xs leading-4 text-text-secondary">{w.post.prompt}</span>
              <p className="text-sm leading-5 break-words whitespace-pre-wrap text-text-primary">{post.prompt}</p>
            </div>
          ) : (
            <p className="text-xs leading-4 text-text-secondary">{w.post.privatePrompt}</p>
          )}
          {recreate.data && Object.keys(recreate.data.values).length ? (
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs leading-4">
              {settingRows(recreate.data).map((r) => (
                <div key={r.id} className="contents">
                  <dt className="truncate text-text-secondary">{r.label}</dt>
                  <dd className="truncate text-right font-medium text-text-primary">{r.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {recreate.data?.droppedInputs ? <p className="text-xs leading-4 text-text-tab">{w.post.droppedInputs}</p> : null}
          {recreate.error ? <p className="text-xs leading-4 text-danger">{errorMessage(recreate.error)}</p> : null}
          {canRecreate && !recreate.error ? (
            <Button variant="lime" size="md" onClick={doRecreate} disabled={busy}>
              {busy ? <Spinner label={w.post.recreateBusy} /> : <Wand2 className="size-4" strokeWidth={1.5} aria-hidden />}
              {w.post.recreate}
            </Button>
          ) : null}
        </div>

        {isAuthor ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" className={action} onClick={() => setEditing(true)}>
              <Pencil className="size-4" strokeWidth={1.5} aria-hidden />
              {w.post.edit}
            </button>
            {confirming ? (
              <div className="flex w-full flex-col gap-2 rounded-xl border border-border-default p-3">
                <p className="text-sm leading-5 text-text-primary">{w.post.unpublishConfirm}</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setConfirming(false)}>
                    {w.post.cancel}
                  </Button>
                  <Button variant="soft" size="sm" className="text-danger" onClick={unpublish} disabled={busy}>
                    {w.post.unpublish}
                  </Button>
                </div>
              </div>
            ) : (
              <button type="button" className={cn(action, "text-danger")} onClick={() => setConfirming(true)}>
                <Trash2 className="size-4" strokeWidth={1.5} aria-hidden />
                {w.post.unpublish}
              </button>
            )}
            <EditDialog post={post} open={editing} onOpenChange={setEditing} onSaved={(p) => setPost(p)} />
          </div>
        ) : null}

        <Comments post={post} onCount={(d) => setPost((p) => ({ ...p, counts: { ...p.counts, comments: Math.max(0, p.counts.comments + d) } }))} />
      </aside>
      {dialog}
    </div>
  );
}

function BackLink({ className }: { className?: string }) {
  return (
    <Link href={routes.community} className={cn("inline-flex items-center gap-1 text-sm leading-5 font-medium text-text-tertiary transition-colors duration-150 hover:text-text-primary", className)}>
      <ArrowLeft className="size-4" strokeWidth={1.5} aria-hidden />
      {w.post.back}
    </Link>
  );
}

/** /community/post/[id]: one post, large, with everything around it. */
export function PostView({ id }: { id: string }) {
  const { data, error, isLoading, mutate } = useSWR<{ post: Post }>(`/api/community/posts/${id}`, fetcher, { revalidateOnFocus: false });
  return (
    <div className="flex flex-1 flex-col bg-black">
      <CommunitySubNav />
      {isLoading ? (
        <div className="flex flex-1 flex-col gap-4 p-4 lg:flex-row lg:p-8" role="status" aria-label={w.feed.loading}>
          <div className="shimmer aspect-video flex-1 rounded-[13px] bg-surface-secondary" />
          <div className="shimmer h-[320px] rounded-2xl bg-surface-secondary lg:w-[400px]" />
        </div>
      ) : data ? (
        <Loaded key={data.post.id} initial={data.post} />
      ) : (
        <div className="flex flex-col gap-4 p-4 lg:p-8">
          <BackLink />
          {error && (error as { status?: number }).status === 404 ? (
            <EmptyState
              text={w.post.notFound}
              action={
                <ButtonLink href={routes.community} variant="white" size="pill">
                  {w.post.toCommunity}
                </ButtonLink>
              }
            />
          ) : (
            <ErrorLine error={error} onRetry={() => mutate()} />
          )}
        </div>
      )}
    </div>
  );
}
