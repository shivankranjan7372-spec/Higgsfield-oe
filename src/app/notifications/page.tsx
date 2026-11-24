import type { Metadata } from "next";
import { NotificationsPage } from "@/components/entry/notifications-page";
import { AppShell } from "@/components/shell/app-shell";

export const metadata: Metadata = { title: "Notifications" };

export default function NotificationsRoute() {
  return (
    <AppShell>
      <NotificationsPage />
    </AppShell>
  );
}
