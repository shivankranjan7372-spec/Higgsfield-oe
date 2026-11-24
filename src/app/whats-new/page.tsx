import type { Metadata } from "next";
import { WhatsNewPage } from "@/components/entry/whats-new-page";
import { AppShell } from "@/components/shell/app-shell";

export const metadata: Metadata = { title: "What's new" };

export default function WhatsNewRoute() {
  return (
    <AppShell>
      <WhatsNewPage />
    </AppShell>
  );
}
