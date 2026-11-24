import type { Metadata } from "next";
import { AppShell } from "@/components/shell/app-shell";
import { ShortsStudio } from "@/components/shorts/shorts-studio";

export const metadata: Metadata = { title: "Shorts" };

export default function ShortsPage() {
  return (
    <AppShell active="shorts" fixed>
      <ShortsStudio />
    </AppShell>
  );
}
