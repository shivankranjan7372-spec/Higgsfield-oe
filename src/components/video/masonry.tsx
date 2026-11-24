"use client";

import { useSyncExternalStore, type ReactNode } from "react";

const QUERIES = ["(min-width: 1024px)", "(min-width: 640px)"] as const;

function columns(): number {
  if (window.matchMedia(QUERIES[0]).matches) return 3;
  if (window.matchMedia(QUERIES[1]).matches) return 2;
  return 1;
}

function subscribe(on: () => void) {
  const lists = QUERIES.map((q) => window.matchMedia(q));
  lists.forEach((l) => l.addEventListener("change", on));
  return () => lists.forEach((l) => l.removeEventListener("change", on));
}

/**
 * The gallery's columns: three on a wide screen (330 wide, 16 apart, as drawn), two on a
 * tablet, one on a phone. Items are dealt left to right, so the first row reads in order.
 */
export function Masonry({
  label,
  items,
  className,
}: {
  label: string;
  items: { key: string; node: ReactNode }[];
  className?: string;
}) {
  const count = useSyncExternalStore(subscribe, columns, () => 3);
  const cols = Array.from({ length: count }, (_, c) =>
    items.filter((_, i) => i % count === c),
  );
  return (
    <div
      aria-label={label}
      role="region"
      className={`mx-auto flex w-full max-w-[1022px] items-start gap-4 ${className ?? ""}`}
    >
      {cols.map((col, c) => (
        <ul key={c} className="flex min-w-0 flex-1 flex-col gap-4">
          {col.map((item) => (
            <li key={item.key}>{item.node}</li>
          ))}
        </ul>
      ))}
    </div>
  );
}
