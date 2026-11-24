import type { Metadata } from "next";
import { ExploreFeed } from "@/components/home/explore-feed";
import { AppShell } from "@/components/shell/app-shell";

export const metadata: Metadata = { title: "Explore" };

export default function ExplorePage() {
  return (
    <AppShell active="explore" nav="full" footer>
      <ExploreFeed />
    </AppShell>
  );
}
