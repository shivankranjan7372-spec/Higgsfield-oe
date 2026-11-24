import type { Metadata } from "next";
import { InvitePage } from "@/components/account/invite-page";
import { AppShell } from "@/components/shell/app-shell";

export const metadata: Metadata = { title: "Invite friends" };

export default function Invite() {
  return (
    <AppShell>
      <InvitePage />
    </AppShell>
  );
}
