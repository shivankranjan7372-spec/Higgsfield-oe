import type { Metadata } from "next";
import { HorizonPage } from "@/components/horizon/horizon-page";
import { AppShell } from "@/components/shell/app-shell";
import { horizonCopy } from "@/content/horizon";

export const metadata: Metadata = { title: horizonCopy.meta.title, description: horizonCopy.meta.description };

export default function Page() {
  return (
    <AppShell active="horizon" footer>
      <HorizonPage />
    </AppShell>
  );
}
