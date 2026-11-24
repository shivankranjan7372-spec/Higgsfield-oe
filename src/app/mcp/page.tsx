import type { Metadata } from "next";
import { McpPage } from "@/components/mcp/mcp-page";
import { AppShell } from "@/components/shell/app-shell";

export const metadata: Metadata = { title: "MCP server" };

export default function Mcp() {
  return (
    <AppShell active="mcp" footer>
      <McpPage />
    </AppShell>
  );
}
