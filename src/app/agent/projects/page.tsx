import type { Metadata } from "next";
import { ProjectsPanel } from "@/components/agent/panels";

export const metadata: Metadata = { title: "Projects · Agent" };

export default function AgentProjectsPage() {
  return <ProjectsPanel />;
}
