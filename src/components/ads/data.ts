"use client";

import useSWR from "swr";
import { fetcher, type Asset, type Job } from "@/lib/api";
import { useSession } from "@/lib/session";

/* The shapes of docs/api/ads.md, written out for the browser. */

export interface ImageRef {
  assetId: string;
  url: string;
}

export interface BrandKit {
  id: string;
  name: string;
  tone: string;
  wordsToUse: string[];
  wordsToAvoid: string[];
  logo: ImageRef | null;
  createdAt: number;
}

export interface Product {
  id: string;
  brandKitId: string | null;
  name: string;
  description: string;
  benefits: string[];
  audience: string;
  price: string;
  link: string;
  images: ImageRef[];
  createdAt: number;
}

export interface AdFormat {
  id: string;
  name: string;
  description: string;
  output: "image" | "video" | "audio";
  group: "image" | "video" | "spoken";
  platform: { label: string; aspect: string | null; seconds: number | null };
  needsPresenter: boolean;
  usesProductImages: boolean;
  spoken: boolean;
  available: boolean;
  pricePerAd: number | null;
}

export type AdStatus = "waiting" | "running" | "succeeded" | "failed" | "canceled";

export interface AdItem {
  id: string;
  campaignId: string;
  formatId: string;
  round: number;
  variation: number;
  status: AdStatus;
  winner: boolean;
  script: string;
  copy: { headline: string; caption: string; cta: string } | null;
  cost: number;
  error: { code: string; message: string } | null;
  job: Job | null;
  speechJob: Job | null;
  assets: Asset[];
  createdAt: number;
  finishedAt: number | null;
}

export interface Campaign {
  id: string;
  name: string;
  product: { id: string; name: string } | null;
  brandKit: { id: string; name: string } | null;
  formats: string[];
  variations: number;
  script: string;
  presenter: ImageRef | null;
  copiedFrom: string | null;
  createdAt: number;
  updatedAt: number;
  status: "draft" | "running" | "done";
  counts: Record<string, number>;
  groups?: { format: { id: string; name: string; output: string }; items: AdItem[] }[];
  cover?: { assetId: string; kind: string; url: string } | null;
}

export interface Quote {
  total: number;
  ads: number;
  balance: number;
  enough: boolean;
}

/** SWR keys, so a write can refresh the right list. */
export const keys = {
  formats: "/api/ads/formats",
  products: "/api/ads/products",
  brands: "/api/ads/brands",
  campaigns: "/api/ads/campaigns",
  campaign: (id: string) => `/api/ads/campaigns/${id}`,
  photos: "/api/assets?kind=image&limit=60",
};

/** The style catalog. Public, so it loads for everyone. */
export function useFormats() {
  const { data, error, isLoading, mutate } = useSWR<{ formats: AdFormat[] }>(keys.formats, fetcher);
  return { formats: data?.formats ?? [], error, loading: isLoading, retry: () => mutate() };
}

/** A list that needs an account. Nothing is asked for until there is one. */
function useOwn<T>(key: string, pick: (d: unknown) => T[], refresh?: number) {
  const { user } = useSession();
  const { data, error, isLoading, mutate } = useSWR(user ? key : null, fetcher, refresh ? { refreshInterval: refresh } : undefined);
  return { list: data ? pick(data) : [], error, loading: !!user && isLoading, mutate };
}

export function useProducts() {
  return useOwn<Product>(keys.products, (d) => (d as { products: Product[] }).products);
}

export function useBrands() {
  return useOwn<BrandKit>(keys.brands, (d) => (d as { brandKits: BrandKit[] }).brandKits);
}

export function usePhotos() {
  return useOwn<Asset>(keys.photos, (d) => (d as { assets: Asset[] }).assets);
}

export function useCampaigns() {
  const own = useOwn<Campaign>(keys.campaigns, (d) => (d as { campaigns: Campaign[] }).campaigns);
  const running = own.list.some((c) => c.status === "running");
  // Keep the list fresh while something is being made, so covers and states update.
  useSWR(running ? `${keys.campaigns}#tick` : null, () => own.mutate(), { refreshInterval: 4000 });
  return own;
}

/** One campaign with its ads, polled every 2.5 s while it runs. */
export function useCampaign(id: string | null) {
  const { data, error, mutate } = useSWR<{ campaign: Campaign }>(id ? keys.campaign(id) : null, fetcher, {
    refreshInterval: (latest) => (latest?.campaign.status === "running" ? 2500 : 0),
    shouldRetryOnError: false,
  });
  return { campaign: data?.campaign ?? null, error, mutate };
}

/** Every ad of a campaign, newest round first, in the order the player walks them. */
export function itemsOf(campaign: Campaign | null): { item: AdItem; formatName: string; output: string }[] {
  if (!campaign?.groups) return [];
  const all = campaign.groups.flatMap((g) => g.items.map((item) => ({ item, formatName: g.format.name, output: g.format.output })));
  return all.sort((a, b) => b.item.round - a.item.round || b.item.createdAt - a.item.createdAt || a.item.variation - b.item.variation);
}
