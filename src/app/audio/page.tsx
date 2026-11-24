import type { Metadata } from "next";
import { AudioStudio } from "@/components/audio/audio-studio";
import { AppShell } from "@/components/shell/app-shell";

export const metadata: Metadata = { title: "Audio" };

export default function AudioPage() {
  return (
    <AppShell active="audio" fixed>
      <AudioStudio />
    </AppShell>
  );
}
