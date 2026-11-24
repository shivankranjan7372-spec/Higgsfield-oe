import { MousePointer2 } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { canvasCopy } from "@/content/canvas";
import { Artwork, cn } from "@/ui";

/**
 * The drawn board across the top of /canvas: a few cards joined by threads around the
 * headline, as if picked on a canvas. Positions are the design's, measured on an 1800-wide
 * strip whose centre sits on the page's centre, so it crops evenly on narrower windows.
 */

const c = canvasCopy.hero;

/** The little grey joint where a thread meets a card. */
function Joint({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <span
      aria-hidden
      style={{ backgroundImage: "linear-gradient(180deg, #7D7D7D 0%, #92AFAD 100%)", ...style }}
      className={cn("block size-1 shrink-0 rounded-full border border-[#00000040] bg-origin-border", className)}
    />
  );
}

function Placed({ left, top, rotate, children }: { left: number; top: number; rotate?: number; children: ReactNode }) {
  return (
    <div className="absolute flex" style={{ left, top, rotate: rotate ? `${rotate}deg` : undefined }}>
      {children}
    </div>
  );
}

export function CanvasHero() {
  return (
    <section aria-labelledby="canvas-title" className="relative mx-4 h-[200px] shrink-0 overflow-clip sm:h-[350px]">
      <div className="absolute top-6 left-1/2 h-[270px] w-[1800px] origin-top -translate-x-1/2 scale-[0.68] sm:top-10 sm:scale-100">
        {/* The threads between the cards. */}
        <svg aria-hidden className="absolute inset-0" width="1800" height="270" viewBox="0 0 1800 270" fill="none">
          <g stroke="#FFFFFF" strokeOpacity="0.28" strokeWidth="1">
            <path d="M222 50 C 330 50, 350 110, 456 110" />
            <path d="M250 186 C 340 186, 360 110, 456 110" />
            <path d="M584 110 C 640 110, 615 97, 681 97" />
            <path d="M1119 97 C 1170 97, 1150 117, 1211 117" />
            <path d="M1391 117 C 1470 117, 1470 206, 1549 206" />
          </g>
        </svg>

        <Placed left={121} top={2} rotate={2}>
          <div className="flex items-center gap-[2px] pl-[6px]">
            <div className="flex size-[90px] items-center justify-center rounded-[13px] bg-[#FFFFFF14] shadow-[#FFFFFF1F_0.3px_0.3px_0.3px_inset]">
              <Artwork name="canvas/hero-detail" className="size-[82px] rounded-lg" />
            </div>
            <Joint />
          </div>
        </Placed>

        <Placed left={108} top={149} rotate={-2}>
          <div className="flex items-center gap-[2px] pl-[6px]">
            <div
              className="flex h-[78px] w-[132px] items-center justify-center rounded-lg shadow-[#FFFFFF80_-0.2px_0.2px_0.2px_inset]"
              style={{ backgroundImage: "linear-gradient(126deg, #FFFFFF08 2%, #FFFFFF1A 98%)" }}
            >
              <p className="line-clamp-6 w-[120px] text-[8px] leading-[11px] font-medium text-text-tab">{c.note}</p>
            </div>
            <Joint />
          </div>
        </Placed>

        {/* A cursor with a comment, as drawn. */}
        <div className="absolute top-[83px] left-[272px] h-10 w-[78px]" aria-hidden>
          <MousePointer2 className="absolute top-0 left-0 size-3 fill-[#2BB24C] text-[#2BB24C]" strokeWidth={1.5} />
          <div className="absolute top-[10px] left-[6px] rounded-[5px] bg-[#2BB24C] px-[6px] py-[3px] shadow-[#FFFFFF66_0_0.5px_0_inset]">
            <p className="text-[7px] leading-[8px] text-[#FFFFFFB3]">{c.cursorLabel}</p>
            <p className="text-[10px] leading-3 font-medium whitespace-nowrap text-text-primary">{c.bubble}</p>
          </div>
        </div>

        <Placed left={454} top={22} rotate={3}>
          <div className="flex items-center gap-[2px]">
            <Joint />
            <div className="flex h-[170px] w-[116px] items-center justify-center rounded-[13px] bg-border-strong shadow-[#FFFFFF1F_0.3px_0.3px_0.3px_inset]">
              <Artwork name="canvas/hero-portrait" className="h-[162px] w-[108px] rounded-lg" />
            </div>
            <Joint />
          </div>
        </Placed>

        {/* The headline, picked like a text box on the board. */}
        <div className="absolute top-[27px] left-[679px] h-[140px] w-[442px]">
          <Joint className="absolute top-[68px] left-0" />
          <Joint className="absolute top-[68px] left-[438px]" />
          <div className="absolute top-0 left-[6px] flex h-[140px] w-[430px] flex-col items-center justify-center gap-2 border border-[#1886F5]">
            <p
              className="bg-clip-text font-mono text-sm leading-5 font-bold text-transparent uppercase"
              style={{ backgroundImage: "linear-gradient(90deg, #FFFFFF5C 0%, #FFFFFFB8 50%, #FFFFFF5C 100%)" }}
            >
              {c.eyebrow}
            </p>
            <h1 id="canvas-title" className="flex flex-col items-center font-display text-[40px] leading-10 font-bold tracking-[-0.04em] text-text-primary uppercase">
              <span className="whitespace-nowrap">{c.line1}</span>
              <span className="whitespace-nowrap">{c.line2}</span>
            </h1>
            {[
              "-top-1 -left-1",
              "-top-1 -right-1",
              "-bottom-1 -left-1",
              "-right-1 -bottom-1",
            ].map((p) => (
              <span key={p} aria-hidden className={cn("absolute size-2 rounded-full border border-[#1886F5] bg-text-primary", p)} />
            ))}
          </div>
        </div>

        <Placed left={1209} top={57} rotate={-2}>
          <div className="flex items-center gap-[2px]">
            <Joint />
            <div className="flex h-[114px] w-[170px] items-center justify-center rounded-[13px] bg-border-strong shadow-[#FFFFFF1F_0.3px_0.3px_0.3px_inset]">
              <Artwork name="canvas/hero-motion" className="h-[106px] w-[162px] rounded-lg" />
            </div>
            <Joint />
          </div>
        </Placed>

        {/* A hand-drawn tick and a second cursor. */}
        <div className="absolute top-8 left-[1457px] h-12 w-[93px]" aria-hidden>
          <svg width="56" height="30" viewBox="0 0 56 30" fill="none" className="absolute top-1 left-0">
            <path d="M3 17 C 8 22, 11 26, 15 26 C 22 25, 34 10, 53 3" stroke="#2BB24C" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
          <MousePointer2 className="absolute top-[22px] left-[50px] size-3 fill-[#2BB24C] text-[#2BB24C]" strokeWidth={1.5} />
          <span className="absolute top-[32px] left-[55px] rounded-full bg-[#2BB24C] px-[6px] py-[2px] text-[10px] leading-3 font-medium text-text-primary">
            {c.cursorLabel2}
          </span>
        </div>

        <Placed left={1547} top={149} rotate={-2}>
          <div className="flex items-center gap-[2px]">
            <Joint />
            <div className="flex h-[108px] w-[186px] items-center justify-center rounded-[13px] bg-[#FFFFFF14] shadow-[#FFFFFF1F_0.3px_0.3px_0.3px_inset]">
              <Artwork name="canvas/hero-wide" className="h-[100px] w-[178px] rounded-lg" />
            </div>
          </div>
        </Placed>
      </div>
    </section>
  );
}
