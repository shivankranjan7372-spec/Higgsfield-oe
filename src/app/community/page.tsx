import type { Metadata } from "next";
import { CommunityPage } from "@/components/community/community-page";
import { AppShell } from "@/components/shell/app-shell";

export const metadata: Metadata = { title: "Community" };

export default function Community() {
  return (
    <AppShell active="explore">
      <CommunityPage />
    </AppShell>
  );
}
