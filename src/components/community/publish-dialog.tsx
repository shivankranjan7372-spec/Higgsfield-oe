"use client";

import { Music } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { communityWords as w } from "@/content/community";
import { routes } from "@/content/site";
import { api, errorMessage, fetcher, type Asset } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Button, ButtonLink, Dialog, DialogContent, Spinner, Switch, cn } from "@/ui";
import { postHref } from "./bits";
import type { Post } from "./types";

const field =
  "w-full rounded-lg border border-border-subtle bg-surface-field px-3 py-2 text-sm leading-5 text-text-primary placeholder:text-text-tertiary outline-none transition-colors duration-150 focus:border-border-strong";

function Thumb({ asset }: { asset: Asset }) {
  if (asset.kind === "audio")
    return (
      <span className="flex size-full items-center justify-center text-text-tab">
        <Music className="size-6" strokeWidth={1.5} aria-hidden />
      </span>
    );
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={asset.posterUrl ?? asset.url} alt={asset.prompt || asset.title || "Your result"} loading="lazy" className="size-full object-cover" />;
}

function Form({ onDone }: { onDone: (post: Post) => void }) {
  const { data, error, isLoading } = useSWR<{ assets: Asset[] }>("/api/assets?source=generated&limit=60", fetcher);
  const mine = (data?.assets ?? []).filter((a) => !a.isPublic);
  const [pick, setPick] = useState<Asset | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [recreate, setRecreate] = useState(true);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const chosen = pick ?? mine[0] ?? null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!chosen) return;
    setBusy(true);
    setProblem(null);
    try {
      const r = await api<{ post: Post }>("/api/community/posts", {
        method: "POST",
        body: {
          assetId: chosen.id,
          title: title.trim() || undefined,
          description: description.trim() || undefined,
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 8),
          allowRecreate: recreate,
        },
      });
      onDone(r.post);
    } catch (err) {
      setProblem(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (isLoading)
    return (
      <div className="grid grid-cols-4 gap-1 p-6" role="status" aria-label={w.feed.loading}>
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="shimmer aspect-square rounded-md bg-surface-tertiary" />
        ))}
      </div>
    );
  if (error) return <p role="alert" className="p-6 text-sm leading-5 text-danger">{errorMessage(error)}</p>;
  if (!mine.length)
    return (
      <div className="flex flex-col items-start gap-4 p-6">
        <p className="text-sm leading-5 text-text-secondary">{w.publish.none}</p>
        <ButtonLink href={routes.image} variant="lime" size="md">
          {w.publish.make}
        </ButtonLink>
      </div>
    );

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 p-6 pt-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-xs leading-4 font-medium text-text-secondary">{w.publish.pick}</legend>
        <div role="radiogroup" aria-label={w.publish.pick} className="grid max-h-[208px] grid-cols-4 gap-1 overflow-y-auto scroll-quiet sm:grid-cols-5">
          {mine.map((a) => (
            <button
              key={a.id}
              type="button"
              role="radio"
              aria-checked={chosen?.id === a.id}
              aria-label={a.prompt || a.title || a.id}
              onClick={() => setPick(a)}
              className={cn("relative aspect-square overflow-clip rounded-md bg-surface-tertiary outline-offset-0", chosen?.id === a.id ? "ring-2 ring-brand" : "opacity-70 hover:opacity-100")}
            >
              <Thumb asset={a} />
            </button>
          ))}
        </div>
      </fieldset>
      <label className="flex flex-col gap-1 text-xs leading-4 font-medium text-text-secondary">
        {w.publish.titleLabel}
        <input className={field} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder={chosen?.prompt.slice(0, 60) || ""} />
      </label>
      <label className="flex flex-col gap-1 text-xs leading-4 font-medium text-text-secondary">
        {w.publish.descriptionLabel}
        <textarea className={cn(field, "min-h-[72px] resize-y")} value={description} maxLength={2000} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-xs leading-4 font-medium text-text-secondary">
        {w.publish.tagsLabel}
        <input className={field} value={tags} onChange={(e) => setTags(e.target.value)} placeholder={w.publish.tagsHint} />
      </label>
      <div className="flex items-center justify-between gap-4">
        <label htmlFor="publish-recreate" className="flex flex-col">
          <span className="text-sm leading-5 font-medium text-text-primary">{w.publish.recreateLabel}</span>
          <span className="text-xs leading-4 text-text-secondary">{w.publish.recreateHint}</span>
        </label>
        <Switch id="publish-recreate" checked={recreate} onCheckedChange={setRecreate} />
      </div>
      {problem ? <p role="alert" className="text-sm leading-5 text-danger">{problem}</p> : null}
      <Button type="submit" variant="lime" size="md" disabled={busy || !chosen}>
        {busy ? <Spinner label={w.publish.submit} /> : null}
        {w.publish.submit}
      </Button>
    </form>
  );
}

/** The window to share one of the member's own results. Guests and visitors are asked to join. */
export function PublishDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { member } = useSession();
  const { mutate } = useSWRConfig();
  const [done, setDone] = useState<Post | null>(null);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setDone(null);
      }}
    >
      <DialogContent title={w.publish.title} className="max-w-[520px]">
        {!member ? (
          <div className="flex flex-col items-start gap-4 p-6">
            <p className="text-sm leading-5 text-text-secondary">{w.publish.signIn}</p>
            <ButtonLink href={`${routes.join}?next=${encodeURIComponent(routes.community)}`} variant="lime" size="md">
              {w.createAccount}
            </ButtonLink>
          </div>
        ) : done ? (
          <div className="flex flex-col items-start gap-4 p-6">
            <Link href={postHref(done.id)} className={cn("text-sm leading-5 font-semibold text-brand underline-offset-4 hover:underline")}>
              {w.publish.done}
            </Link>
          </div>
        ) : (
          <Form
            onDone={(post) => {
              setDone(post);
              void mutate((k) => typeof k === "string" && (k.startsWith("/api/explore") || k.startsWith("/api/assets") || k.startsWith("$inf$/api/explore")));
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
