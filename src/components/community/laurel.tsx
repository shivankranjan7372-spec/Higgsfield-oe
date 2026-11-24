import { useId } from "react";
import { cn } from "@/ui";

/** Where each pair of leaves sits on the stem, bottom to top: x, y, and the way the stem runs there (degrees). */
const NODES: [number, number, number][] = [
  [37.2, 82.5, -148],
  [26.9, 73.4, -129.7],
  [19.9, 61.6, -111.3],
  [17.1, 48.3, -93],
  [18.5, 34.6, -74.7],
  [24.2, 22.2, -56.3],
  [33.5, 12.1, -38],
];

const LEAF = "M0 0C3.5-4.2 11-4.6 15.5 0 11 4.6 3.5 4.2 0 0Z";

/**
 * Half a laurel wreath, drawn here: a curved stem with a pair of leaves at each node.
 * The silver runs top to bottom across the whole branch, so the leaves are a mask over one
 * painted box. `side="right"` mirrors it. Decorative, so it is hidden from screen readers.
 */
export function Laurel({ side = "left", className }: { side?: "left" | "right"; className?: string }) {
  const id = useId();
  const paint = `${id}-paint`;
  const shape = `${id}-shape`;
  return (
    <svg viewBox="0 0 62 90" aria-hidden className={cn(side === "right" && "-scale-x-100", className)}>
      <defs>
        <linearGradient id={paint} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.45" stopColor="#D4D4D4" />
          <stop offset="1" stopColor="#7E7E7E" />
        </linearGradient>
        <mask id={shape}>
          <g transform="translate(3 6) scale(0.9)" fill="#fff">
            <path d="M41.2 84.6A43 43 0 0 1 37.2 9.5" fill="none" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
            {NODES.map(([x, y, run]) => (
              <g key={run} transform={`translate(${x} ${y})`}>
                <path d={LEAF} transform={`rotate(${run - 46})`} />
                <path d={LEAF} transform={`rotate(${run + 50}) scale(0.72)`} />
              </g>
            ))}
            <path d={LEAF} transform="translate(37.2 9.5) rotate(-24) scale(0.8)" />
          </g>
        </mask>
      </defs>
      <rect width="62" height="90" fill={`url(#${paint})`} mask={`url(#${shape})`} />
    </svg>
  );
}
