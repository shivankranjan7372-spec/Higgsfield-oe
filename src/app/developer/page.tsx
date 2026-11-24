import type { Metadata } from "next";
import { DeveloperConsole } from "@/components/mcp/developer-console";
import { AppShell } from "@/components/shell/app-shell";

export const metadata: Metadata = { title: "Developer console" };

export default function Developer() {
  return (
    <AppShell active="developer">
      <DeveloperConsole />
    </AppShell>
  );
}
