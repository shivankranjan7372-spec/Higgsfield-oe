"use client";

import {
  AtSign,
  ChevronRight,
  Clock,
  Film,
  Focus,
  ImageIcon,
  LoaderCircle,
  Minus,
  Plus,
  RectangleHorizontal,
  Sparkles,
  Video,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { VendorGlyph } from "@/components/brand/logo";
import { formatCredits, MAX_BATCH } from "@/config/economy";
import { cinema } from "@/content/cinema";
import { Artwork, MenuItem, MenuLabel, Popover, PopoverContent, PopoverTrigger, cn } from "@/ui";
import { CastPicker } from "./cast";
import type { Preset } from "./data";
import { useCinema, type ShotFields } from "./state";

const c = cinema.composer;

/** The 10px mono label over each parameter card, in the drawn fade. */
function CardLabel({ children }: { children: ReactNode }) {
  return (
    <span className="block bg-clip-text font-mono text-2xs leading-[14px] font-medium whitespace-nowrap text-transparent [background-image:linear-gradient(0deg,#FFFFFF66_0%,#FFFFFF1A_100%)]">
      {children}
    </span>
  );
}

/** The framed 32px picture at the left of a card. */
function Thumb({ wide, children }: { wide?: boolean; children: ReactNode }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative h-8 shrink-0 rounded-md bg-[#0F0F10] [box-shadow:#00000014_0px_-4px_8px]",
        wide ? "w-10" : "w-8",
      )}
      style={{ backgroundImage: "linear-gradient(180deg, #FFFFFF24 0%, #FFFFFF0D 15%, #FFFFFF08 65%, #FFFFFF24 100%)" }}
    >
      <span className="absolute inset-px rounded-[7px] bg-page" />
      <span className="absolute inset-1 overflow-clip rounded-[5px] bg-black [box-shadow:#FFFFFF1F_0px_1px_2px_inset]">{children}</span>
    </span>
  );
}

const cardClass =
  "flex h-12 min-w-0 shrink-0 items-center gap-2 overflow-clip rounded-2xl bg-border-subtle pr-3 pl-2 text-left transition-colors duration-150 hover:bg-border-default data-[state=open]:bg-border-default";

function PresetRow({ label, options, value, onPick }: { label: string; options: Preset[]; value: string; onPick: (id: string) => void }) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-1">
      <MenuLabel className="h-6 px-1">{label}</MenuLabel>
      <div className="flex flex-wrap gap-1">
        {[{ id: "", label: c.none, phrase: "" }, ...options].map((o) => (
          <button
            key={o.id || "auto"}
            type="button"
            role="menuitemradio"
            aria-checked={value === o.id}
            onClick={() => onPick(o.id)}
            className={cn(
              "h-7 rounded-md px-[10px] text-xs leading-4 font-medium transition-colors duration-150",
              value === o.id ? "bg-brand-tint text-brand" : "bg-border-subtle text-text-primary hover:bg-border-default",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function labelOf(options: Preset[] | undefined, id: string) {
  return options?.find((o) => o.id === id)?.label ?? "";
}

/** One parameter card and the panel of choices behind it. */
function ParamCard({
  label,
  value,
  thumb,
  wide,
  width,
  children,
}: {
  label: string;
  value: string;
  thumb: ReactNode;
  wide?: boolean;
  width: string;
  children: ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label={`${label}: ${value}`} className={cn(cardClass, width)}>
          <Thumb wide={wide}>{thumb}</Thumb>
          <span className="flex min-w-0 flex-col">
            <CardLabel>{label}</CardLabel>
            <span className="truncate text-sm leading-5 font-medium text-text-primary">{value}</span>
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent look="panel" className="scroll-quiet flex max-h-[min(460px,70dvh)] w-[min(380px,calc(100vw-16px))] flex-col gap-3 overflow-y-auto p-3">
        {children}
      </PopoverContent>
    </Popover>
  );
}

function ParamCards() {
  const { catalog, fields, look, patchShot, patchProject } = useCinema();
  const p = catalog?.presets;
  const camera = [labelOf(p?.shot.size, fields.size), labelOf(p?.shot.angle, fields.angle), labelOf(p?.shot.lens, fields.lens)].filter(Boolean);
  const film = [labelOf(p?.look.filmStock, look.filmStock), labelOf(p?.look.lensFamily, look.lensFamily)].filter(Boolean);
  const light = [labelOf(p?.shot.lighting, fields.lighting) || labelOf(p?.look.lighting, look.lighting), labelOf(p?.shot.mood, fields.mood)].filter(Boolean);
  const setShot = (k: keyof ShotFields) => (id: string) => void patchShot({ [k]: id });
  const castCount = fields.castIds.length;

  return (
    <div className="scroll-none flex h-14 w-full items-center gap-1 overflow-x-auto px-1 sm:justify-center sm:px-0">
      <CastPicker
        trigger={
          <button type="button" aria-label={`${c.cards.cast}: ${castCount}`} className={cn(cardClass, "w-[128px]")}>
            <Thumb>
              <span className="flex size-full items-center justify-center [background-image:linear-gradient(0deg,#FFFFFF03_0%,#FFFFFF1A_100%)]">
                <Plus className="size-[18px] text-text-primary" strokeWidth={1.5} />
              </span>
            </Thumb>
            <span className="flex min-w-0 flex-col">
              <CardLabel>{c.cards.cast}</CardLabel>
              <span className="text-sm leading-5 font-medium text-text-primary">
                {castCount}
                <span>/</span>
                {12}
              </span>
            </span>
          </button>
        }
      />
      <ParamCard label={c.cards.film} value={film.join(", ") || c.auto} width="w-[160px]" thumb={<Artwork name="cinema/card-film" className="size-full" />}>
        <PresetRow label={c.groups.filmStock} options={p?.look.filmStock ?? []} value={look.filmStock} onPick={(id) => void patchProject({ look: { filmStock: id } })} />
        <PresetRow label={c.groups.lensFamily} options={p?.look.lensFamily ?? []} value={look.lensFamily} onPick={(id) => void patchProject({ look: { lensFamily: id } })} />
      </ParamCard>
      <ParamCard label={c.cards.camera} value={camera.join(", ") || c.auto} width="w-[160px]" thumb={<Artwork name="cinema/card-camera" className="size-full" />}>
        <PresetRow label={c.groups.size} options={p?.shot.size ?? []} value={fields.size} onPick={setShot("size")} />
        <PresetRow label={c.groups.angle} options={p?.shot.angle ?? []} value={fields.angle} onPick={setShot("angle")} />
        <PresetRow label={c.groups.lens} options={p?.shot.lens ?? []} value={fields.lens} onPick={setShot("lens")} />
        <PresetRow label={c.groups.focus} options={p?.shot.focus ?? []} value={fields.focus} onPick={setShot("focus")} />
      </ParamCard>
      <ParamCard label={c.cards.grade} value={labelOf(p?.look.grade, look.grade) || c.auto} wide width="w-[160px]" thumb={<Artwork name="cinema/card-grade" className="size-full" />}>
        <PresetRow label={c.groups.grade} options={p?.look.grade ?? []} value={look.grade} onPick={(id) => void patchProject({ look: { grade: id } })} />
      </ParamCard>
      <ParamCard label={c.cards.lighting} value={light.join(", ") || c.auto} wide width="w-[160px]" thumb={<Artwork name="cinema/card-lighting" className="size-full" />}>
        <PresetRow label={c.groups.lighting} options={p?.shot.lighting ?? []} value={fields.lighting} onPick={setShot("lighting")} />
        <PresetRow label={c.groups.lightingLook} options={p?.look.lighting ?? []} value={look.lighting} onPick={(id) => void patchProject({ look: { lighting: id } })} />
        <PresetRow label={c.groups.mood} options={p?.shot.mood ?? []} value={fields.mood} onPick={setShot("mood")} />
      </ParamCard>
    </div>
  );
}

const toolClass =
  "flex h-7 shrink-0 items-center justify-center gap-1 rounded-md bg-border-subtle px-2 text-xs leading-4 font-medium tracking-[0.0167em] whitespace-nowrap text-text-primary transition-colors duration-150 hover:bg-border-default data-[state=open]:bg-border-default disabled:opacity-40";

function MenuChip({ label, trigger, children, className }: { label: string; trigger: ReactNode; children: (close: () => void) => ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label={label} className={cn(toolClass, className)}>
          {trigger}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px]">{children(() => setOpen(false))}</PopoverContent>
    </Popover>
  );
}

const DURATIONS = [3, 4, 5, 6, 8, 10, 12, 15];

function Toolbar() {
  const { catalog, fields, patchShot, aspect, patchProject, output, model, patchProject: patch, stillModelId, videoModelId, count, setCount, setCastOpen, project } = useCinema();
  const [modelOpen, setModelOpen] = useState(false);
  const [sound, setSound] = useState(fields.sound);
  const [seenSound, setSeenSound] = useState(fields.sound);
  if (seenSound !== fields.sound) {
    setSeenSound(fields.sound);
    setSound(fields.sound);
  }
  const list = output === "image" ? catalog?.models.still : catalog?.models.video;
  const current = output === "image" ? stillModelId : videoModelId;

  return (
    <div className="scroll-none flex h-7 items-center gap-1 overflow-x-auto">
      <div className="flex h-7 shrink-0 items-center overflow-clip rounded-md bg-border-subtle">
        <button
          type="button"
          aria-label={c.addCast}
          disabled={!project}
          onClick={() => setCastOpen(true)}
          className="flex size-7 items-center justify-center text-text-primary transition-colors duration-150 hover:bg-border-default disabled:opacity-40"
        >
          <Plus className="size-4" strokeWidth={1.5} aria-hidden />
        </button>
        <span aria-hidden className="h-4 w-px bg-border-default" />
        <CastPicker
          trigger={
            <button type="button" aria-label={c.attachCast} className="flex size-7 items-center justify-center text-text-primary transition-colors duration-150 hover:bg-border-default">
              <AtSign className="size-4" strokeWidth={1.5} aria-hidden />
            </button>
          }
        />
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" aria-label={c.movement} className={cn(toolClass, "w-7 px-0", fields.movement && "text-brand")}>
            <Focus className="size-4" strokeWidth={1.5} aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent look="panel" className="w-[min(380px,calc(100vw-16px))] p-3">
          <PresetRow label={c.groups.movement} options={catalog?.presets.shot.movement ?? []} value={fields.movement} onPick={(id) => void patchShot({ movement: id })} />
        </PopoverContent>
      </Popover>
      <Popover open={modelOpen} onOpenChange={setModelOpen}>
        <PopoverTrigger asChild>
          <button type="button" aria-label={c.model(model?.name ?? "")} className={cn(toolClass, "w-[170px] gap-1 px-2")}>
            {model ? <VendorGlyph vendor={model.vendor} className="w-4 text-center text-brand" /> : <Film className="size-4" strokeWidth={1.5} aria-hidden />}
            <span className="min-w-0 truncate text-xs leading-[18px] font-semibold tracking-normal">{model?.name ?? "…"}</span>
            <ChevronRight className="size-5 shrink-0" strokeWidth={1.5} aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent look="panel" className="scroll-quiet max-h-[min(420px,70dvh)] w-[300px] overflow-y-auto p-2">
          <MenuLabel>{output === "image" ? c.stillModels : c.videoModels}</MenuLabel>
          {list?.map((m) => (
            <MenuItem
              key={m.id}
              selected={m.id === current}
              icon={<VendorGlyph vendor={m.vendor} />}
              hint={output === "video" && !m.canTextToVideo ? c.animateOnly : output === "video" && !m.canAnimate ? c.textOnly : undefined}
              onClick={() => {
                setModelOpen(false);
                void patch(output === "image" ? { stillModelId: m.id } : { videoModelId: m.id });
              }}
            >
              {m.name}
            </MenuItem>
          ))}
        </PopoverContent>
      </Popover>
      <MenuChip label={c.aspect(aspect)} trigger={<><RectangleHorizontal className="size-4" strokeWidth={1.5} aria-hidden />{aspect}</>}>
        {(close) => (
          <>
            <MenuLabel>{c.groups.aspect}</MenuLabel>
            {(catalog?.presets.aspects ?? []).map((a) => (
              <MenuItem
                key={a}
                selected={a === aspect}
                onClick={() => {
                  close();
                  void patchProject({ aspect: a });
                }}
              >
                {a}
              </MenuItem>
            ))}
          </>
        )}
      </MenuChip>
      <MenuChip label={c.duration(fields.duration)} trigger={<><Clock className="size-4" strokeWidth={1.5} aria-hidden />{c.seconds(fields.duration)}</>}>
        {(close) => (
          <>
            <MenuLabel>{c.groups.duration}</MenuLabel>
            {DURATIONS.map((s) => (
              <MenuItem
                key={s}
                selected={s === fields.duration}
                onClick={() => {
                  close();
                  void patchShot({ duration: s });
                }}
              >
                {c.seconds(s)}
              </MenuItem>
            ))}
          </>
        )}
      </MenuChip>
      <Popover onOpenChange={(o) => !o && sound !== fields.sound && void patchShot({ sound })}>
        <PopoverTrigger asChild>
          <button type="button" aria-label={`${c.groups.sound}: ${fields.sound ? c.soundOn : c.soundOff}`} className={toolClass}>
            {fields.sound ? <Volume2 className="size-4" strokeWidth={1.5} aria-hidden /> : <VolumeX className="size-4" strokeWidth={1.5} aria-hidden />}
            {fields.sound ? c.soundOn : c.soundOff}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px]">
          <label className="flex flex-col gap-1">
            <MenuLabel className="h-6">{c.soundLabel}</MenuLabel>
            <textarea
              value={sound}
              maxLength={1000}
              rows={3}
              placeholder={c.soundPlaceholder}
              onChange={(e) => setSound(e.target.value)}
              className="resize-none rounded-md bg-surface-field p-2 text-sm leading-5 text-text-primary outline-none placeholder:text-text-muted"
            />
          </label>
        </PopoverContent>
      </Popover>
      <div className="flex h-7 w-[88px] shrink-0 items-center justify-center gap-1 rounded-md bg-border-subtle" aria-label={c.count(count, MAX_BATCH)} role="group">
        <button type="button" aria-label={c.fewer} disabled={count <= 1} onClick={() => setCount(count - 1)} className="flex size-4 items-center justify-center text-text-primary disabled:opacity-40">
          <Minus className="size-4" strokeWidth={1.5} aria-hidden />
        </button>
        <span className="flex w-8 justify-center text-sm leading-5 font-semibold text-text-primary">
          {count}
          <span className="text-[#FFFFFF99]">/{MAX_BATCH}</span>
        </span>
        <button type="button" aria-label={c.more} disabled={count >= MAX_BATCH} onClick={() => setCount(count + 1)} className="flex size-4 items-center justify-center text-text-primary disabled:opacity-40">
          <Plus className="size-4" strokeWidth={1.5} aria-hidden />
        </button>
      </div>
    </div>
  );
}

function GenerateButton({ onGenerate }: { onGenerate: () => void }) {
  const { busy, price: millicredits } = useCinema();
  const price = millicredits === null ? null : formatCredits(millicredits);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onGenerate}
      aria-label={price ? `${c.generate}, ${price} ${cinema.account.credits}` : c.generate}
      className="relative flex h-12 w-full shrink-0 justify-center overflow-clip rounded-xl bg-brand pt-[7px] shadow-lime-deep transition-[filter] duration-150 hover:brightness-105 active:brightness-90 disabled:cursor-progress sm:h-20 sm:w-[128px] sm:pt-[22px]"
    >
      <span aria-hidden className="pointer-events-none absolute inset-0 overflow-clip rounded-[14px] border-b-[3px] border-b-[#D9D9D90A]">
        <span className="absolute top-[36px] left-[37px] h-[136px] w-[78px] rotate-[102.79deg] rounded-[50%] bg-brand-glow mix-blend-plus-lighter blur-[41.5px]" />
      </span>
      <span className="relative flex flex-col items-center">
        <span className="font-display text-xs leading-[18px] font-bold text-ink uppercase">{c.generate}</span>
        <span className="flex h-4 items-center gap-[2px] font-display text-xs leading-4 font-medium text-ink">
          {busy ? (
            <LoaderCircle className="size-3 animate-spin" strokeWidth={2} aria-hidden />
          ) : (
            <>
              <Sparkles className="size-4 fill-current" strokeWidth={1.5} aria-hidden />
              {price ?? "–"}
            </>
          )}
        </span>
      </span>
    </button>
  );
}

/** Image or video: the pill switch to the left of the composer. */
function ModeSwitch() {
  const { output, setOutput } = useCinema();
  return (
    <div
      role="radiogroup"
      aria-label={c.modeLabel}
      className="flex h-[60px] w-full shrink-0 items-center justify-center rounded-4xl bg-[#1C1E20] p-1 [box-shadow:#00000029_0px_4px_6px,#00000014_0px_4px_16px] sm:h-[116px] sm:w-[72px]"
    >
      <div className="relative flex size-full gap-1 sm:h-[108px] sm:w-16 sm:flex-col">
        {(["image", "video"] as const).map((o) => (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={output === o}
            onClick={() => setOutput(o)}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 rounded-3xl text-2xs leading-3 font-bold transition-colors duration-150 sm:h-[52px] sm:flex-none",
              output === o ? "bg-border-subtle text-text-primary" : "text-text-muted hover:text-text-primary",
            )}
          >
            {o === "image" ? <ImageIcon className="size-4" strokeWidth={1.5} aria-hidden /> : <Video className="size-4" strokeWidth={1.5} aria-hidden />}
            {o === "image" ? c.image : c.video}
          </button>
        ))}
      </div>
    </div>
  );
}

/** The whole composer: mode switch, parameter cards, the shot's action, toolbar and Generate. */
export function CinemaComposer() {
  const { fields, patchShot, generate, shot } = useCinema();
  const [action, setAction] = useState(fields.action);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [seenShot, setSeenShot] = useState(shot?.id);
  if (seenShot !== shot?.id) {
    setSeenShot(shot?.id);
    // A fresh shot made from the draft keeps what was typed; switching shots shows theirs.
    if (shot || !seenShot) setAction(shot ? shot.action : fields.action);
  }

  function change(v: string) {
    setAction(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void patchShot({ action: v }), 700);
  }

  function go() {
    if (timer.current) clearTimeout(timer.current);
    void generate({ action });
  }

  return (
    <div className="flex w-full max-w-[876px] flex-col items-stretch gap-1 sm:flex-row sm:items-end">
      <ModeSwitch />
      <div className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-4xl bg-[#1C1E20] p-1">
        <ParamCards />
        <div className="flex w-full flex-col gap-3 rounded-3xl bg-border-subtle p-3 sm:flex-row sm:items-end">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <textarea
              aria-label={c.actionLabel}
              value={action}
              maxLength={2000}
              placeholder={c.placeholder}
              onChange={(e) => change(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  go();
                }
              }}
              className="scroll-quiet mx-1 -mt-px h-[52px] resize-none bg-transparent text-sm leading-5 text-text-primary outline-none placeholder:text-text-muted"
            />
            <Toolbar />
          </div>
          <GenerateButton onGenerate={go} />
        </div>
      </div>
    </div>
  );
}
