import type { Metadata } from "next";
import { RemixStudio } from "@/components/remix/remix-studio";
import { AppShell } from "@/components/shell/app-shell";

export const metadata: Metadata = { title: "Remix" };

export default function RemixPage() {
  return (
    <AppShell active="remix" fixed>
      <RemixStudio />
    </AppShell>
  );
}
