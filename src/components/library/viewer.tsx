"use client";

import { ChevronLeft, ChevronRight, Copy, Download, FolderInput, Heart, Send, Trash2, Wand2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { library } from "@/content/library";
import { routes } from "@/content/site";
import { api, ApiError, errorMessage } from "@/lib/api";
import { useSession } from "@/lib/session";
import { getModel } from "@/registry";
import { Button, buttonClass, cn, Dialog, DialogContent, IconButton } from "@/ui";
import { AssetMedia, ErrorLine } from "./common";
import { bulk, formatBytes, formatDuration, type Asset, type Folder } from "./data";
import { MoveMenu } from "./selection-bar";

const words = library.viewer;

function studioHref(a: Asset): string | null {
  if (!a.modelId) return null;
  const base = a.kind === "video" ? routes.video : a.kind === "audio" ? routes.audio : routes.image;
  return `${base}?model=${encodeURIComponent(a.modelId)}&prompt=${encodeURIComponent(a.prompt)}`;
}

function paramText(v: unknown): string {
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v);
}

/** The large view of one file, with its details and every action. */
export function AssetViewer({
  asset,
  folders,
  onClose,
  onPrev,
  onNext,
}: {
  asset: Asset | null;
  folders: Folder[];
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  return (
    <Dialog open={!!asset} onOpenChange={(o) => (o ? null : onClose())}>
      {asset ? (
        <DialogContent
          title={words.title}
          hideTitle
          className="max-w-[1180px] p-0"
          onKeyDown={(e) => {
            if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "TEXTAREA") return;
            if (e.key === "ArrowLeft" && onPrev) onPrev();
            if (e.key === "ArrowRight" && onNext) onNext();
          }}
        >
          <ViewerBody key={asset.id} asset={asset} folders={folders} onClose={onClose} onPrev={onPrev} onNext={onNext} />
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function ViewerBody({ asset, folders, onClose, onPrev, onNext }: { asset: Asset; folders: Folder[]; onClose: () => void; onPrev?: () => void; onNext?: () => void }) {
  const { member } = useSession();
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fav = asset.favorite;
  const [copied, setCopied] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [postId, setPostId] = useState<string | null>(null);
  const [title, setTitle] = useState(asset.title || asset.prompt.slice(0, 120));

  const model = getModel(asset.modelId);
  const folder = folders.find((f) => f.id === asset.folderId);
  const studio = studioHref(asset);
  const params = Object.entries(asset.params ?? {}).filter(([, v]) => v !== null && v !== undefined && v !== "");
  const created = new Intl.DateTimeFormat(undefined, { dateStyle: "long", timeStyle: "short" }).format(asset.createdAt);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setProblem(null);
    try {
      await fn();
    } catch (e) {
      setProblem(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const row = (label: string, value: string) => (
    <div className="flex items-start justify-between gap-3 text-sm leading-5">
      <dt className="shrink-0 text-text-secondary">{label}</dt>
      <dd className="min-w-0 text-right break-words text-text-primary">{value}</dd>
    </div>
  );

  return (
    <div className="flex flex-col md:h-[min(760px,calc(100dvh-32px))] md:flex-row">
      <div className="relative flex min-h-[260px] flex-1 items-center justify-center bg-page md:min-h-0">
        <div className={cn("flex size-full items-center justify-center", asset.kind === "audio" ? "aspect-square max-h-[420px] max-w-[420px]" : "")}>
          {asset.kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={asset.url} alt={asset.prompt || asset.title} className="max-h-full max-w-full object-contain" />
          ) : asset.kind === "video" ? (
            <AssetMedia asset={asset} controls />
          ) : (
            <div className="flex size-full flex-col">
              <div className="min-h-0 flex-1">
                <AssetMedia asset={asset} interactive={false} />
              </div>
              <audio src={asset.url} controls className="w-full" aria-label={asset.prompt || asset.title} />
            </div>
          )}
        </div>
        {onPrev ? (
          <IconButton size={38} tone="soft" aria-label={words.prev} onClick={onPrev} className="absolute top-1/2 left-3 -translate-y-1/2">
            <ChevronLeft className="size-5" strokeWidth={1.5} aria-hidden />
          </IconButton>
        ) : null}
        {onNext ? (
          <IconButton size={38} tone="soft" aria-label={words.next} onClick={onNext} className="absolute top-1/2 right-3 -translate-y-1/2">
            <ChevronRight className="size-5" strokeWidth={1.5} aria-hidden />
          </IconButton>
        ) : null}
      </div>

      <aside className="flex w-full shrink-0 flex-col gap-5 overflow-y-auto p-6 pt-16 scroll-quiet md:w-[360px]">
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs leading-4 font-medium text-text-secondary">{asset.prompt ? words.prompt : asset.title || words.noPrompt}</h2>
            {asset.prompt ? (
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(asset.prompt).then(() => setCopied(true));
                }}
                className="flex items-center gap-1 text-xs leading-4 text-text-secondary transition-colors duration-150 hover:text-text-primary"
              >
                <Copy className="size-3.5" strokeWidth={1.5} aria-hidden />
                {copied ? words.copied : words.copy}
              </button>
            ) : null}
          </div>
          {asset.prompt ? <p className="text-sm leading-5 break-words whitespace-pre-wrap text-text-primary">{asset.prompt}</p> : null}
        </section>

        <dl className="flex flex-col gap-2 border-t border-border-subtle pt-4">
          {model ? row(words.model, model.name) : asset.modelId ? row(words.model, asset.modelId) : null}
          {row(words.created, created)}
          {asset.width && asset.height ? row(words.dimensions, `${asset.width} × ${asset.height}`) : null}
          {asset.duration ? row(words.duration, formatDuration(asset.duration)) : null}
          {row(words.size, formatBytes(asset.bytes))}
          {row(words.folder, folder?.name ?? library.move.none)}
        </dl>

        {params.length > 0 ? (
          <section className="flex flex-col gap-2 border-t border-border-subtle pt-4">
            <h2 className="text-xs leading-4 font-medium text-text-secondary">{words.settings}</h2>
            <div className="flex flex-wrap gap-1">
              {params.map(([k, v]) => (
                <span key={k} className="rounded-md bg-border-subtle px-2 py-1 text-xs leading-4 text-text-nav">
                  {k}: <span className="text-text-primary">{paramText(v)}</span>
                </span>
              ))}
            </div>
          </section>
        ) : null}

        {problem ? <ErrorLine message={problem} /> : null}

        <div className="mt-auto flex flex-col gap-2 border-t border-border-subtle pt-4">
          {studio ? (
            <Link href={studio} className={buttonClass("lime", "md")}>
              <Wand2 className="size-4" strokeWidth={1.5} aria-hidden />
              {words.openStudio}
            </Link>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <a href={`${asset.url}?download=1`} download className={buttonClass("soft", "md")}>
              <Download className="size-4" strokeWidth={1.5} aria-hidden />
              {words.download}
            </a>
            <Button
              variant="soft"
              size="md"
              disabled={busy}
              aria-pressed={fav}
              onClick={() =>
                void run(async () => {
                  await bulk("favorite", [asset.id], { favorite: !fav });
                })
              }
            >
              <Heart className={cn("size-4", fav && "fill-current text-brand")} strokeWidth={1.5} aria-hidden />
              {fav ? words.unfavourite : words.favourite}
            </Button>
            <MoveMenu
              ids={[asset.id]}
              folders={folders}
              current={asset.folderId}
              trigger={
                <Button variant="soft" size="md" disabled={busy}>
                  <FolderInput className="size-4" strokeWidth={1.5} aria-hidden />
                  {words.move}
                </Button>
              }
            />
            <Button
              variant="soft"
              size="md"
              disabled={busy}
              className="hover:text-danger"
              onClick={() =>
                void run(async () => {
                  await bulk("trash", [asset.id]);
                  onClose();
                })
              }
            >
              <Trash2 className="size-4" strokeWidth={1.5} aria-hidden />
              {words.delete}
            </Button>
          </div>
          {asset.source === "generated" ? (
            postId || asset.isPublic ? (
              postId ? (
                <Link href={`${routes.post}/${postId}`} className={buttonClass("outline", "md")}>
                  {words.viewPost}
                </Link>
              ) : (
                <p className="text-center text-xs leading-4 text-text-secondary">{words.published}</p>
              )
            ) : !member ? (
              <p className="text-center text-xs leading-4 text-text-secondary">
                {words.publishMember}{" "}
                <Link href={`${routes.join}?next=${encodeURIComponent(routes.library)}`} className="text-brand hover:underline">
                  {library.guest.cta}
                </Link>
              </p>
            ) : publishing ? (
              <form
                className="flex flex-col gap-2 rounded-xl bg-surface-secondary-strong p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    try {
                      const r = await api<{ post: { id: string } }>("/api/community/posts", { method: "POST", body: { assetId: asset.id, title } });
                      setPostId(r.post.id);
                      setPublishing(false);
                    } catch (err) {
                      if (err instanceof ApiError && err.code === "already_published") setPostId(null);
                      throw err;
                    }
                  });
                }}
              >
                <p className="text-xs leading-4 text-text-secondary">{words.publishNote}</p>
                <label className="flex flex-col gap-1 text-xs leading-4 text-text-secondary">
                  {words.publishField}
                  <input
                    value={title}
                    maxLength={120}
                    onChange={(e) => setTitle(e.target.value)}
                    className="h-9 rounded-md bg-surface-field px-2 text-sm leading-5 text-text-primary outline-none"
                  />
                </label>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setPublishing(false)}>
                    {library.cancel}
                  </Button>
                  <Button type="submit" variant="lime" size="sm" disabled={busy}>
                    {words.publishGo}
                  </Button>
                </div>
              </form>
            ) : (
              <Button variant="outline" size="md" onClick={() => setPublishing(true)}>
                <Send className="size-4" strokeWidth={1.5} aria-hidden />
                {words.publish}
              </Button>
            )
          ) : null}
        </div>
      </aside>
    </div>
  );
}
