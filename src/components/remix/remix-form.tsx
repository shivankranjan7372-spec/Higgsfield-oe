"use client";

import {
  ChevronRight,
  ImagePlus,
  Mountain,
  Sparkles,
  Shirt,
  User,
  X,
} from "lucide-react";
import { useRef, useState, type DragEvent, type ReactNode } from "react";
import { LoginDialog } from "@/components/entry/login-dialog";
import { formatCredits } from "@/config/economy";
import { remixCopy, remixModes, type RemixModeId } from "@/content/remix";
import { routes } from "@/content/site";
import type { Asset } from "@/lib/api";
import type { Studio } from "@/lib/studio";
import { enabledOptions, type MediaSlot } from "@/registry";
import {
  ButtonLink,
  MenuItem,
  MenuLabel,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Spinner,
  cn,
} from "@/ui";
import type { Failure } from "./use-remix";

const copy = remixCopy;

/* The round glass icon the drop zones draw: 36px, #1C1E20 under a faint grey ring. */
function Bubble({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative flex size-9 shrink-0 items-center justify-center rounded-full bg-[#1C1E20] text-text-primary",
        className,
      )}
    >
      <span
        aria-hidden
        className="absolute inset-0 rounded-full border border-[#C5C5C54C] bg-[#FFFFFF0A] mix-blend-luminosity backdrop-blur-[4px]"
      />
      <span className="relative">{children}</span>
    </span>
  );
}

const icon = "size-4";

/**
 * One 302 by 168 drop zone: a 294 by 160 dashed box on a faint panel. Click or drop a file to
 * fill it; once filled it shows the picture with a remove button.
 */
function DropZone({
  studio,
  slot,
  title,
  hint,
  removeLabel,
  art,
  centred,
}: {
  studio: Studio;
  slot: MediaSlot;
  title: readonly string[];
  hint: string;
  removeLabel: string;
  art: ReactNode;
  centred?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const file: Asset | undefined = studio.attached[slot.id]?.[0];
  const loading = studio.uploading > 0 && !file;

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setOver(false);
    const files = [...e.dataTransfer.files];
    if (files.length) void studio.attach(slot, files);
  }

  return (
    <div
      className={cn(
        "flex h-[168px] shrink-0 items-center justify-center rounded-xl bg-border-subtle transition-colors duration-150",
        over && "bg-border-default",
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      <input
        ref={input}
        type="file"
        accept={slot.accept.map((k) => `${k}/*`).join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          if (files.length) void studio.attach(slot, files);
        }}
      />
      {file ? (
        <div className="relative h-[160px] w-[calc(100%-8px)] overflow-clip rounded-md">
          {/* A member's own upload, served behind the session cookie. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={file.posterUrl ?? file.url}
            alt={slot.label}
            className="size-full object-cover"
          />
          <button
            type="button"
            aria-label={removeLabel}
            onClick={() => studio.detach(slot.id, file.id)}
            className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-md bg-[#00000080] text-text-primary backdrop-blur-sm transition-colors duration-150 hover:bg-[#000000B3]"
          >
            <X className={icon} strokeWidth={1.5} aria-hidden />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={loading}
          aria-label={`${title.join(" ")}. ${hint}`}
          className={cn(
            "flex h-[160px] w-[calc(100%-8px)] flex-col items-center gap-3 rounded-md border border-dashed border-[#FFFFFF24] px-4 transition-colors duration-150 hover:border-border-strong hover:bg-border-subtle",
            centred ? "justify-center" : "pt-[29px]",
          )}
        >
          {loading ? (
            <Bubble>
              <Spinner label={copy.source.uploading} />
            </Bubble>
          ) : (
            art
          )}
          <span className="flex flex-col items-center gap-[6px] text-center">
            <span className="flex flex-col items-center text-sm leading-4 font-semibold text-text-primary">
              {title.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </span>
            <span className="text-xs leading-4 text-text-secondary">
              {loading ? copy.source.uploading : hint}
            </span>
          </span>
        </button>
      )}
    </div>
  );
}

/* The Mode and Quality rows: a 54px panel with a small label over the value and a chevron. */
const rowClass =
  "flex h-[54px] w-full shrink-0 items-center gap-2 rounded-xl bg-border-subtle px-3 text-left transition-colors duration-150 hover:bg-border-default data-[state=open]:bg-border-default";

function Row({
  label,
  value,
  ...rest
}: { label: string; value: string } & React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={rowClass}
      aria-label={`${label}: ${value}`}
      {...rest}
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-xs leading-4 font-medium text-[#FFFFFF99]">
          {label}
        </span>
        <span className="truncate text-sm leading-5 font-medium text-text-soft">
          {value}
        </span>
      </span>
      <ChevronRight
        className="size-4 shrink-0 text-text-secondary"
        strokeWidth={1.5}
        aria-hidden
      />
    </button>
  );
}

function ModeRow({ studio, mode }: { studio: Studio; mode: RemixModeId }) {
  const [open, setOpen] = useState(false);
  const current = remixModes.find((m) => m.id === mode) ?? remixModes[0];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Row label={copy.mode} value={current.label} />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)]">
        <MenuLabel>{copy.mode}</MenuLabel>
        {remixModes.map((m) => {
          const model = studio.models.find((x) => x.id === m.modelId);
          return (
            <MenuItem
              key={m.id}
              selected={m.id === mode}
              hint={model ? model.name : undefined}
              onClick={() => {
                studio.pickModel(m.modelId);
                setOpen(false);
              }}
            >
              {m.label}
            </MenuItem>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

function QualityRow({ studio }: { studio: Studio }) {
  const [open, setOpen] = useState(false);
  const control = [...studio.controls.main, ...studio.controls.advanced].find(
    (c) => c.id === "resolution",
  );
  if (!control || control.type !== "select") return null;
  const options = enabledOptions(control, studio.values, studio.filled);
  const value = String(studio.values.resolution ?? control.default);
  const label = control.options.find((o) => o.value === value)?.label ?? value;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Row label={copy.quality} value={label} />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)]">
        <MenuLabel>{copy.quality}</MenuLabel>
        {control.options.map((o) => (
          <MenuItem
            key={o.value}
            selected={o.value === value}
            disabled={!options.some((e) => e.value === o.value)}
            hint={o.hint}
            onClick={() => {
              studio.setValue("resolution", o.value);
              setOpen(false);
            }}
          >
            {o.label}
          </MenuItem>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function Problem({
  failure,
  onClose,
}: {
  failure: Failure;
  onClose: () => void;
}) {
  const [join, setJoin] = useState(false);
  const needsAccount = failure.status === 401 || failure.status === 403;
  const needsCredits = failure.code === "insufficient_credits";
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-[#FF6B6B40] bg-[#FF6B6B14] p-3 text-xs leading-4 text-text-primary"
    >
      <p className="min-w-0 flex-1">{failure.message}</p>
      {needsAccount ? (
        <>
          <button
            type="button"
            onClick={() => setJoin(true)}
            className="shrink-0 font-semibold text-brand hover:underline"
          >
            {copy.history.createAccount}
          </button>
          <LoginDialog
            open={join}
            onOpenChange={setJoin}
            mode="join"
            next={routes.remix}
          />
        </>
      ) : null}
      {needsCredits ? (
        <ButtonLink href={routes.pricing} variant="tint" size="xs">
          Get credits
        </ButtonLink>
      ) : null}
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onClose}
        className="shrink-0 text-text-secondary hover:text-text-primary"
      >
        <X className="size-4" strokeWidth={1.5} aria-hidden />
      </button>
    </div>
  );
}

/**
 * The Prompt row, as drawn: 44px with a 28 by 16 switch, off at first. On, it opens a box to
 * write in, which takes whatever room the panel has left. Off, the page sends a plain
 * direction of its own.
 */
function PromptCard({
  studio,
  on,
  onToggle,
  onEnter,
}: {
  studio: Studio;
  on: boolean;
  onToggle: (on: boolean) => void;
  onEnter: () => void;
}) {
  // Set by a press on the switch, so the box takes the cursor only when the person opened it.
  const focusNext = useRef(false);
  const max = studio.model?.prompt?.maxLength ?? 0;
  return (
    <div
      className={cn(
        "flex shrink-0 flex-col overflow-clip rounded-xl bg-border-subtle",
        on && "min-h-[104px] lg:max-h-[144px] lg:min-h-[84px] lg:flex-1",
      )}
    >
      <div
        className={cn(
          "flex shrink-0 items-start justify-between px-3 pt-[13px]",
          on ? "h-9" : "h-11",
        )}
      >
        <label
          htmlFor="remix-prompt-switch"
          className="text-sm leading-4 font-medium text-text-primary"
        >
          {copy.prompt.label}
        </label>
        <span className="flex items-center gap-2">
          {on ? (
            <span
              className="font-mono text-2xs leading-4 text-text-tertiary"
              aria-label={`${studio.prompt.length} of ${max} characters`}
            >
              {studio.prompt.length}/{max}
            </span>
          ) : null}
          <button
            type="button"
            id="remix-prompt-switch"
            role="switch"
            aria-checked={on}
            onClick={() => {
              focusNext.current = !on;
              onToggle(!on);
            }}
            className={cn(
              "relative h-4 w-7 shrink-0 rounded-xl transition-colors duration-150",
              on ? "bg-brand" : "bg-[#5C626A]",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "absolute top-[2px] left-[2px] size-3 rounded-full transition-transform duration-150 [box-shadow:#00000026_0px_1px_2px]",
                on ? "translate-x-3 bg-ink" : "bg-text-primary",
              )}
            />
          </button>
        </span>
      </div>
      {on ? (
        <textarea
          id="remix-prompt"
          ref={(box) => {
            if (box && focusNext.current) {
              focusNext.current = false;
              box.focus();
            }
          }}
          value={studio.prompt}
          maxLength={max || undefined}
          rows={2}
          aria-label={copy.prompt.label}
          placeholder={copy.prompt.placeholder}
          onChange={(e) => studio.setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onEnter();
            }
          }}
          className="scroll-quiet min-h-10 flex-1 resize-none bg-transparent px-3 pb-2 text-sm leading-5 text-text-primary outline-none placeholder:text-text-tertiary focus-visible:outline-none"
        />
      ) : null}
    </div>
  );
}

/**
 * The left column: the wordmark, then the form (source picture, end picture, the Prompt
 * switch, Mode, Quality) and Generate pinned under it. Mode and Quality sit right over
 * Generate, as drawn, whatever the height of the window.
 */
export function RemixForm({
  studio,
  mode,
  busy,
  blocked,
  promptOn,
  onPromptToggle,
  failure,
  onDismiss,
  onGenerate,
}: {
  studio: Studio;
  mode: RemixModeId;
  busy: boolean;
  /** Something is still missing, so a press on Generate will say what. */
  blocked: boolean;
  promptOn: boolean;
  onPromptToggle: (on: boolean) => void;
  failure: Failure | null;
  onDismiss: () => void;
  onGenerate: () => void;
}) {
  const start = studio.slots.find((s) => s.id === "start");
  const end = studio.slots.find((s) => s.id === "end");

  return (
    <section
      aria-label="Remix settings"
      className="relative flex w-full shrink-0 flex-col lg:mb-8 lg:min-h-0 lg:w-[320px]"
    >
      <header className="flex h-[110px] shrink-0 justify-center rounded-t-3xl bg-linear-to-b from-[#FFFFFF0D] to-[#FFFFFF03] pt-2">
        <div className="flex h-[58px] flex-col items-center justify-center gap-1">
          <p className="text-2xs leading-[14px] tracking-[0.02em] text-[#FFFFFF99]">
            {copy.kicker}
          </p>
          <h1 className="text-chrome font-display text-[34px] leading-6 font-bold tracking-[0.02em] uppercase">
            {copy.wordmark}
          </h1>
        </div>
      </header>
      <form
        className="-mt-4 flex min-h-0 flex-1 flex-col overflow-clip rounded-3xl border border-border-default bg-border-subtle backdrop-blur-[40px]"
        onSubmit={(e) => {
          e.preventDefault();
          onGenerate();
        }}
        onPaste={(e) => {
          const files = [...e.clipboardData.files];
          if (files.length) void studio.drop(files);
        }}
      >
        <div className="scroll-quiet flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2">
          {start ? (
            <DropZone
              studio={studio}
              slot={start}
              title={copy.source.title}
              hint={copy.source.hint}
              removeLabel={copy.source.replace}
              art={
                <Bubble>
                  <ImagePlus className={icon} strokeWidth={1.5} aria-hidden />
                </Bubble>
              }
            />
          ) : null}
          {end ? (
            <DropZone
              studio={studio}
              slot={end}
              centred
              title={copy.ending.title}
              hint={copy.ending.hint}
              removeLabel={copy.ending.replace}
              art={
                <span className="flex" aria-hidden>
                  <Bubble>
                    <User className={icon} strokeWidth={1.5} />
                  </Bubble>
                  <Bubble className="-ml-2">
                    <Shirt className={icon} strokeWidth={1.5} />
                  </Bubble>
                  <Bubble className="-ml-2">
                    <Mountain className={icon} strokeWidth={1.5} />
                  </Bubble>
                </span>
              }
            />
          ) : null}
          {studio.model?.prompt ? (
            <PromptCard
              studio={studio}
              on={promptOn}
              onToggle={onPromptToggle}
              onEnter={onGenerate}
            />
          ) : null}
          <div className="mt-auto flex shrink-0 flex-col gap-2 pt-2">
            <ModeRow studio={studio} mode={mode} />
            <QualityRow studio={studio} />
          </div>
          {failure ? <Problem failure={failure} onClose={onDismiss} /> : null}
          {studio.error ? (
            <Problem
              failure={{
                message: studio.error,
                code: studio.errorCode ?? "error",
                status: 0,
              }}
              onClose={studio.clearError}
            />
          ) : null}
        </div>
        <div className="flex h-[60px] shrink-0 justify-center px-2">
          <button
            type="submit"
            disabled={busy}
            aria-disabled={blocked || undefined}
            aria-label={
              studio.quote
                ? `${copy.generate}, ${formatCredits(studio.quote.millicredits)} credits`
                : copy.generate
            }
            className={cn(
              "flex h-12 w-full items-start justify-center rounded-xl bg-brand bg-[radial-gradient(circle_farthest-corner_at_50%_50%,#EFFE17_40%,#D1FE17_100%)] pt-[11px] text-sm leading-5 font-semibold text-ink [box-shadow:#0000006E_0px_-3px_0px_inset] transition-[filter,opacity] duration-150 hover:brightness-105 active:brightness-95",
              busy && "cursor-progress",
            )}
          >
            <span className="flex h-5 items-center gap-2">
              {busy ? <Spinner label="Sending" /> : null}
              {copy.generate}
              {studio.quote ? (
                <span
                  aria-hidden
                  className="flex items-center gap-[2px] text-xs font-medium opacity-70"
                >
                  <Sparkles
                    className="size-3 fill-current"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                  {formatCredits(studio.quote.millicredits)}
                </span>
              ) : null}
            </span>
          </button>
        </div>
      </form>
    </section>
  );
}
