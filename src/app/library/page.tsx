import type { Metadata } from "next";
import { Library } from "@/components/library/library";
import { AppShell } from "@/components/shell/app-shell";

export const metadata: Metadata = { title: "Library" };

export default function LibraryPage() {
  return (
    <AppShell active="library" fixed>
      <Library />
    </AppShell>
  );
}
