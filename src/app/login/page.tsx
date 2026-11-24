import type { Metadata } from "next";
import { LoginPage } from "@/components/entry/login-page";
import { AppShell } from "@/components/shell/app-shell";

export const metadata: Metadata = { title: "Log in" };

export default function LoginRoute() {
  return (
    <AppShell>
      <LoginPage mode="login" />
    </AppShell>
  );
}
