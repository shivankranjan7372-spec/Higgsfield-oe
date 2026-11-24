"use client";

import { Package, Palette, Plus, Trash2, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { mutate } from "swr";
import { ads } from "@/content/ads";
import { api, errorMessage, type Asset } from "@/lib/api";
import { ensureSession } from "@/lib/session";
import { Button, Dialog, DialogContent, IconButton, Spinner } from "@/ui";
import { keys, useBrands, useProducts, type ImageRef, type Product } from "./data";
import { PhotoGrid } from "./photos";

export const field =
  "w-full min-w-0 rounded-lg border border-border-subtle bg-surface-field px-3 py-2 text-sm leading-5 text-text-primary placeholder:text-text-tertiary transition-colors duration-150 hover:border-border-default focus:border-border-strong focus:outline-none";
const label = "flex flex-col gap-1 text-xs leading-4 font-medium text-text-secondary";

function Problem({ text }: { text: string | null }) {
  return text ? (
    <p role="alert" className="text-xs leading-4 text-danger">
      {text}
    </p>
  ) : null;
}

const lines = (s: string, sep: RegExp) =>
  s
    .split(sep)
    .map((x) => x.trim())
    .filter(Boolean);

/** The window for adding a product: name, a few words, benefits and pictures. */
export function ProductDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; onSaved?: (p: Product) => void }) {
  const { list: brands } = useBrands();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [benefits, setBenefits] = useState("");
  const [audience, setAudience] = useState("");
  const [price, setPrice] = useState("");
  const [brandKitId, setBrandKitId] = useState("");
  const [images, setImages] = useState<ImageRef[]>([]);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const toggle = (a: Asset) =>
    setImages((now) => (now.some((i) => i.assetId === a.id) ? now.filter((i) => i.assetId !== a.id) : [...now, { assetId: a.id, url: a.url }].slice(0, 8)));

  async function save() {
    setBusy(true);
    setProblem(null);
    try {
      await ensureSession();
      const { product } = await api<{ product: Product }>("/api/ads/products", {
        method: "POST",
        body: {
          name: name.trim(),
          description: description.trim(),
          benefits: lines(benefits, /\n/),
          audience: audience.trim(),
          price: price.trim(),
          imageIds: images.map((i) => i.assetId),
          brandKitId: brandKitId || null,
        },
      });
      await mutate(keys.products);
      onSaved?.(product);
      onOpenChange(false);
      setName("");
      setDescription("");
      setBenefits("");
      setAudience("");
      setPrice("");
      setImages([]);
    } catch (e) {
      setProblem(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={ads.product.title} className="max-w-[520px]">
        <form
          className="flex flex-col gap-4 p-6"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <label className={label}>
            {ads.product.name}
            <input className={field} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder={ads.product.namePlaceholder} />
          </label>
          <label className={label}>
            {ads.product.description}
            <input className={field} value={description} maxLength={600} onChange={(e) => setDescription(e.target.value)} placeholder={ads.product.descriptionPlaceholder} />
          </label>
          <label className={label}>
            {ads.product.benefits}
            <textarea className={`${field} h-[72px] resize-none`} value={benefits} onChange={(e) => setBenefits(e.target.value)} placeholder={ads.product.benefitsPlaceholder} />
          </label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className={label}>
              {ads.product.audience}
              <input className={field} value={audience} maxLength={200} onChange={(e) => setAudience(e.target.value)} />
            </label>
            <label className={label}>
              {ads.product.price}
              <input className={field} value={price} maxLength={40} onChange={(e) => setPrice(e.target.value)} />
            </label>
          </div>
          {brands.length ? (
            <label className={label}>
              {ads.product.brand}
              <select className={field} value={brandKitId} onChange={(e) => setBrandKitId(e.target.value)}>
                <option value="">{ads.product.noBrand}</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className={label}>
            <span>
              {ads.product.pictures} · {images.length}/8
            </span>
            <div className="scroll-quiet max-h-[200px] overflow-y-auto pr-1">
              <PhotoGrid
                multiple
                columns="grid-cols-4 sm:grid-cols-6"
                chosen={images.map((i) => i.assetId)}
                onToggle={toggle}
                onUploaded={(added) => setImages((now) => [...now, ...added.map((a) => ({ assetId: a.id, url: a.url }))].slice(0, 8))}
              />
            </div>
          </div>
          <Problem text={problem} />
          <Button type="submit" variant="lime" size="md" disabled={busy || !name.trim()}>
            {busy ? ads.product.saving : ads.product.save}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Row({ icon, title, sub, onDelete, deleteLabel }: { icon: ReactNode; title: string; sub?: string; onDelete: () => Promise<void>; deleteLabel: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <li className="flex h-12 items-center gap-3 rounded-lg px-2 transition-colors duration-150 hover:bg-border-subtle">
      <span className="flex size-8 shrink-0 items-center justify-center overflow-clip rounded-md bg-surface-tertiary text-text-secondary">{icon}</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm leading-5 font-medium">{title}</span>
        {sub ? <span className="truncate text-xs leading-4 text-text-secondary">{sub}</span> : null}
      </span>
      <IconButton
        size={28}
        tone="dim"
        aria-label={deleteLabel}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onDelete();
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? <Spinner /> : <Trash2 className="size-4" strokeWidth={1.5} aria-hidden />}
      </IconButton>
    </li>
  );
}

function Skeleton() {
  return (
    <ul className="flex flex-col gap-1">
      {[0, 1, 2].map((i) => (
        <li key={i} className="shimmer h-12 rounded-lg bg-surface-secondary-strong" />
      ))}
    </ul>
  );
}

/** Every product, with delete and a way to add one. */
export function ProductsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { list, loading } = useProducts();
  const [adding, setAdding] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent title={ads.productsDialog.title} className="max-w-[480px]">
          <div className="flex flex-col gap-4 p-6">
            <p className="text-sm leading-5 text-text-secondary">{ads.productsDialog.hint}</p>
            {loading ? (
              <Skeleton />
            ) : list.length === 0 ? (
              <p className="text-sm leading-5 text-text-secondary">{ads.pickers.noProducts}</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {list.map((p) => (
                  <Row
                    key={p.id}
                    title={p.name}
                    sub={p.description}
                    deleteLabel={`${ads.sidebar.delete} ${p.name}`}
                    icon={
                      p.images[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.images[0].url} alt="" className="size-full object-cover" />
                      ) : (
                        <Package className="size-4" strokeWidth={1.5} aria-hidden />
                      )
                    }
                    onDelete={async () => {
                      setProblem(null);
                      try {
                        await api(`/api/ads/products/${p.id}`, { method: "DELETE" });
                        await mutate(keys.products);
                      } catch (e) {
                        setProblem(errorMessage(e));
                      }
                    }}
                  />
                ))}
              </ul>
            )}
            <Problem text={problem} />
            <Button variant="soft" size="md" onClick={() => setAdding(true)}>
              <Plus className="size-4" strokeWidth={1.5} aria-hidden />
              {ads.pickers.newProduct}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <ProductDialog open={adding} onOpenChange={setAdding} />
    </>
  );
}

/** Brand kits: a name, a tone and the words to use or avoid. */
export function BrandsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { list, loading } = useBrands();
  const [name, setName] = useState("");
  const [tone, setTone] = useState("");
  const [use, setUse] = useState("");
  const [avoid, setAvoid] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function add() {
    setBusy(true);
    setProblem(null);
    try {
      await ensureSession();
      await api("/api/ads/brands", { method: "POST", body: { name: name.trim(), tone: tone.trim(), wordsToUse: lines(use, /,/), wordsToAvoid: lines(avoid, /,/) } });
      await mutate(keys.brands);
      setName("");
      setTone("");
      setUse("");
      setAvoid("");
    } catch (e) {
      setProblem(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={ads.brand.title} className="max-w-[480px]">
        <div className="flex flex-col gap-4 p-6">
          <p className="text-sm leading-5 text-text-secondary">{ads.brand.hint}</p>
          {loading ? (
            <Skeleton />
          ) : list.length === 0 ? (
            <p className="text-sm leading-5 text-text-secondary">{ads.brand.empty}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {list.map((b) => (
                <Row
                  key={b.id}
                  title={b.name}
                  sub={b.tone}
                  deleteLabel={`${ads.sidebar.delete} ${b.name}`}
                  icon={<Palette className="size-4" strokeWidth={1.5} aria-hidden />}
                  onDelete={async () => {
                    try {
                      await api(`/api/ads/brands/${b.id}`, { method: "DELETE" });
                      await mutate(keys.brands);
                    } catch (e) {
                      setProblem(errorMessage(e));
                    }
                  }}
                />
              ))}
            </ul>
          )}
          <form
            className="flex flex-col gap-3 border-t border-border-subtle pt-4"
            onSubmit={(e) => {
              e.preventDefault();
              void add();
            }}
          >
            <label className={label}>
              {ads.brand.name}
              <input className={field} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className={label}>
              {ads.brand.tone}
              <input className={field} value={tone} maxLength={300} onChange={(e) => setTone(e.target.value)} placeholder={ads.brand.tonePlaceholder} />
            </label>
            <label className={label}>
              {ads.brand.use}
              <input className={field} value={use} onChange={(e) => setUse(e.target.value)} />
            </label>
            <label className={label}>
              {ads.brand.avoid}
              <input className={field} value={avoid} onChange={(e) => setAvoid(e.target.value)} />
            </label>
            <Problem text={problem} />
            <Button type="submit" variant="lime" size="md" disabled={busy || !name.trim()}>
              {ads.brand.add}
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Photos that can present an ad. Choosing one makes it the presenter. */
export function AvatarsDialog({
  open,
  onOpenChange,
  presenter,
  onPresenter,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  presenter: ImageRef | null;
  onPresenter: (p: ImageRef | null) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={ads.avatarsDialog.title} className="max-w-[520px]">
        <div className="flex flex-col gap-4 p-6">
          <p className="text-sm leading-5 text-text-secondary">{ads.avatarsDialog.hint}</p>
          {presenter ? (
            <Button variant="outline" size="sm" className="self-start" onClick={() => onPresenter(null)}>
              <X className="size-4" strokeWidth={1.5} aria-hidden />
              {ads.pickers.none}
            </Button>
          ) : null}
          <div className="scroll-quiet max-h-[50dvh] overflow-y-auto pr-1">
            <PhotoGrid
              columns="grid-cols-3 sm:grid-cols-5"
              chosen={presenter ? [presenter.assetId] : []}
              onToggle={(a) => onPresenter(presenter?.assetId === a.id ? null : { assetId: a.id, url: a.url })}
              onUploaded={(added) => added[0] && onPresenter({ assetId: added[0].id, url: added[0].url })}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Four short steps, in the page's own type. */
export function HowDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={ads.how.title} className="max-w-[480px]">
        <ol className="flex flex-col gap-4 p-6">
          {ads.how.steps.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand font-display text-xs leading-4 font-bold text-ink">{i + 1}</span>
              <span className="flex min-w-0 flex-col gap-1">
                <span className="text-sm leading-5 font-semibold">{s.title}</span>
                <span className="text-sm leading-5 text-text-secondary">{s.body}</span>
              </span>
            </li>
          ))}
          <li className="text-xs leading-4 text-text-tertiary">{ads.copyNote}</li>
        </ol>
      </DialogContent>
    </Dialog>
  );
}
