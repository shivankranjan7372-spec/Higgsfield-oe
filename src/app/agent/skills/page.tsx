import type { Metadata } from "next";
import { SkillsPanel } from "@/components/agent/panels";

export const metadata: Metadata = { title: "Skills · Agent" };

export default function AgentSkillsPage() {
  return <SkillsPanel />;
}
