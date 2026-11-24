import type { Metadata } from "next";
import { LoginPage } from "@/components/entry/login-page";
import { AppShell } from "@/components/shell/app-shell";

export const metadata: Metadata = { title: "Create your account" };

export default function JoinRoute() {
  return (
    <AppShell>
      <LoginPage mode="join" />
    </AppShell>
  );
}
