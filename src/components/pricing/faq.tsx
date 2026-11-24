"use client";

import { Accordion } from "radix-ui";
import { ChevronDown } from "lucide-react";
import { pricingCopy as t } from "@/content/pricing";

export function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="mx-auto flex w-full max-w-[640px] flex-col items-center gap-8 pt-[60px]">
      <h2 id="faq-title" className="text-center font-display text-[28px] leading-9 font-bold text-text-primary sm:text-4xl sm:leading-[44px]">
        {t.faq.title}
      </h2>
      <Accordion.Root type="single" collapsible className="flex w-full flex-col gap-3">
        {t.faq.items.map((item, i) => (
          <Accordion.Item
            key={item.q}
            value={`q${i}`}
            className="overflow-hidden rounded-md border border-[#D9D9D90A] bg-surface-shell transition-colors duration-150 hover:bg-surface-primary"
          >
            <Accordion.Header>
              <Accordion.Trigger className="group flex min-h-[60px] w-full items-center justify-between gap-4 px-[20px] py-[17px] text-left text-base leading-[26px] font-semibold text-text-primary sm:text-lg">
                {item.q}
                <ChevronDown
                  className="size-5 shrink-0 text-text-nav transition-transform duration-150 group-data-[state=open]:rotate-180"
                  strokeWidth={1.5}
                  aria-hidden
                />
              </Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content className="px-[20px] pb-5 text-sm leading-[22px] text-text-nav">{item.a}</Accordion.Content>
          </Accordion.Item>
        ))}
      </Accordion.Root>
    </section>
  );
}
