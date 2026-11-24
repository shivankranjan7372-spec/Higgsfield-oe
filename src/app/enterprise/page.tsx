import type { Metadata } from "next";
import { EnterprisePage } from "@/components/pricing/enterprise-page";
import { AppShell } from "@/components/shell/app-shell";

export const metadata: Metadata = { title: "Teams" };

export default function Enterprise() {
  return (
    <AppShell active="enterprise" nav="full" footer>
      <EnterprisePage />
    </AppShell>
  );
}
