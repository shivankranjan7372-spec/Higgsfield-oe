"use client";

import {
  AudioLines,
  Check,
  ChevronRight,
  Film,
  ImagePlus,
  LoaderCircle,
  Mic,
  Pencil,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import {
  useRef,
  useState,
  useSyncExternalStore,
  type DragEvent,
  type ReactNode,
} from "react";
import { VendorGlyph } from "@/components/brand/logo";
import { AssetThumb, ControlField } from "@/components/studio";
import { formatCredits } from "@/config/economy";
import { routes } from "@/content/site";
import { videoCopy as t } from "@/content/video";
import type { Studio } from "@/lib/studio";
import {
  enabledOptions,
  type Control,
  type MediaSlot,
  type ModelDef,
} from "@/registry";
import {
  Artwork,
  ButtonLink,
  MenuItem,
  MenuLabel,
  Popover,
  PopoverContent,
  PopoverTrigger,
  cn,
} from "@/ui";
import { Segmented } from "./segmented";

/** The talking-presenter model: the registry lists it on both the video and avatar surfaces. */
export const isAvatar = (m: ModelDef | undefined) =>
  !!m && m.surfaces.includes("avatar");
/** Models that change footage you already have: they take a video in. */
export const editModels = (models: ModelDef[]) =>
  models.filter(
    (m) =>
      m.slots.some((s) => s.accept.includes("video")) ||
      /edit/i.test(m.statusNote ?? ""),
  );

const row =
  "flex w-full items-center gap-2 rounded-xl bg-border-subtle px-3 text-left transition-colors duration-150 hover:bg-border-default";

/** True when the form sits beside the gallery (1024 pixels and up), so menus can open to its right. */
const WIDE = "(min-width: 1024px)";
function useWide(): boolean {
  return useSyncExternalStore(
    (on) => {
      const q = window.matchMedia(WIDE);
      q.addEventListener("change", on);
      return () => q.removeEventListener("change", on);
    },
    () => window.matchMedia(WIDE).matches,
    () => true,
  );
}

/* ───────────────────────── model card and picker ───────────────────────── */

function ModelList({
  models,
  current,
  onPick,
}: {
  models: ModelDef[];
  current: string | undefined;
  onPick: (id: string) => void;
}) {
  return (
    <div
      role="listbox"
      aria-label="Models"
      className="scroll-quiet flex max-h-[min(480px,var(--radix-popover-content-available-height))] flex-col gap-1 overflow-y-auto p-2"
    >
      {models.map((m) => {
        const open = m.status === "available";
        const selected = m.id === current;
        return (
          <button
            key={m.id}
            type="button"
            role="option"
            aria-selected={selected}
            disabled={!open}
            onClick={() => onPick(m.id)}
            className={cn(
              "flex w-full items-center gap-2 rounded-xl p-[6px] text-left transition-colors duration-150 hover:bg-border-subtle disabled:pointer-events-none disabled:opacity-50",
              selected && "bg-border-subtle",
            )}
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-border-subtle">
              <VendorGlyph vendor={m.vendor} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="truncate text-xs leading-[18px] font-medium text-text-primary">
                {m.name}
              </span>
              <span className="truncate text-2xs leading-[14px] text-text-muted">
                {open ? m.tagline : (m.statusNote ?? "Not available yet")}
              </span>
            </span>
            {selected ? (
              <Check
                className="mr-1 size-4 shrink-0 text-brand"
                strokeWidth={1.5}
                aria-hidden
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** The picture card at the top of the form: the chosen model's name in lime, with a Change button. */
function ModelCard({
  model,
  onChange,
}: {
  model: ModelDef | undefined;
  onChange?: () => void;
}) {
  return (
    <div className="relative h-[130px] w-full shrink-0 overflow-clip rounded-xl">
      {model ? (
        <Artwork
          name={`video/model-${model.id}`}
          className="absolute inset-0 size-full rounded-sm"
        />
      ) : null}
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(180deg,#00000000_0%,#00000080_50%)]"
      />
      {onChange ? (
        <button
          type="button"
          onClick={onChange}
          className="absolute top-[6px] right-[6px] flex h-6 w-[81px] items-start justify-center gap-1 overflow-clip rounded-md border border-[#FFFFFF0F] bg-[#1B1B1B4C] pt-[3px] text-xs leading-4 font-medium text-text-primary backdrop-blur-[4.5px] transition-colors duration-150 hover:bg-[#1B1B1B99]"
        >
          <Pencil className="h-4 w-[14px]" strokeWidth={1.5} aria-hidden />
          {t.change}
        </button>
      ) : null}
      <div className="absolute inset-x-0 bottom-0 flex h-[58px] flex-col items-start pr-3 pl-3">
        <p className="w-full truncate font-display text-xl leading-[28px] font-bold tracking-[-0.01em] text-brand uppercase">
          {model?.name ?? "—"}
        </p>
        <p className="w-full truncate text-xs leading-[18px] text-[#FFFFFFCC]">
          {model
            ? model.status === "available"
              ? model.tagline
              : model.statusNote
            : ""}
        </p>
      </div>
    </div>
  );
}

/* ───────────────────────── drop zones ───────────────────────── */

function SlotIcon({ slot }: { slot: MediaSlot }) {
  const cls = "size-4";
  if (slot.id === "portrait")
    return <UserRound className={cls} strokeWidth={1.5} aria-hidden />;
  if (slot.id === "voice")
    return <Mic className={cls} strokeWidth={1.5} aria-hidden />;
  if (slot.accept.includes("audio"))
    return <AudioLines className={cls} strokeWidth={1.5} aria-hidden />;
  if (slot.accept.includes("video"))
    return <Film className={cls} strokeWidth={1.5} aria-hidden />;
  return <ImagePlus className={cls} strokeWidth={1.5} aria-hidden />;
}

const ACCEPT: Record<string, string> = {
  image: "image/*",
  video: "video/*",
  audio: "audio/*",
};

function DropZone({ slot, studio }: { slot: MediaSlot; studio: Studio }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [sending, setSending] = useState(0);
  const items = studio.attached[slot.id] ?? [];
  const copy = t.slotCopy[slot.id] ?? {
    title: [`Add ${slot.label.toLowerCase()}`, ""],
    hint: slot.hint ?? "",
  };
  const full = items.length >= slot.max;

  async function send(files: File[]) {
    if (!files.length) return;
    setSending(files.length);
    try {
      await studio.attach(slot, files);
    } finally {
      setSending(0);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setOver(false);
    void send(Array.from(e.dataTransfer.files));
  }

  return (
    <div
      className={cn(
        "flex h-[168px] w-full shrink-0 items-center justify-center rounded-xl bg-border-subtle transition-colors duration-150",
        over && "bg-border-default",
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      {items.length ? (
        <div
          className="relative flex h-[160px] w-[calc(100%-8px)] gap-1 overflow-clip rounded-md bg-surface-sunken"
          data-slot={slot.id}
        >
          {items.map((asset) => (
            <div
              key={asset.id}
              className="relative h-full min-w-0 flex-1 overflow-clip"
            >
              <AssetThumb asset={asset} />
              <button
                type="button"
                aria-label={`${t.remove} ${slot.label.toLowerCase()}`}
                onClick={() => studio.detach(slot.id, asset.id)}
                className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-md bg-[#00000080] text-text-primary backdrop-blur-sm transition-colors duration-150 hover:bg-[#000000B3]"
              >
                <X className="size-4" strokeWidth={1.5} aria-hidden />
              </button>
            </div>
          ))}
          <span className="pointer-events-none absolute bottom-2 left-2 rounded-xs bg-[#00000080] px-[6px] text-2xs leading-4 font-medium text-text-primary">
            {slot.label}
          </span>
        </div>
      ) : (
        <button
          type="button"
          disabled={full || sending > 0}
          onClick={() => input.current?.click()}
          aria-label={`${slot.label}: ${t.dropHint}`}
          className={cn(
            "group relative flex h-[160px] w-[calc(100%-8px)] flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border-default transition-colors duration-150 hover:border-border-strong disabled:cursor-progress",
            sending > 0 && "shimmer bg-surface-secondary",
          )}
        >
          <span className="relative flex size-9 items-center justify-center rounded-full border border-[#C5C5C54C] bg-[#1C1E20] text-text-primary">
            {sending > 0 ? (
              <LoaderCircle
                className="size-4 animate-spin"
                strokeWidth={1.5}
                aria-hidden
              />
            ) : (
              <SlotIcon slot={slot} />
            )}
          </span>
          <span className="flex flex-col items-center gap-[6px] px-4 text-center">
            <span className="flex flex-col items-center text-sm leading-4 font-semibold text-text-primary">
              <span>{sending > 0 ? t.uploading : copy.title[0]}</span>
              {sending > 0 ? null : <span>{copy.title[1]}</span>}
            </span>
            <span className="text-xs leading-4 text-text-secondary">
              {copy.hint}
            </span>
          </span>
        </button>
      )}
      <input
        ref={input}
        type="file"
        hidden
        accept={slot.accept.map((k) => ACCEPT[k]).join(",")}
        multiple={slot.max > 1}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          void send(files);
        }}
      />
    </div>
  );
}

/* ───────────────────────── prompt ───────────────────────── */

function MiniToggle({
  on,
  onToggle,
  label,
}: {
  on: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      className={cn(
        "relative h-4 w-[28px] shrink-0 overflow-clip rounded-xl transition-colors duration-150",
        on ? "bg-brand" : "bg-[#5C626A] hover:bg-toggle-track",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute top-[2px] left-[2px] size-3 rounded-md [box-shadow:#00000026_0px_1px_2px] transition-transform duration-150",
          on ? "translate-x-3 bg-ink" : "bg-text-primary",
        )}
      />
    </button>
  );
}

function PromptCard({ studio }: { studio: Studio }) {
  // Closed at rest, as drawn. It opens on its own once there is text (an example, a past job)
  // or when Generate was pressed without any.
  const [chosen, setOpen] = useState<boolean | null>(null);
  const open =
    chosen ??
    (studio.prompt.length > 0 ||
      (studio.errorCode === "blocked" && !studio.prompt.trim()));
  const label = studio.model?.prompt?.label ?? t.prompt;
  return (
    <div className="w-full shrink-0 overflow-clip rounded-xl bg-border-subtle">
      <div className="flex h-11 items-start justify-between px-3 pt-[13px]">
        <span className="text-sm leading-4 font-medium text-text-primary">
          {label}
        </span>
        <MiniToggle
          on={open}
          onToggle={() => setOpen(!open)}
          label={`Show ${label.toLowerCase()}`}
        />
      </div>
      {open ? (
        <div className="px-3 pb-3">
          <textarea
            value={studio.prompt}
            onChange={(e) => studio.setPrompt(e.target.value)}
            rows={4}
            maxLength={studio.model?.prompt?.maxLength}
            aria-label={label}
            placeholder={
              studio.model?.prompt?.placeholder ?? t.promptPlaceholder
            }
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                e.currentTarget
                  .closest("section")
                  ?.querySelector<HTMLButtonElement>("button[data-generate]")
                  ?.click();
              }
            }}
            className="scroll-quiet block w-full resize-none bg-transparent text-sm leading-5 text-text-soft outline-none placeholder:text-text-tertiary"
          />
        </div>
      ) : studio.prompt.trim() ? (
        <p className="-mt-1 truncate px-3 pb-3 text-xs leading-4 text-text-secondary">
          {studio.prompt}
        </p>
      ) : null}
    </div>
  );
}

/* ───────────────────────── option rows ───────────────────────── */

function valueText(control: Control, studio: Studio): string {
  const v = studio.values[control.id];
  if (control.type === "select")
    return control.options.find((o) => o.value === v)?.label ?? control.label;
  if (control.type === "slider")
    return `${Number(v ?? control.default)}${control.unit ?? ""}`;
  if (control.type === "toggle") return v === true ? "On" : "Off";
  return String(v ?? "").trim() ? String(v) : "—";
}

/** The 54-pixel row the design draws for "Model": a small label, the value, and a chevron. */
function RowFace({
  label,
  value,
  extra,
}: {
  label: string;
  value: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <>
      <span className="flex min-w-0 flex-1 flex-col items-start">
        <span className="text-xs leading-4 font-medium text-[#FFFFFF99]">
          {label}
        </span>
        <span className="flex h-5 w-full min-w-0 items-center gap-1 text-sm leading-5 font-medium text-text-soft">
          <span className="truncate">{value}</span>
          {extra}
        </span>
      </span>
      <ChevronRight
        className="size-4 shrink-0 text-text-primary"
        strokeWidth={1.5}
        aria-hidden
      />
    </>
  );
}

function OptionRow({ control, studio }: { control: Control; studio: Studio }) {
  const [open, setOpen] = useState(false);
  const wide = useWide();
  const shown = valueText(control, studio);
  if (control.type === "toggle") {
    const on = studio.values[control.id] === true;
    return (
      <div
        className={cn(row, "h-[54px] justify-between hover:bg-border-subtle")}
      >
        <span className="flex min-w-0 flex-col">
          <span className="text-xs leading-4 font-medium text-[#FFFFFF99]">
            {control.label}
          </span>
          <span className="text-sm leading-5 font-medium text-text-soft">
            {on ? "On" : "Off"}
          </span>
        </span>
        <MiniToggle
          on={on}
          onToggle={() => studio.setValue(control.id, !on)}
          label={control.label}
        />
      </div>
    );
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={`${control.label}: ${shown}`}
        className={cn(row, "h-[54px] data-[state=open]:bg-border-default")}
      >
        <RowFace label={control.label} value={shown} />
      </PopoverTrigger>
      <PopoverContent
        side={wide ? "right" : "bottom"}
        align="start"
        className="w-[240px] max-w-[calc(100vw-16px)]"
      >
        {control.type === "select" ? (
          <>
            <MenuLabel>{control.label}</MenuLabel>
            <div
              role="menu"
              aria-label={control.label}
              className="scroll-quiet max-h-[288px] overflow-y-auto"
            >
              {control.options.map((option) => (
                <MenuItem
                  key={option.value}
                  selected={option.value === studio.values[control.id]}
                  disabled={
                    !enabledOptions(
                      control,
                      studio.values,
                      studio.filled,
                    ).includes(option)
                  }
                  hint={option.hint}
                  onClick={() => {
                    studio.setValue(control.id, option.value);
                    setOpen(false);
                  }}
                >
                  {option.label}
                </MenuItem>
              ))}
            </div>
            {control.hint ? (
              <p className="px-2 pt-1 pb-2 text-xs leading-4 text-text-secondary">
                {control.hint}
              </p>
            ) : null}
          </>
        ) : (
          <ControlField control={control} studio={studio} />
        )}
      </PopoverContent>
    </Popover>
  );
}

function MoreRow({
  controls,
  studio,
}: {
  controls: Control[];
  studio: Studio;
}) {
  const wide = useWide();
  if (!controls.length) return null;
  return (
    <Popover>
      <PopoverTrigger
        className={cn(row, "h-[54px] data-[state=open]:bg-border-default")}
      >
        <RowFace
          label={t.moreSettings}
          value={controls.map((c) => c.label).join(", ")}
        />
      </PopoverTrigger>
      <PopoverContent
        side={wide ? "right" : "top"}
        align="end"
        className="w-[280px] max-w-[calc(100vw-16px)]"
      >
        <MenuLabel>{t.moreSettings}</MenuLabel>
        <div className="scroll-quiet flex max-h-[320px] flex-col gap-1 overflow-y-auto">
          {controls.map((c) => (
            <ControlField key={c.id} control={c} studio={studio} />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ───────────────────────── generate ───────────────────────── */

function GenerateBar({
  studio,
  signedOut,
  onSignIn,
  onGenerate,
}: {
  studio: Studio;
  signedOut: boolean;
  onSignIn: () => void;
  onGenerate: () => void;
}) {
  const price = studio.quote ? formatCredits(studio.quote.millicredits) : null;
  const label = signedOut ? t.signIn : t.generate;
  return (
    <button
      type="button"
      disabled={studio.busy}
      data-generate
      aria-disabled={studio.blocker ? true : undefined}
      aria-label={price && !signedOut ? `${label}, ${price} credits` : label}
      onClick={() => (signedOut ? onSignIn() : onGenerate())}
      className="flex h-12 w-full shrink-0 items-start justify-center gap-2 overflow-clip rounded-xl bg-brand bg-[radial-gradient(circle_farthest-corner_at_50%_50%,#EFFE17_40%,#D1FE17_100%)] pt-[11px] [box-shadow:#0000006E_0px_-3px_0px_inset] transition-[filter] duration-150 hover:brightness-105 active:brightness-90 disabled:cursor-progress"
    >
      <span className="text-sm leading-5 font-semibold text-ink">{label}</span>
      {signedOut ? null : (
        <span className="flex h-5 items-center gap-[2px] text-sm leading-5 font-medium text-ink/70">
          {studio.busy ? (
            <LoaderCircle
              className="size-4 animate-spin"
              strokeWidth={2}
              aria-hidden
            />
          ) : price ? (
            <>
              <Sparkles
                className="size-3 fill-current"
                strokeWidth={1.5}
                aria-hidden
              />
              {price}
            </>
          ) : null}
        </span>
      )}
    </button>
  );
}

function Problem({ studio }: { studio: Studio }) {
  if (!studio.error) return null;
  const needsAccount =
    studio.errorCode === "account_required" ||
    studio.errorCode === "unauthorized";
  const needsCredits = studio.errorCode === "insufficient_credits";
  return (
    <div
      role="alert"
      className="flex w-full items-start gap-2 rounded-xl border border-[#FF6B6B40] bg-[#FF6B6B14] px-3 py-2 text-xs leading-4 text-text-primary"
    >
      <p className="min-w-0 flex-1 py-[2px]">{studio.error}</p>
      {needsAccount ? (
        <ButtonLink
          href={`${routes.join}?next=${encodeURIComponent(routes.video)}`}
          variant="lime"
          size="xs"
        >
          {t.createAccount}
        </ButtonLink>
      ) : needsCredits ? (
        <ButtonLink href={routes.pricing} variant="lime" size="xs">
          Get credits
        </ButtonLink>
      ) : null}
      <button
        type="button"
        aria-label={t.dismiss}
        onClick={studio.clearError}
        className="flex size-5 shrink-0 items-center justify-center rounded-xs text-text-tab hover:text-text-primary"
      >
        <X className="size-4" strokeWidth={1.5} aria-hidden />
      </button>
    </div>
  );
}

/* ───────────────────────── the panel ───────────────────────── */

export type FormTab = "create" | "edit";

export function VideoForm({
  studio,
  tab,
  onTab,
  signedOut,
  onSignIn,
  onGenerate,
}: {
  studio: Studio;
  tab: FormTab;
  onTab: (tab: FormTab) => void;
  signedOut: boolean;
  onSignIn: () => void;
  onGenerate: () => void;
}) {
  const [picking, setPicking] = useState(false);
  const wide = useWide();
  const avatarMode = isAvatar(studio.model);
  const listed = studio.models.filter(
    (m) => isAvatar(m) === avatarMode && !editModels([m]).length,
  );
  const edits = editModels(studio.models);
  const clipDefault = studio.models.find(
    (m) => !isAvatar(m) && m.status === "available" && !editModels([m]).length,
  );
  const avatarModel = studio.models.find(isAvatar);

  // Coming back from the avatar, return to the clip model that was in use.
  const [lastClip, setLastClip] = useState<string | null>(null);
  function setMode(mode: "clip" | "avatar") {
    if (mode === "avatar" && avatarModel && !avatarMode) {
      setLastClip(studio.model?.id ?? null);
      studio.pickModel(avatarModel.id);
    }
    const back = lastClip ?? clipDefault?.id;
    if (mode === "clip" && back && avatarMode) studio.pickModel(back);
  }

  const tabs: { id: FormTab; label: string }[] = [
    { id: "create", label: t.tabs.create },
    ...(edits.length ? [{ id: "edit" as const, label: t.tabs.edit }] : []),
  ];

  return (
    <section
      aria-label="Video settings"
      className="flex w-full shrink-0 flex-col items-center overflow-clip rounded-3xl border border-[#D9D9D90A] bg-surface-shell lg:h-full lg:w-[320px]"
    >
      <div
        role="tablist"
        aria-label="Mode"
        className="flex h-12 w-full shrink-0 items-start gap-3 overflow-clip pt-3 pl-4"
      >
        {tabs.map((item) => {
          const on = item.id === tab;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => onTab(item.id)}
              className={cn(
                "flex h-9 shrink-0 items-start text-sm leading-5 font-medium transition-colors duration-150",
                on
                  ? "border-b-2 border-text-primary text-text-primary"
                  : "text-[#FFFFFF99] hover:text-text-primary",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === "edit" ? (
        <div className="flex w-full flex-1 flex-col gap-4 p-2">
          <ModelCard model={edits[0]} />
          <div className="flex flex-col gap-2 rounded-xl bg-border-subtle px-3 py-4">
            <p className="text-sm leading-5 font-semibold text-text-primary">
              {t.edit.title}
            </p>
            <p className="text-xs leading-4 text-text-secondary">
              {t.edit.body}
            </p>
            <ul className="mt-1 flex flex-col gap-1">
              {edits.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-2 text-xs leading-4"
                >
                  <span className="truncate text-text-primary">{m.name}</span>
                  <span className="shrink-0 text-text-tertiary">
                    {m.status === "soon"
                      ? "Soon"
                      : m.status === "offline"
                        ? "Offline"
                        : "Open"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <button
            type="button"
            onClick={() => onTab("create")}
            className={cn(
              row,
              "h-11 justify-center px-3 text-sm leading-5 font-medium text-text-primary",
            )}
          >
            {t.edit.back}
          </button>
        </div>
      ) : (
        <>
          <div className="scroll-quiet flex w-full min-h-0 flex-1 flex-col gap-2 px-2 pt-2 lg:overflow-y-auto">
            <ModelCard model={studio.model} onChange={() => setPicking(true)} />
            {avatarModel ? (
              <div className="mt-2">
                <Segmented
                  label="Kind of video"
                  value={avatarMode ? "avatar" : "clip"}
                  onChange={(v) => setMode(v as "clip" | "avatar")}
                  items={[
                    { value: "clip", label: t.modes.clip, icon: Film },
                    { value: "avatar", label: t.modes.avatar, icon: UserRound },
                  ]}
                  wide
                />
              </div>
            ) : null}
            {studio.slots.map((slot) => (
              <DropZone key={slot.id} slot={slot} studio={studio} />
            ))}
            {studio.model?.prompt ? <PromptCard studio={studio} /> : null}
            <div className="mt-2 flex flex-col gap-2">
              <Popover open={picking} onOpenChange={setPicking}>
                <PopoverTrigger
                  aria-label={`${t.model}: ${studio.model?.name ?? "none"}`}
                  className={cn(
                    row,
                    "h-[54px] data-[state=open]:bg-border-default",
                  )}
                >
                  <RowFace
                    label={t.model}
                    value={studio.model?.name ?? "—"}
                    extra={
                      studio.model?.featured ? (
                        <Sparkles
                          className="size-4 shrink-0 text-brand"
                          strokeWidth={1.5}
                          aria-hidden
                        />
                      ) : null
                    }
                  />
                </PopoverTrigger>
                <PopoverContent
                  look="panel"
                  side={wide ? "right" : "bottom"}
                  align={wide ? "end" : "start"}
                  className="w-[360px] max-w-[calc(100vw-16px)]"
                >
                  <ModelList
                    models={listed}
                    current={studio.model?.id}
                    onPick={(id) => {
                      studio.pickModel(id);
                      setPicking(false);
                    }}
                  />
                </PopoverContent>
              </Popover>
              {studio.controls.main.map((control) => (
                <OptionRow key={control.id} control={control} studio={studio} />
              ))}
              <MoreRow controls={studio.controls.advanced} studio={studio} />
            </div>
            <div className="h-2 shrink-0" />
          </div>
          <div className="flex w-full shrink-0 flex-col items-center gap-2 rounded-b-2xl px-2 pt-0 pb-3">
            <Problem studio={studio} />
            <GenerateBar
              studio={studio}
              signedOut={signedOut}
              onSignIn={onSignIn}
              onGenerate={onGenerate}
            />
          </div>
        </>
      )}
    </section>
  );
}
