import type { Metadata } from "next";
import { ConnectorsPanel } from "@/components/agent/panels";

export const metadata: Metadata = { title: "Connectors · Agent" };

export default function AgentConnectorsPage() {
  return <ConnectorsPanel />;
}
