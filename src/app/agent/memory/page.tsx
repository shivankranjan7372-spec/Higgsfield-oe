import type { Metadata } from "next";
import { MemoryPanel } from "@/components/agent/panels";

export const metadata: Metadata = { title: "Memory · Agent" };

export default function AgentMemoryPage() {
  return <MemoryPanel />;
}
