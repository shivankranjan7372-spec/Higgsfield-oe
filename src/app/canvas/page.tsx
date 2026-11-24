import type { Metadata } from "next";
import { CanvasHome } from "@/components/canvas/canvas-home";
import { AppShell } from "@/components/shell/app-shell";
import { canvasCopy } from "@/content/canvas";

export const metadata: Metadata = { title: canvasCopy.meta.landing };

export default function CanvasPage() {
  return (
    <AppShell active="canvas">
      <CanvasHome />
    </AppShell>
  );
}
