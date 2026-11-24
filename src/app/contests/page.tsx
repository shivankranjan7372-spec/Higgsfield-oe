import type { Metadata } from "next";
import { ContestList } from "@/components/community/contest-list";
import { AppShell } from "@/components/shell/app-shell";

export const metadata: Metadata = { title: "Contests" };

export default function ContestsPage() {
  return (
    <AppShell active="contests">
      <ContestList />
    </AppShell>
  );
}
