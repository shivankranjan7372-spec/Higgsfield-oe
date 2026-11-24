"use client";

import { Download, Heart, RotateCcw, Send, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { mutate } from "swr";
import { routes } from "@/content/site";
import { videoCopy as t } from "@/content/video";
import { ApiError, api, errorMessage, type Asset, type Job } from "@/lib/api";
import { useSession } from "@/lib/session";
import { jobsKey } from "@/lib/studio";
import { ButtonLink, Dialog, DialogContent, cn } from "@/ui";
import { ratioOf } from "./history";

const action =
  "inline-flex h-8 shrink-0 items-center gap-[6px] rounded-md bg-border-subtle px-3 text-xs leading-4 font-medium whitespace-nowrap text-text-primary transition-colors duration-150 hover:bg-border-default disabled:pointer-events-none disabled:opacity-40";
const small =
  "inline-flex h-7 items-center rounded-md px-2 text-xs leading-4 font-medium transition-colors duration-150 hover:bg-border-default";

function settingsOf(job: Job): [string, string][] {
  return Object.entries(job.params)
    .filter(([, v]) => v !== "" && v !== null && v !== undefined)
    .map(([k, v]) => [
      k.charAt(0).toUpperCase() + k.slice(1),
      typeof v === "boolean"
        ? v
          ? "On"
          : "Off"
        : k === "duration"
          ? `${v}s`
          : String(v),
    ]);
}

/** One finished video, large, with what made it and what can be done with it. */
export function VideoDetail({
  open,
  onOpenChange,
  job,
  asset,
  onUse,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: Job | null;
  asset: Asset | null;
  onUse: (job: Job) => void;
}) {
  const [favorite, setFavorite] = useState<boolean | null>(null);
  const [problem, setProblem] = useState<{
    message: string;
    account: boolean;
  } | null>(null);
  const [post, setPost] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const { member } = useSession();

  function reset(next: boolean) {
    if (!next) {
      setFavorite(null);
      setProblem(null);
      setPost(null);
      setConfirming(false);
    }
    onOpenChange(next);
  }

  if (!job || !asset) return null;
  const fav = favorite ?? asset.favorite;
  const fail = (e: unknown) =>
    setProblem({
      message: errorMessage(e),
      account:
        e instanceof ApiError &&
        (e.code === "account_required" || e.status === 401),
    });

  async function toggleFavorite() {
    const next = !fav;
    setFavorite(next);
    try {
      await api(`/api/assets/${asset!.id}`, {
        method: "PATCH",
        body: { favorite: next },
      });
      void mutate(jobsKey("video"));
    } catch (e) {
      setFavorite(!next);
      fail(e);
    }
  }

  async function publish() {
    if (!member) {
      // Only members publish; a guest is asked to create an account instead of hitting a 403.
      setProblem({ message: t.detail.membersOnly, account: true });
      return;
    }
    setPublishing(true);
    setProblem(null);
    try {
      const res = await api<{ post: { id: string } }>("/api/community/posts", {
        method: "POST",
        body: {
          assetId: asset!.id,
          title: job!.prompt.slice(0, 120) || undefined,
          allowRecreate: true,
        },
      });
      setPost(res.post.id);
    } catch (e) {
      fail(e);
    } finally {
      setPublishing(false);
    }
  }

  async function remove() {
    try {
      await api(`/api/jobs/${job!.id}`, { method: "DELETE" });
      await mutate(jobsKey("video"));
      reset(false);
    } catch (e) {
      fail(e);
    }
  }

  const made = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(job.createdAt));

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogContent
        title={t.detail.title}
        hideTitle
        className="flex max-w-[1080px] flex-col lg:flex-row"
      >
        <div className="flex min-w-0 flex-1 items-center justify-center bg-surface-sunken p-4 lg:p-6">
          <video
            src={asset.url}
            poster={asset.posterUrl ?? undefined}
            controls
            autoPlay
            loop
            playsInline
            className="max-h-[50dvh] w-full lg:max-h-[70dvh] rounded-xl bg-ink object-contain"
            style={{ aspectRatio: ratioOf(job, asset) }}
          />
        </div>
        <div className="flex w-full shrink-0 flex-col gap-4 p-6 pt-14 lg:w-[320px]">
          <div className="flex flex-col gap-1">
            <p className="text-xs leading-4 font-medium text-[#FFFFFF99]">
              {t.prompt}
            </p>
            <p className="scroll-quiet max-h-[160px] overflow-y-auto text-sm leading-5 text-text-soft">
              {job.prompt || t.detail.noPrompt}
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-2">
            {[
              [t.detail.model, job.modelName] as [string, string],
              ...settingsOf(job),
              [t.detail.created, made] as [string, string],
            ].map(([k, v]) => (
              <div
                key={k}
                className={cn(
                  "flex min-w-0 flex-col rounded-xl bg-border-subtle px-3 py-2",
                  k === t.detail.created && "col-span-2",
                )}
              >
                <dt className="text-xs leading-4 font-medium text-[#FFFFFF99]">
                  {k}
                </dt>
                <dd className="truncate text-sm leading-5 font-medium text-text-soft">
                  {v}
                </dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap gap-2">
            <a href={`${asset.url}?download=1`} download className={action}>
              <Download className="size-4" strokeWidth={1.5} aria-hidden />
              {t.detail.download}
            </a>
            <button
              type="button"
              aria-pressed={fav}
              onClick={() => void toggleFavorite()}
              className={action}
            >
              <Heart
                className={cn("size-4", fav && "fill-brand text-brand")}
                strokeWidth={1.5}
                aria-hidden
              />
              {fav ? t.detail.unfavourite : t.detail.favourite}
            </button>
            <button
              type="button"
              onClick={() => {
                onUse(job);
                reset(false);
              }}
              className={action}
            >
              <RotateCcw className="size-4" strokeWidth={1.5} aria-hidden />
              {t.detail.useSettings}
            </button>
            {post ? (
              <Link href={`${routes.post}/${post}`} className={action}>
                <Send className="size-4" strokeWidth={1.5} aria-hidden />
                {t.detail.viewPost}
              </Link>
            ) : (
              <button
                type="button"
                disabled={publishing}
                onClick={() => void publish()}
                className={action}
              >
                <Send className="size-4" strokeWidth={1.5} aria-hidden />
                {t.detail.publish}
              </button>
            )}
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className={cn(action, "text-danger")}
            >
              <Trash2 className="size-4" strokeWidth={1.5} aria-hidden />
              {t.detail.delete}
            </button>
          </div>
          {confirming ? (
            <div
              role="alertdialog"
              aria-label={t.detail.confirmDelete}
              className="flex flex-col gap-2 rounded-xl border border-[#FF6B6B40] bg-[#FF6B6B14] p-3"
            >
              <p className="text-xs leading-4 text-text-primary">
                {t.detail.confirmDelete}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void remove()}
                  className={cn(small, "bg-border-subtle text-danger")}
                >
                  {t.detail.confirm}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className={cn(small, "text-text-primary")}
                >
                  {t.detail.keep}
                </button>
              </div>
            </div>
          ) : null}
          {post ? (
            <p className="text-xs leading-4 text-brand">{t.detail.published}</p>
          ) : null}
          {problem ? (
            <div
              role="alert"
              className="flex flex-col gap-2 rounded-xl bg-border-subtle p-3 text-xs leading-4 text-text-primary"
            >
              {problem.message}
              {problem.account ? (
                <ButtonLink
                  href={`${routes.join}?next=${encodeURIComponent(routes.video)}`}
                  variant="lime"
                  size="xs"
                  className="self-start"
                >
                  {t.createAccount}
                </ButtonLink>
              ) : null}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
