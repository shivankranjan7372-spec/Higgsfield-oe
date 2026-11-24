"use client";

import { ArrowRight } from "lucide-react";
import { enterpriseCopy as t } from "@/content/pricing";
import { routes } from "@/content/site";
import { ButtonLink } from "@/ui";

const TITLE_GRAD = { backgroundImage: "linear-gradient(180deg, #FFFFFF 0%, #FFFFFFB2 100%)" };

/** What a team gets. No contact form: no API route backs one yet. */
export function EnterprisePage() {
  return (
    <div className="flex w-full flex-col px-4 pt-20 pb-20">
      <section className="mx-auto flex w-full max-w-[1088px] flex-col gap-3 pl-1">
        <p className="font-display text-sm leading-5 font-bold tracking-[-0.01em] text-brand uppercase">{t.eyebrow}</p>
        <h1
          className="bg-clip-text text-[32px] leading-10 font-semibold tracking-[-0.03em] text-transparent sm:text-[40px] sm:leading-[48px]"
          style={TITLE_GRAD}
        >
          {t.title}
        </h1>
        <p className="max-w-[640px] text-sm leading-5 text-text-tab">{t.sub}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <ButtonLink href={routes.pricing} variant="lime" size="md">
            {t.plansCta}
            <ArrowRight className="size-4" strokeWidth={1.5} aria-hidden />
          </ButtonLink>
          <ButtonLink href={routes.developer} variant="outline" size="md">
            {t.apiCta}
          </ButtonLink>
        </div>
      </section>

      <ul className="mx-auto mt-16 grid w-full max-w-[1088px] grid-cols-1 gap-4 sm:grid-cols-2 desktop:grid-cols-3">
        {t.points.map((p) => (
          <li
            key={p.title}
            className="flex flex-col gap-2 rounded-2xl border border-border-subtle bg-surface-primary p-6 transition-colors duration-150 hover:bg-surface-secondary"
          >
            <h2 className="text-base leading-6 font-semibold text-text-primary">{p.title}</h2>
            <p className="text-sm leading-5 text-text-nav">{p.body}</p>
          </li>
        ))}
      </ul>

      <section className="mx-auto mt-16 flex w-full max-w-[1088px] flex-col gap-2 rounded-3xl border border-[#FFFFFF0F] bg-page p-6">
        <h2 className="text-xl leading-7 font-bold text-text-primary">{t.contactTitle}</h2>
        <p className="max-w-[640px] text-sm leading-5 text-text-muted">{t.contactBody}</p>
      </section>
    </div>
  );
}
