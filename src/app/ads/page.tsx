import type { Metadata } from "next";
import { AdsStudio } from "@/components/ads/ads-studio";
import { AppShell } from "@/components/shell/app-shell";

export const metadata: Metadata = { title: "Ad Campaigns" };

export default function AdsPage() {
  return (
    <AppShell active="ads" fixed>
      <AdsStudio />
    </AppShell>
  );
}
