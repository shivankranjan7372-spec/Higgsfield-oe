"use client";

import { ArrowUp, Boxes, Layers, Package, Palette, Plus, Shapes, UserRound, WandSparkles } from "lucide-react";
import { useState, type ComponentProps, type RefObject } from "react";
import { formatCredits } from "@/config/economy";
import { ads } from "@/content/ads";
import { MenuItem, MenuLabel, Popover, PopoverContent, PopoverTrigger, Spinner, cn } from "@/ui";
import type { AdFormat, ImageRef, Product } from "./data";

/* The 24px chip drawn in the composer: soft grey, a hairline of light on top, a soft drop. */
const chip =
  "inline-flex h-6 min-w-0 shrink-0 items-center justify-center gap-[2px] rounded-md bg-border-subtle px-[6px] text-xs leading-4 font-medium text-text-primary [box-shadow:#FFFFFF0D_0px_0.66px_0.825px_inset,#00000033_0px_2px_6px] transition-colors duration-150 hover:bg-border-default data-[state=open]:bg-border-default disabled:opacity-40";

function ChipButton({ icon, children, className, ...rest }: { icon: React.ReactNode } & ComponentProps<"button">) {
  return (
    <button type="button" className={cn(chip, className)} {...rest}>
      {icon}
      <span className="min-w-0 truncate px-[3.5px]">{children}</span>
    </button>
  );
}

const icon12 = "size-3 shrink-0";

export interface ComposerState {
  script: string;
  setScript: (s: string) => void;
  formats: AdFormat[];
  formatIds: string[];
  toggleFormat: (id: string) => void;
  products: Product[];
  productsLoading: boolean;
  product: Product | null;
  setProductId: (id: string | null) => void;
  presenter: ImageRef | null;
  variations: number;
  setVariations: (n: number) => void;
  /** Live price in millicredits, or null when nothing is chosen. `approx` when a talking style's price depends on the script. */
  price: { total: number; approx: boolean } | null;
  busy: boolean;
  drafting: boolean;
  onGenerate: () => void;
  onDraftScript: () => void;
  onNewProduct: () => void;
  onAvatars: () => void;
  onBrands: () => void;
}

function StylePicker({ s }: { s: ComposerState }) {
  const chosen = s.formats.filter((f) => s.formatIds.includes(f.id));
  const label = chosen.length === 0 ? ads.chips.style : chosen.length === 1 ? chosen[0].name : ads.chips.styles(chosen.length);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <ChipButton icon={<Shapes className={icon12} strokeWidth={1.5} aria-hidden />} aria-label={`${ads.chips.style}: ${label}`} className="max-w-[160px]">
          {label}
        </ChipButton>
      </PopoverTrigger>
      <PopoverContent look="panel" className="scroll-quiet max-h-[min(420px,60dvh)] w-[min(340px,calc(100vw-16px))] overflow-y-auto p-2">
        <MenuLabel>{ads.pickers.styleHint}</MenuLabel>
        {s.formats.length === 0 ? <p className="px-2 py-3 text-xs leading-4 text-text-secondary">{ads.pickers.loading}</p> : null}
        {s.formats.map((f) => (
          <MenuItem
            key={f.id}
            role="menuitemcheckbox"
            selected={s.formatIds.includes(f.id)}
            disabled={!f.available}
            onClick={() => s.toggleFormat(f.id)}
            icon={<Layers className="size-4 text-text-secondary" strokeWidth={1.5} aria-hidden />}
            hint={f.available ? (f.pricePerAd !== null ? `${formatCredits(f.pricePerAd)} ${ads.pickers.perAd}` : null) : ads.pickers.offline}
          >
            {f.name}
          </MenuItem>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function ProductPicker({ s }: { s: ComposerState }) {
  const [open, setOpen] = useState(false);
  const label = s.product?.name ?? ads.chips.product;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <ChipButton icon={<Package className={icon12} strokeWidth={1.5} aria-hidden />} aria-label={`${ads.chips.product}: ${label}`} className="max-w-[160px]">
          {label}
        </ChipButton>
      </PopoverTrigger>
      <PopoverContent look="panel" className="scroll-quiet max-h-[min(420px,60dvh)] w-[min(300px,calc(100vw-16px))] overflow-y-auto p-2">
        <MenuLabel>{ads.pickers.productTitle}</MenuLabel>
        {s.productsLoading ? (
          <div className="shimmer mx-2 my-1 h-9 rounded-md bg-surface-tertiary" />
        ) : s.products.length === 0 ? (
          <p className="px-2 pb-2 text-xs leading-4 text-text-secondary">{ads.pickers.noProducts}</p>
        ) : (
          s.products.map((p) => (
            <MenuItem
              key={p.id}
              selected={s.product?.id === p.id}
              onClick={() => {
                s.setProductId(s.product?.id === p.id ? null : p.id);
                setOpen(false);
              }}
              icon={
                p.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.images[0].url} alt="" className="size-5 rounded-xs object-cover" />
                ) : (
                  <Package className="size-4 text-text-secondary" strokeWidth={1.5} aria-hidden />
                )
              }
            >
              {p.name}
            </MenuItem>
          ))
        )}
        <MenuItem
          role="menuitem"
          onClick={() => {
            setOpen(false);
            s.onNewProduct();
          }}
          icon={<Plus className="size-4" strokeWidth={1.5} aria-hidden />}
        >
          {ads.pickers.newProduct}
        </MenuItem>
      </PopoverContent>
    </Popover>
  );
}

function VariationsPicker({ s }: { s: ComposerState }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${ads.chips.variationsLabel}: ${s.variations}`}
          className="flex h-6 shrink-0 items-center gap-[6px] rounded-md px-[6px] text-xs leading-4 font-medium text-text-primary transition-colors duration-150 hover:bg-border-subtle data-[state=open]:bg-border-subtle"
        >
          <Boxes className="size-4" strokeWidth={1.5} aria-hidden />
          {ads.chips.variations(s.variations)}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[200px]">
        <MenuLabel>{ads.chips.variationsLabel}</MenuLabel>
        {[1, 2, 3, 4].map((n) => (
          <MenuItem
            key={n}
            selected={s.variations === n}
            onClick={() => {
              s.setVariations(n);
              setOpen(false);
            }}
          >
            {ads.chips.variations(n)}
          </MenuItem>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function AddMenu({ s }: { s: ComposerState }) {
  const [open, setOpen] = useState(false);
  const run = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label={ads.chips.add} className={cn(chip, "size-6 px-0")}>
          <Plus className={icon12} strokeWidth={1.5} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[230px]">
        <MenuItem role="menuitem" onClick={run(s.onNewProduct)} icon={<Package className="size-4" strokeWidth={1.5} aria-hidden />}>
          {ads.pickers.newProduct}
        </MenuItem>
        <MenuItem role="menuitem" onClick={run(s.onAvatars)} icon={<UserRound className="size-4" strokeWidth={1.5} aria-hidden />}>
          {ads.pickers.upload}
        </MenuItem>
        <MenuItem role="menuitem" onClick={run(s.onBrands)} icon={<Palette className="size-4" strokeWidth={1.5} aria-hidden />}>
          {ads.brand.title}
        </MenuItem>
      </PopoverContent>
    </Popover>
  );
}

/**
 * The script box with its chips: Style, Product and Avatar on the left; versions, the price,
 * the script writer and the lime send button on the right.
 */
export function AdsComposer({ s, textRef }: { s: ComposerState; textRef: RefObject<HTMLTextAreaElement | null> }) {
  return (
    <div className="flex w-full max-w-[672px] rounded-3xl bg-border-default p-1 [box-shadow:#00000029_0px_4px_4px,#00000014_0px_4px_12px]">
      <form
        className="flex min-w-0 flex-1 flex-col gap-2 rounded-2xl bg-[#0000004C] p-2"
        onSubmit={(e) => {
          e.preventDefault();
          s.onGenerate();
        }}
      >
        <label className="sr-only" htmlFor="ads-script">
          Script
        </label>
        <textarea
          id="ads-script"
          ref={textRef}
          value={s.script}
          maxLength={1200}
          onChange={(e) => s.setScript(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              s.onGenerate();
            }
          }}
          placeholder={ads.placeholder}
          className="scroll-quiet h-14 w-full resize-none bg-transparent p-1 text-sm leading-4 font-medium text-text-primary placeholder:text-text-secondary focus:outline-none"
        />
        <div className="flex min-h-8 flex-wrap items-center gap-1">
          <div className="scroll-none flex min-w-0 flex-1 basis-full items-center gap-1 overflow-x-auto pl-1 sm:basis-0">
            <AddMenu s={s} />
            <StylePicker s={s} />
            <ProductPicker s={s} />
            <ChipButton
              icon={
                s.presenter ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.presenter.url} alt="" className="size-3 shrink-0 rounded-full object-cover" />
                ) : (
                  <UserRound className={icon12} strokeWidth={1.5} aria-hidden />
                )
              }
              aria-label={`${ads.chips.avatar}: ${s.presenter ? "chosen" : ads.pickers.none}`}
              onClick={s.onAvatars}
            >
              {ads.chips.avatar}
            </ChipButton>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <VariationsPicker s={s} />
            <span className="flex h-6 items-center px-[6px] text-xs leading-4 font-medium text-text-secondary" aria-live="polite" data-testid="ads-price">
              {s.price ? `${s.price.approx ? "≈" : ""}${formatCredits(s.price.total)} credits` : "—"}
            </span>
            <button
              type="button"
              onClick={s.onDraftScript}
              disabled={s.drafting}
              aria-label={ads.chips.draftScript}
              title={ads.chips.draftScript}
              className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-border-subtle text-text-primary backdrop-blur-[40px] transition-colors duration-150 hover:bg-border-default disabled:opacity-40"
            >
              {s.drafting ? <Spinner label={ads.chips.draftScript} /> : <WandSparkles className="size-4" strokeWidth={1.5} aria-hidden />}
            </button>
            <button
              type="submit"
              aria-label={ads.chips.generate}
              title={ads.chips.generate}
              disabled={s.busy}
              className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand text-ink transition-colors duration-150 hover:bg-brand-glow active:bg-brand-pressed disabled:opacity-60"
            >
              {s.busy ? <Spinner label={ads.chips.generate} /> : <ArrowUp className="size-4" strokeWidth={1.5} aria-hidden />}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
