import type { Metadata } from "next";
import { AppsCatalog } from "@/components/apps/apps-catalog";
import { AppShell } from "@/components/shell/app-shell";

export const metadata: Metadata = { title: "Apps" };

export default function AppsPage() {
  return (
    <AppShell active="apps" footer>
      <AppsCatalog />
    </AppShell>
  );
}
