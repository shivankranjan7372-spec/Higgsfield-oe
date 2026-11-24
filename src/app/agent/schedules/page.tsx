import type { Metadata } from "next";
import { SchedulesPanel } from "@/components/agent/panels";

export const metadata: Metadata = { title: "Schedules · Agent" };

export default function AgentSchedulesPage() {
  return <SchedulesPanel />;
}
