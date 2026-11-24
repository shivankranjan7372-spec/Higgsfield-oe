import type { Metadata } from "next";
import { PricingPage } from "@/components/pricing/pricing-page";
import { AppShell } from "@/components/shell/app-shell";

export const metadata: Metadata = { title: "Pricing" };

export default function Pricing() {
  return (
    <AppShell active="pricing" nav="full" footer>
      <PricingPage />
    </AppShell>
  );
}
