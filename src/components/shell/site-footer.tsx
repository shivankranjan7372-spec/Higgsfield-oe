"use client";

import { ChevronDown, Languages } from "lucide-react";
import Link from "next/link";
import { footerWords, navWords } from "@/content/shell";
import { MenuItem, MenuLabel, Popover, PopoverContent, PopoverTrigger } from "@/ui";

/**
 * The 68px strip at the bottom of the home and marketing pages: the
 * legal line on the left, the language and our own links on the right. It takes no props;
 * `AppShell` draws it when a page asks for `footer`.
 */
export function SiteFooter() {
  return (
    <footer className="flex min-h-[68px] shrink-0 flex-col items-start justify-center gap-3 bg-page px-6 py-6 min-[900px]:flex-row min-[900px]:items-center min-[900px]:justify-between min-[900px]:py-0">
      <p className="flex flex-wrap items-center text-sm leading-5 text-[#FFFFFF99]">
        <span>{footerWords.legal}</span>
        <span>&nbsp;{footerWords.rights}</span>
      </p>
      <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <Popover>
          <PopoverTrigger
            aria-label={`${navWords.language}: ${navWords.english}`}
            className="flex h-5 items-center gap-2 rounded-sm text-sm leading-5 text-text-soft transition-colors duration-150 hover:text-text-primary"
          >
            <span className="flex size-5 items-center justify-center rounded-full bg-surface-menu text-text-secondary">
              <Languages className="size-3" strokeWidth={1.5} aria-hidden />
            </span>
            <span className="flex items-center">
              {navWords.english}
              <ChevronDown className="size-4 text-text-secondary" strokeWidth={1.5} aria-hidden />
            </span>
          </PopoverTrigger>
          <PopoverContent side="top" align="start" className="w-[200px]">
            <MenuLabel>{navWords.language}</MenuLabel>
            <MenuItem selected>{navWords.english}</MenuItem>
            <p className="px-2 pt-1 pb-2 text-xs leading-4 text-text-secondary">{navWords.languageNote}</p>
          </PopoverContent>
        </Popover>
        {footerWords.links.map((l) => (
          <Link
            key={l.label}
            href={l.href}
            className="rounded-sm text-sm leading-5 font-medium whitespace-nowrap text-text-soft transition-colors duration-150 hover:text-text-primary"
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </footer>
  );
}
