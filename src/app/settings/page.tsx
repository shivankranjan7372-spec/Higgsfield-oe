import type { Metadata } from "next";
import { SettingsPage } from "@/components/account/settings-page";
import { AppShell } from "@/components/shell/app-shell";

export const metadata: Metadata = { title: "Settings" };

export default function Settings() {
  return (
    <AppShell>
      <SettingsPage />
    </AppShell>
  );
}
