import type { ComponentType, ReactNode } from "react";
import { cn } from "@/ui";

/** The 24px dark plate with an inner highlight that holds each sidebar icon. */
export function IconPlate({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-md border border-[#C5C5C53D] bg-origin-border text-text-primary [box-shadow:#FFFFFF3D_0px_2px_4px_inset]",
        className,
      )}
      style={{ backgroundImage: "linear-gradient(in oklab 135deg, #222221 4%, #3B3C3A 93%)" }}
    >
      {children}
    </span>
  );
}

/** The 28px glass tile beside a gallery card's title. */
export function GlassTile({ icon: Icon }: { icon: ComponentType<{ className?: string; strokeWidth?: number }> }) {
  return (
    <span className="relative flex size-7 shrink-0 items-center justify-center overflow-clip rounded-sm border border-[#C5C5C53D] bg-border-subtle backdrop-blur-[12px] [box-shadow:#B9B9B959_0px_-0.3px_6px_inset]">
      <span aria-hidden className="absolute inset-0 mix-blend-overlay" style={{ backgroundImage: "linear-gradient(in oklab 0deg, #00000000 0%, #FFFFFF33 100%)" }} />
      <Icon className="relative size-4 text-text-primary" strokeWidth={1.5} />
    </span>
  );
}

export const ico = "size-4 shrink-0";
