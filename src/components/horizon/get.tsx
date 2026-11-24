import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { horizonCopy } from "@/content/horizon";
import { Artwork } from "@/ui";
import { Display } from "./parts";

const copy = horizonCopy.get;

/** "What you get": a picture card on the left, two cards stacked on the right. */
export function HorizonGet() {
  return (
    <section aria-labelledby="get-title" className="flex flex-col items-center gap-10 px-4 pt-20 pb-[120px] desktop:px-0">
      <header className="flex flex-col items-center gap-2 text-center">
        <span id="get-title">
          <Display lines={[copy.title]} className="items-center text-3xl leading-9 desktop:text-[40px] desktop:leading-[48px]" />
        </span>
        <p className="text-sm leading-5 text-text-tab">{copy.sub}</p>
      </header>

      <div className="grid w-full max-w-[1312px] grid-cols-1 gap-4 desktop:grid-cols-[648px_648px]">
        <div className="relative aspect-[648/492] overflow-hidden rounded-3xl border border-border-subtle desktop:h-[492px] desktop:aspect-auto">
          <Artwork name="horizon/get" className="absolute inset-0 size-full" />
          <div aria-hidden className="absolute inset-0" style={{ backgroundImage: "linear-gradient(180deg, #00000033 0%, #00000087 100%)" }} />
        </div>

        <div className="flex flex-col gap-4">
          <div className="relative flex flex-col items-center gap-2 overflow-hidden rounded-4xl border border-border-subtle bg-border-subtle px-6 py-10 text-center desktop:h-[211px] desktop:pt-[59px] desktop:pb-0">
            <p className="font-display text-3xl leading-9 font-bold tracking-[-0.025em] text-text-primary uppercase desktop:text-5xl desktop:leading-[56px]">
              {copy.big}
            </p>
            <p className="max-w-[420px] text-sm leading-5 text-text-tab">{copy.bigText}</p>
          </div>

          <div className="flex flex-1 flex-col gap-4 rounded-4xl border border-border-subtle bg-border-subtle p-6">
            <p className="text-xs leading-5 font-medium tracking-[0.0833em] text-text-idle uppercase">{copy.listTitle}</p>
            <ul className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
              {copy.list.map((item) => (
                <li key={item} className="flex min-w-0 items-start gap-2 text-sm leading-5 font-medium text-text-primary">
                  <Check size={16} strokeWidth={1.5} aria-hidden className="mt-0.5 shrink-0 text-brand" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4">
              <p className="text-xs leading-4 text-text-secondary">{copy.note}</p>
              <Link
                href={copy.today.href}
                className="inline-flex items-center gap-1 rounded-md text-sm leading-5 font-semibold text-brand transition-colors duration-150 hover:text-brand-glow"
              >
                {copy.today.label}
                <ArrowRight size={14} strokeWidth={1.5} aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
