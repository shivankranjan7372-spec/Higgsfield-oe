"use client";

import { CircleHelp, Download, Menu, PanelLeft, Shuffle, WandSparkles, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { mutate } from "swr";
import { LoginDialog } from "@/components/entry/login-dialog";
import { ads } from "@/content/ads";
import { routes } from "@/content/site";
import { ApiError, api, errorMessage } from "@/lib/api";
import { ensureSession, refreshSession, setBalance } from "@/lib/session";
import { Dialog, DialogContent, cn } from "@/ui";
import { AdsComposer, type ComposerState } from "./composer";
import { itemsOf, keys, useCampaign, useCampaigns, useFormats, useProducts, type AdFormat, type AdItem, type Campaign, type ImageRef, type Quote } from "./data";
import { AvatarsDialog, BrandsDialog, HowDialog, ProductDialog, ProductsDialog } from "./dialogs";
import { Player } from "./player";
import { SidebarBody, type CampaignActions } from "./sidebar";
import { Trending } from "./trending";

interface Notice {
  tone: "info" | "error";
  text: string;
  /** Show "Create account" next to the message (the server wants a member). */
  join?: boolean;
}

/* The pills under the composer. The coral one is the page's main action. */
const coral =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-full bg-[#ECA087] bg-[linear-gradient(183deg,#00000000_12.72%,#BE6F56_75.8%)] px-5 text-sm leading-4 font-medium text-text-primary [box-shadow:#0000001A_0px_2px_4px] transition-[filter] duration-150 hover:brightness-110 disabled:opacity-50";
const ghost =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-full px-5 text-sm leading-4 font-medium text-text-primary transition-colors duration-150 hover:bg-border-subtle";

export function AdsStudio() {
  const { formats, loading: formatsLoading, error: formatsError, retry: retryFormats } = useFormats();
  const { list: products, loading: productsLoading } = useProducts();
  const campaigns = useCampaigns();

  // Composer.
  const [script, setScript] = useState("");
  const [formatIds, setFormatIds] = useState<string[]>([]);
  const [productId, setProductId] = useState<string | null>(null);
  const [presenter, setPresenter] = useState<ImageRef | null>(null);
  const [variations, setVariations] = useState(1);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  // Player.
  const [viewId, setViewId] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const { campaign: loaded, error: viewError } = useCampaign(viewId);
  // An opened campaign that was deleted elsewhere shows the idle screen.
  const viewed = viewError instanceof ApiError && viewError.status === 404 ? null : loaded;
  const shownList = useMemo(() => itemsOf(viewed), [viewed]);
  const current = shownList[index] ?? null;

  // Windows and the sidebar.
  const [collapsed, setCollapsed] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [win, setWin] = useState<null | "product" | "products" | "brands" | "avatars" | "how">(null);
  const [login, setLogin] = useState(false);

  const product = products.find((p) => p.id === productId) ?? null;
  const chosen = formats.filter((f) => formatIds.includes(f.id));
  const price = chosen.length
    ? { total: chosen.reduce((sum, f) => sum + (f.pricePerAd ?? 0), 0) * variations, approx: chosen.some((f) => f.spoken) }
    : null;


  const show = (error: unknown) => {
    const e = error instanceof ApiError ? error : null;
    setNotice({ tone: "error", text: errorMessage(error), join: !!e && (e.status === 401 || e.status === 403) && e.code !== "forbidden" });
  };

  function blocker(): string | null {
    if (!product) return ads.errors.needProduct;
    if (!chosen.length) return ads.errors.needStyle;
    if (chosen.some((f) => f.needsPresenter) && !presenter) return ads.errors.needPresenter;
    return null;
  }

  async function generate() {
    const why = blocker();
    if (why) {
      setNotice({ tone: "error", text: why });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      await ensureSession();
      const body = {
        productId,
        formats: formatIds,
        variations,
        script: script.trim(),
        presenterAssetId: presenter?.assetId ?? null,
        name: `${product!.name} · ${chosen.length === 1 ? chosen[0].name : ads.chips.styles(chosen.length)}`.slice(0, 80),
      };
      const id = draftId
        ? (await api<{ campaign: Campaign }>(keys.campaign(draftId), { method: "PATCH", body })).campaign.id
        : (await api<{ campaign: Campaign }>(keys.campaigns, { method: "POST", body })).campaign.id;
      setDraftId(id);
      const { quote } = await api<{ quote: Quote }>(`${keys.campaign(id)}/quote`);
      const ran = await api<{ campaign: Campaign; balance: number }>(`${keys.campaign(id)}/run`, { method: "POST", body: { expectedCost: quote.total } });
      await setBalance(ran.balance);
      await mutate(keys.campaign(id), { campaign: ran.campaign }, { revalidate: true });
      setDraftId(null);
      setViewId(id);
      setIndex(0);
    } catch (e) {
      show(e);
    } finally {
      setBusy(false);
      void mutate(keys.campaigns);
    }
  }

  async function draftScript() {
    if (!product) {
      setNotice({ tone: "error", text: ads.errors.needProduct });
      return;
    }
    setDrafting(true);
    setNotice(null);
    try {
      const seconds = chosen.find((f) => f.spoken)?.platform.seconds ?? 15;
      const r = await api<{ script: string }>("/api/ads/copy", { method: "POST", body: { productId: product.id, count: 1, seconds: Math.min(60, Math.max(5, seconds)) } });
      setScript(r.script.slice(0, 1200));
      setNotice({ tone: "info", text: ads.copyNote });
      textRef.current?.focus();
    } catch (e) {
      show(e);
    } finally {
      setDrafting(false);
    }
  }

  async function variation() {
    if (!current || !viewed) return;
    setBusy(true);
    setNotice(null);
    try {
      const formatId = current.item.formatId;
      const { quote } = await api<{ quote: Quote }>(`${keys.campaign(viewed.id)}/quote?formatId=${encodeURIComponent(formatId)}`);
      const r = await api<{ campaign: Campaign; balance: number }>(`${keys.campaign(viewed.id)}/rerun`, { method: "POST", body: { formatId, expectedCost: quote.total } });
      await setBalance(r.balance);
      await mutate(keys.campaign(viewed.id), { campaign: r.campaign }, { revalidate: true });
      setIndex(0);
      void mutate(keys.campaigns);
    } catch (e) {
      show(e);
    } finally {
      setBusy(false);
    }
  }

  async function winner(item: AdItem) {
    try {
      await api(`/api/ads/items/${item.id}`, { method: "PATCH", body: { winner: !item.winner } });
      if (viewed) await mutate(keys.campaign(viewed.id));
      void mutate(keys.campaigns);
    } catch (e) {
      show(e);
    }
  }

  function home() {
    setViewId(null);
    setDraftId(null);
    setIndex(0);
    setNotice(null);
    setSheet(false);
  }

  function chooseStyle(f: AdFormat) {
    setFormatIds([f.id]);
    if (!script.trim()) setScript(f.spoken ? ads.starter.spoken : f.output === "video" ? ads.starter.video : ads.starter.image);
    setNotice(null);
    textRef.current?.focus();
    textRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  const actions: CampaignActions = {
    onOpen: (c) => {
      setScript(c.script);
      setFormatIds(c.formats);
      setProductId(c.product?.id ?? null);
      setPresenter(c.presenter);
      setVariations(c.variations);
      setDraftId(c.status === "draft" ? c.id : null);
      setViewId(c.status === "draft" ? null : c.id);
      setIndex(0);
      setNotice(null);
      setSheet(false);
    },
    onRename: async (c, name) => {
      try {
        await api(keys.campaign(c.id), { method: "PATCH", body: { name } });
        await mutate(keys.campaigns);
      } catch (e) {
        show(e);
      }
    },
    onDuplicate: async (c) => {
      try {
        const r = await api<{ campaign: Campaign }>(`${keys.campaign(c.id)}/duplicate`, { method: "POST" });
        await mutate(keys.campaigns);
        actions.onOpen(r.campaign);
      } catch (e) {
        show(e);
      }
    },
    onDelete: async (c) => {
      try {
        await api(keys.campaign(c.id), { method: "DELETE" });
        if (viewId === c.id || draftId === c.id) home();
        await mutate(keys.campaigns);
        void refreshSession();
      } catch (e) {
        show(e);
      }
    },
  };

  const composer: ComposerState = {
    script,
    setScript,
    formats,
    formatIds,
    toggleFormat: (id) => setFormatIds((now) => (now.includes(id) ? now.filter((x) => x !== id) : [...now, id])),
    products,
    productsLoading,
    product,
    setProductId,
    presenter,
    variations,
    setVariations,
    price,
    busy,
    drafting,
    onGenerate: () => void generate(),
    onDraftScript: () => void draftScript(),
    onNewProduct: () => setWin("product"),
    onAvatars: () => setWin("avatars"),
    onBrands: () => setWin("brands"),
  };

  const sidebarProps = {
    campaigns: campaigns.list,
    loading: campaigns.loading,
    failed: !!campaigns.error,
    onRetry: () => void campaigns.mutate(),
    activeId: viewId ?? draftId,
    actions,
    onHome: home,
    onBrands: () => setWin("brands"),
    onProducts: () => setWin("products"),
    onAvatars: () => setWin("avatars"),
  };

  const done = current?.item.status === "succeeded" ? current.item.assets[0] : undefined;

  return (
    <div className="flex min-h-0 flex-1 bg-[#0A0A0A]">
      {!collapsed ? (
        <aside className="hidden w-[244px] shrink-0 pr-1 md:flex">
          <SidebarBody {...sidebarProps} onCollapse={() => setCollapsed(true)} />
        </aside>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 p-1">
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-clip rounded-2xl bg-page">
          {/* Small screens: a bar with the menu, which opens the sidebar as a sheet. */}
          <div className="flex h-12 shrink-0 items-center gap-2 px-2 md:hidden">
            <button
              type="button"
              aria-label={ads.sidebar.open}
              onClick={() => setSheet(true)}
              className="flex size-8 items-center justify-center rounded-md bg-border-subtle text-text-primary transition-colors duration-150 hover:bg-border-default"
            >
              <Menu className="size-4" strokeWidth={1.5} aria-hidden />
            </button>
            <span className="text-sm leading-5 font-semibold text-text-primary">{ads.title}</span>
          </div>
          {/* Wide screens with the sidebar hidden: a button to bring it back. */}
          {collapsed ? (
            <button
              type="button"
              aria-label={ads.sidebar.expand}
              onClick={() => setCollapsed(false)}
              className="absolute top-2 left-2 z-10 hidden size-8 items-center justify-center rounded-md bg-border-subtle text-text-primary transition-colors duration-150 hover:bg-border-default md:flex"
            >
              <PanelLeft className="size-4" strokeWidth={1.5} aria-hidden />
            </button>
          ) : null}

          <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto px-4">
            <div className="mx-auto flex w-full max-w-[1028px] flex-col items-center gap-10">
              <div className="flex w-full flex-col items-center">
                <Player
                  list={shownList}
                  index={Math.min(index, Math.max(0, shownList.length - 1))}
                  onIndex={setIndex}
                  onOff={home}
                  muted={muted}
                  onMuted={setMuted}
                  onWinner={(item) => void winner(item)}
                />
                <h1 className="mt-2 flex min-h-[76px] flex-col items-center justify-center gap-2 text-center font-display text-xl leading-6 font-bold tracking-[-0.04em] uppercase">
                  <span className="bg-[linear-gradient(180deg,#D9FF66_0%,#D1FE17_100%)] px-[3.5px] text-[#121417]">{ads.headline.lit}</span>
                  <span className="text-text-primary">{ads.headline.plain}</span>
                </h1>
                <div className="mt-2 flex w-full justify-center">
                  <AdsComposer s={composer} textRef={textRef} />
                </div>
                <div className="mt-4 flex min-h-12 w-full max-w-[672px] flex-wrap items-center justify-center gap-2">
                  {notice ? (
                    <div
                      role={notice.tone === "error" ? "alert" : "status"}
                      className={cn(
                        "flex min-h-8 max-w-full items-center gap-2 rounded-full py-1 pr-1 pl-4 text-sm leading-5",
                        notice.tone === "error" ? "bg-[#FF6B6B1A] text-text-primary" : "bg-border-subtle text-text-tab",
                      )}
                    >
                      <span className="min-w-0">{notice.text}</span>
                      {notice.join ? (
                        <button type="button" onClick={() => setLogin(true)} className="shrink-0 rounded-full bg-brand px-3 py-1 text-xs leading-4 font-semibold text-ink">
                          {ads.sidebar.createAccount}
                        </button>
                      ) : null}
                      <button type="button" aria-label="Dismiss" onClick={() => setNotice(null)} className="flex size-6 shrink-0 items-center justify-center rounded-full text-text-secondary hover:bg-border-subtle hover:text-text-primary">
                        <X className="size-4" strokeWidth={1.5} aria-hidden />
                      </button>
                    </div>
                  ) : (
                    <>
                      {done ? (
                        <>
                          <button type="button" className={coral} onClick={() => void variation()} disabled={busy}>
                            {ads.actions.variation}
                            <Shuffle className="size-4" strokeWidth={1.5} aria-hidden />
                          </button>
                          <a href={`${done.url}?download=1`} download className={ghost}>
                            {ads.actions.download}
                            <Download className="size-4" strokeWidth={1.5} aria-hidden />
                          </a>
                        </>
                      ) : (
                        <button type="button" className={coral} onClick={() => void draftScript()} disabled={drafting}>
                          {ads.actions.draftScript}
                          <WandSparkles className="size-4" strokeWidth={1.5} aria-hidden />
                        </button>
                      )}
                      <button type="button" className={ghost} onClick={() => setWin("how")}>
                        {ads.actions.howItWorks}
                        <CircleHelp className="size-4" strokeWidth={1.5} aria-hidden />
                      </button>
                    </>
                  )}
                </div>
              </div>

              <Trending formats={formats} loading={formatsLoading} failed={!!formatsError} onRetry={retryFormats} onChoose={chooseStyle} />
            </div>
          </div>
        </div>
      </div>

      <Dialog open={sheet} onOpenChange={setSheet}>
        <DialogContent title={ads.title} hideTitle className="h-[calc(100dvh-32px)] max-w-[300px]">
          <SidebarBody {...sidebarProps} />
        </DialogContent>
      </Dialog>
      <ProductDialog open={win === "product"} onOpenChange={(o) => setWin(o ? "product" : null)} onSaved={(p) => setProductId(p.id)} />
      <ProductsDialog open={win === "products"} onOpenChange={(o) => setWin(o ? "products" : null)} />
      <BrandsDialog open={win === "brands"} onOpenChange={(o) => setWin(o ? "brands" : null)} />
      <AvatarsDialog open={win === "avatars"} onOpenChange={(o) => setWin(o ? "avatars" : null)} presenter={presenter} onPresenter={setPresenter} />
      <HowDialog open={win === "how"} onOpenChange={(o) => setWin(o ? "how" : null)} />
      <LoginDialog open={login} onOpenChange={setLogin} mode="join" next={routes.ads} />
    </div>
  );
}
