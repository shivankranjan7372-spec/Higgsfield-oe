import type { Metadata } from "next";
import { AgentHome } from "@/components/agent/home";

export const metadata: Metadata = { title: "Agent" };

export default function AgentPage() {
  return <AgentHome />;
}
