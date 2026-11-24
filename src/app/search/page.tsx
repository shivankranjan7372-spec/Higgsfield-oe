import type { Metadata } from "next";
import { SearchPage } from "@/components/entry/search-page";
import { AppShell } from "@/components/shell/app-shell";

export const metadata: Metadata = { title: "Search" };

export default function SearchRoute() {
  return (
    <AppShell>
      <SearchPage />
    </AppShell>
  );
}
