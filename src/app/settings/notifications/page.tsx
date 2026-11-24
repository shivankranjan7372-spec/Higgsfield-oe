import type { Metadata } from "next";
import { NotificationSettings } from "@/components/account/notification-settings";
import { AppShell } from "@/components/shell/app-shell";

export const metadata: Metadata = { title: "Notification settings" };

export default function NotificationSettingsPage() {
  return (
    <AppShell>
      <NotificationSettings />
    </AppShell>
  );
}
