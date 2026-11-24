import type { Metadata } from "next";
import { GuidePage } from "@/components/horizon/guide";
import { AppShell } from "@/components/shell/app-shell";
import { guideCopy } from "@/content/horizon";

export const metadata: Metadata = { title: guideCopy.meta.title, description: guideCopy.meta.description };

export default function Page() {
  return (
    <AppShell footer>
      <GuidePage />
    </AppShell>
  );
}
