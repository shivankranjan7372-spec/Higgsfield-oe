import type { Metadata } from "next";
import { WalletPage } from "@/components/account/wallet-page";
import { AppShell } from "@/components/shell/app-shell";

export const metadata: Metadata = { title: "Wallet" };

export default function Wallet() {
  return (
    <AppShell>
      <WalletPage />
    </AppShell>
  );
}
