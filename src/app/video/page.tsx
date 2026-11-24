import type { Metadata } from "next";
import { AppShell } from "@/components/shell/app-shell";
import { VideoStudio } from "@/components/video/video-studio";

export const metadata: Metadata = { title: "Video" };

export default function VideoPage() {
  return (
    <AppShell active="video" fixed>
      <VideoStudio />
    </AppShell>
  );
}
