import type { Metadata } from "next";
import { ImageStudio } from "@/components/image/image-studio";
import { AppShell } from "@/components/shell/app-shell";

export const metadata: Metadata = { title: "Image" };

export default function ImagePage() {
  return (
    <AppShell active="image" fixed>
      <ImageStudio />
    </AppShell>
  );
}
