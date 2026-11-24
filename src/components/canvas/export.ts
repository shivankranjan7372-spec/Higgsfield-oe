import type { BoardItem } from "./store";

const PAD = 48;
const MAX = 4096;

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > width && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
  }
  return lines;
}

/**
 * Draws the board's pictures and notes, in layer order, onto a canvas element and returns it
 * as a PNG. The picture is the size of everything on the board plus a margin, shrunk to fit
 * 4096 pixels on its longest side. Pictures still being made are left out.
 */
export async function exportBoard(items: BoardItem[]): Promise<Blob | null> {
  const drawn = items.filter((i) => i.kind !== "pending");
  if (!drawn.length) return null;
  const minX = Math.min(...drawn.map((i) => i.x)) - PAD;
  const minY = Math.min(...drawn.map((i) => i.y)) - PAD;
  const maxX = Math.max(...drawn.map((i) => i.x + i.w)) + PAD;
  const maxY = Math.max(...drawn.map((i) => i.y + i.h)) + PAD;
  const scale = Math.min(2, MAX / Math.max(maxX - minX, maxY - minY));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round((maxX - minX) * scale));
  canvas.height = Math.max(1, Math.round((maxY - minY) * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(scale, scale);
  ctx.translate(-minX, -minY);
  ctx.fillStyle = "#0F1113";
  ctx.fillRect(minX, minY, maxX - minX, maxY - minY);

  const pictures = await Promise.all(drawn.map((i) => (i.kind === "image" && i.src ? loadImage(i.src) : Promise.resolve(null))));
  drawn.forEach((item, n) => {
    if (item.kind === "image") {
      const img = pictures[n];
      ctx.save();
      roundRect(ctx, item.x, item.y, item.w, item.h, 8);
      ctx.clip();
      if (img) ctx.drawImage(img, item.x, item.y, item.w, item.h);
      else {
        ctx.fillStyle = "#1C1E21";
        ctx.fill();
      }
      ctx.restore();
      return;
    }
    ctx.fillStyle = "#23262A";
    roundRect(ctx, item.x, item.y, item.w, item.h, 12);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.save();
    roundRect(ctx, item.x, item.y, item.w, item.h, 12);
    ctx.clip();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "500 14px Inter, system-ui, sans-serif";
    ctx.textBaseline = "top";
    wrap(ctx, item.text ?? "", item.w - 24).forEach((line, k) => ctx.fillText(line, item.x + 12, item.y + 12 + k * 20));
    ctx.restore();
  });

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}
