import type { Metadata } from "next";
import { CanvasBoard } from "@/components/canvas/board";
import { AppShell } from "@/components/shell/app-shell";
import { canvasCopy } from "@/content/canvas";

export const metadata: Metadata = { title: canvasCopy.meta.board };

export default function CanvasBoardPage() {
  return (
    <AppShell active="canvas" fixed>
      <CanvasBoard />
    </AppShell>
  );
}
