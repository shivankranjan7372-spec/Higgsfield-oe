"use client";

import { Check, ChevronLeft, ChevronRight, Copy, Download, Heart, ImagePlus, Send, SlidersHorizontal, Trash2, Wand2 } from "lucide-react";
import { useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { VendorGlyph } from "@/components/brand/logo";
import { LoginDialog } from "@/components/entry/login-dialog";
import { formatCredits } from "@/config/economy";
import { imageCopy } from "@/content/image";
import { routes } from "@/content/site";
import { api, errorMessage, type Asset, type Job } from "@/lib/api";
import { useSession } from "@/lib/session";
import type { Studio } from "@/lib/studio";
import { getModel, type ModelDef } from "@/registry";
import { Button, ButtonLink, Dialog, DialogContent, IconButton, MenuItem, Popover, PopoverContent, PopoverTrigger, Switch, buttonClass, cn } from "@/ui";
import type { Shot, Workspace } from "./use-workspace";

const v = imageCopy.viewer;
const p = imageCopy.publish;

/** The settings a job used, in the words of its model's controls. */
function settingsOf(job: Job): { label: string; value: string }[] {
  const model = getModel(job.modelId);
  return Object.entries(job.params).map(([id, raw]) => {
    const control = model?.controls.find((c) => c.id === id);
    let value = String(raw);
    if (control?.type === "select") value = control.options.find((o) => o.value === raw)?.label ?? value;
    else if (control?.type === "toggle") value = raw ? "On" : "Off";
    else if (control?.type === "slider" && control.unit) value = `${raw}${control.unit}`;
    return { label: control?.label ?? id, value };
  });
}

/** Image models that take a picture in: the tools a result can be sent to. */
export function editModels(studio: Studio): ModelDef[] {
  return studio.models.filter((m) => m.status === "available" && m.slots.some((s) => s.accept.includes("image")));
}

function sendTo(studio: Studio, model: ModelDef, asset: Asset) {
  const slot = model.slots.find((s) => s.accept.includes("image"));
  if (!slot) return;
  studio.pickModel(model.id);
  studio.attachAssets(slot, [asset]);
}

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

const row = "flex items-start justify-between gap-4 text-xs leading-4";
const action = cn(buttonClass("soft", "sm"), "gap-[6px]");

function Publish({ asset, onDone }: { asset: Asset; onDone: () => void }) {
  const { member } = useSession();
  const [joinOpen, setJoinOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [allowRecreate, setAllowRecreate] = useState(true);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<{ text: string; join: boolean } | null>(null);
  const [postId, setPostId] = useState<string | null>(null);

  if (!member) {
    return (
      <div className="flex flex-col gap-3 rounded-xl bg-border-subtle p-3">
        <p className="text-xs leading-4 text-text-secondary">{p.guest}</p>
        <Button variant="lime" size="sm" onClick={() => setJoinOpen(true)}>
          {p.join}
        </Button>
        <LoginDialog open={joinOpen} onOpenChange={setJoinOpen} mode="join" next={routes.image} />
      </div>
    );
  }

  if (postId) {
    return (
      <div role="status" className="flex items-center justify-between gap-3 rounded-xl bg-brand-tint p-3 text-xs leading-4 text-brand">
        <span>{p.done}</span>
        <ButtonLink href={`${routes.post}/${postId}`} variant="lime" size="xs">
          {p.view}
        </ButtonLink>
      </div>
    );
  }

  async function submit() {
    setBusy(true);
    setProblem(null);
    try {
      const r = await api<{ post: { id: string } }>("/api/community/posts", {
        method: "POST",
        body: { assetId: asset.id, title: title.trim() || undefined, allowRecreate },
      });
      setPostId(r.post.id);
    } catch (e) {
      const code = (e as { code?: string }).code;
      setProblem({ text: errorMessage(e), join: code === "account_required" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-3 rounded-xl bg-border-subtle p-3"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <p className="text-sm leading-5 font-medium text-text-primary">{p.heading}</p>
      <label className="flex flex-col gap-1 text-xs leading-4 text-text-secondary">
        {p.titleLabel}
        <input
          value={title}
          maxLength={120}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={p.titlePlaceholder}
          className="h-8 rounded-md bg-surface-field px-2 text-sm leading-5 text-text-primary placeholder:text-text-tertiary"
        />
      </label>
      <label className="flex items-center justify-between gap-3 text-xs leading-4 text-text-primary">
        {p.recreate}
        <Switch checked={allowRecreate} onCheckedChange={setAllowRecreate} aria-label={p.recreate} />
      </label>
      {problem ? (
        <p role="alert" className="text-xs leading-4 text-danger">
          {problem.text}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onDone}>
          {p.cancel}
        </Button>
        <Button type="submit" variant="lime" size="sm" disabled={busy}>
          {p.submit}
        </Button>
      </div>
    </form>
  );
}

export interface ViewerProps {
  shots: Shot[];
  /** The asset id on screen, or null when closed. */
  openId: string | null;
  onOpenId: (id: string | null) => void;
  studio: Studio;
  ws: Workspace;
}

/**
 * One result, large: the picture, what made it, and everything that can be done with it.
 * Left and right arrow keys step through the results in grid order.
 */
export function Viewer({ shots, openId, onOpenId, studio, ws }: ViewerProps) {
  const index = openId ? shots.findIndex((s) => s.asset.id === openId) : -1;
  const shot = index >= 0 ? shots[index] : null;
  const [copied, setCopied] = useState<string | null>(null);
  const [publishing, setPublishing] = useState<string | null>(null);

  const step = (by: number) => {
    if (index < 0 || shots.length === 0) return;
    const next = shots[(index + by + shots.length) % shots.length];
    onOpenId(next.asset.id);
  };

  function onKeyDown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    if (target.closest("input, textarea, [role='menu'], [data-radix-popper-content-wrapper]")) return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      step(-1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      step(1);
    }
  }

  // Focus goes back to the tile of the picture last on screen, which may not be the one opened.
  const last = useRef<string | null>(null);
  const close = () => {
    last.current = openId;
    onOpenId(null);
  };
  const toComposer = () => {
    close();
    window.setTimeout(() => document.querySelector<HTMLTextAreaElement>("textarea")?.focus(), 50);
  };

  return (
    <Dialog open={openId !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent
        title={v.title}
        hideTitle
        onKeyDown={onKeyDown}
        onCloseAutoFocus={(e) => {
          const tile = last.current && document.querySelector<HTMLElement>(`[data-asset="${last.current}"] button`);
          if (tile) {
            e.preventDefault();
            tile.focus();
          }
        }}
        className="flex w-[min(1240px,calc(100vw-32px))] flex-col overflow-hidden p-0 lg:h-[min(780px,calc(100dvh-64px))] lg:flex-row"
      >
        {shot ? (
          <ShotView
            key={shot.asset.id}
            shot={shot}
            position={v.position(index + 1, shots.length)}
            canStep={shots.length > 1}
            onStep={step}
            studio={studio}
            ws={ws}
            copied={copied === shot.asset.id}
            onCopied={() => setCopied(shot.asset.id)}
            publishing={publishing === shot.asset.id}
            onPublishing={(on) => setPublishing(on ? shot.asset.id : null)}
            onClose={close}
            onComposer={toComposer}
          />
        ) : (
          <p className="p-10 text-sm leading-5 text-text-secondary">{v.gone}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ShotView({
  shot,
  position,
  canStep,
  onStep,
  studio,
  ws,
  copied,
  onCopied,
  publishing,
  onPublishing,
  onClose,
  onComposer,
}: {
  shot: Shot;
  position: string;
  canStep: boolean;
  onStep: (by: number) => void;
  studio: Studio;
  ws: Workspace;
  copied: boolean;
  onCopied: () => void;
  publishing: boolean;
  onPublishing: (on: boolean) => void;
  onClose: () => void;
  onComposer: () => void;
}) {
  const { job, asset } = shot;
  const model = getModel(job.modelId);
  const settings = settingsOf(job);
  const tools = editModels(studio);
  const here = studio.slotFor("image");

  async function copy() {
    try {
      await navigator.clipboard.writeText(job.prompt);
      onCopied();
    } catch {
      ws.setNotice({ text: "Copying is blocked in this browser.", tone: "error" });
    }
  }

  return (
    <>
      <div
        style={{ "--ar": asset.width && asset.height ? `${asset.width} / ${asset.height}` : "1 / 1" } as CSSProperties}
        className="relative flex min-h-[200px] flex-1 items-center justify-center bg-surface-sunken max-lg:aspect-(--ar) max-lg:max-h-[60dvh]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={asset.posterUrl ?? asset.url}
          alt={job.prompt || imageCopy.tile.madeWith(job.modelName)}
          className="absolute inset-0 m-auto max-h-full max-w-full object-contain"
        />
        {canStep ? (
          <>
            <IconButton size={38} tone="soft" aria-label={v.prev} onClick={() => onStep(-1)} className="absolute top-1/2 left-3 -translate-y-1/2">
              <ChevronLeft className="size-5" strokeWidth={1.5} aria-hidden />
            </IconButton>
            <IconButton size={38} tone="soft" aria-label={v.next} onClick={() => onStep(1)} className="absolute top-1/2 right-3 -translate-y-1/2">
              <ChevronRight className="size-5" strokeWidth={1.5} aria-hidden />
            </IconButton>
          </>
        ) : null}
        <span className="absolute bottom-3 left-3 rounded-full bg-[#00000080] px-2 py-1 font-mono text-2xs leading-[14px] text-text-tab">{position}</span>
      </div>

      <aside className="scroll-quiet flex w-full shrink-0 flex-col gap-5 overflow-y-auto p-5 lg:w-[360px] lg:pt-14">
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs leading-4 font-medium text-text-tab">{v.prompt}</h3>
            {job.prompt ? (
              <button
                type="button"
                onClick={() => void copy()}
                className="inline-flex items-center gap-1 rounded-md px-1 text-xs leading-4 text-text-secondary transition-colors duration-150 hover:text-text-primary"
              >
                {copied ? <Check className="size-3" strokeWidth={1.5} aria-hidden /> : <Copy className="size-3" strokeWidth={1.5} aria-hidden />}
                {copied ? v.copied : v.copy}
              </button>
            ) : null}
          </div>
          <p className="max-h-40 overflow-y-auto text-sm leading-5 break-words text-text-primary scroll-quiet">{job.prompt || v.noPrompt}</p>
        </section>

        <dl className="flex flex-col gap-2 border-t border-border-subtle pt-4">
          <div className={row}>
            <dt className="text-text-secondary">{v.model}</dt>
            <dd className="flex min-w-0 items-center gap-1 text-text-primary">
              <VendorGlyph vendor={model?.vendor ?? ""} />
              <span className="truncate">{job.modelName}</span>
            </dd>
          </div>
          {settings.map((s) => (
            <div key={s.label} className={row}>
              <dt className="text-text-secondary">{s.label}</dt>
              <dd className="truncate text-text-primary">{s.value}</dd>
            </div>
          ))}
          {asset.width && asset.height ? (
            <div className={row}>
              <dt className="text-text-secondary">{v.size}</dt>
              <dd className="text-text-primary tabular-nums">{`${asset.width} × ${asset.height}`}</dd>
            </div>
          ) : null}
          <div className={row}>
            <dt className="text-text-secondary">{v.cost}</dt>
            <dd className="text-text-primary">{v.costFor(formatCredits(job.cost), job.assets.length)}</dd>
          </div>
          <div className={row}>
            <dt className="text-text-secondary">{v.made}</dt>
            <dd className="text-text-primary">{dateFormat.format(job.finishedAt ?? job.createdAt)}</dd>
          </div>
        </dl>

        <div className="flex flex-wrap gap-2 border-t border-border-subtle pt-4">
          <a href={`${asset.url}?download=1`} download className={action}>
            <Download className="size-4" strokeWidth={1.5} aria-hidden />
            {v.download}
          </a>
          <button type="button" aria-pressed={asset.favorite} onClick={() => void ws.setFavorite([asset.id], !asset.favorite)} className={action}>
            <Heart className={cn("size-4", asset.favorite && "fill-brand text-brand")} strokeWidth={1.5} aria-hidden />
            {asset.favorite ? v.favorited : v.favorite}
          </button>
          <button
            type="button"
            onClick={() => {
              studio.load(job);
              onComposer();
            }}
            className={action}
          >
            <SlidersHorizontal className="size-4" strokeWidth={1.5} aria-hidden />
            {v.useSettings}
          </button>
          {tools.length ? (
            <button
              type="button"
              onClick={() => {
                if (here) studio.attachAssets(here, [asset]);
                else sendTo(studio, tools[0], asset);
                onComposer();
              }}
              className={action}
            >
              <ImagePlus className="size-4" strokeWidth={1.5} aria-hidden />
              {v.useReference}
            </button>
          ) : null}
          {tools.length ? (
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className={action}>
                  <Wand2 className="size-4" strokeWidth={1.5} aria-hidden />
                  {v.editWith}
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="scroll-quiet max-h-[320px] w-[240px] overflow-y-auto">
                <p className="px-2 py-2 text-xs leading-4 text-text-secondary">{v.editHint}</p>
                {tools.map((m) => (
                  <MenuItem
                    key={m.id}
                    icon={<VendorGlyph vendor={m.vendor} />}
                    selected={studio.model?.id === m.id}
                    onClick={() => {
                      sendTo(studio, m, asset);
                      onComposer();
                    }}
                  >
                    {m.name}
                  </MenuItem>
                ))}
              </PopoverContent>
            </Popover>
          ) : null}
          <button type="button" aria-expanded={publishing} onClick={() => onPublishing(!publishing)} className={action}>
            <Send className="size-4" strokeWidth={1.5} aria-hidden />
            {v.publish}
          </button>
          <button
            type="button"
            onClick={() => {
              void ws.trash([asset.id], imageCopy.notice.trashed(1)).then((ok) => ok && onClose());
            }}
            className={cn(action, "hover:text-danger")}
          >
            <Trash2 className="size-4" strokeWidth={1.5} aria-hidden />
            {v.trash}
          </button>
        </div>

        {publishing ? <Publish asset={asset} onDone={() => onPublishing(false)} /> : null}
      </aside>
    </>
  );
}
