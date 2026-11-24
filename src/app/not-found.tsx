import type { Metadata } from "next";
import { AppShell } from "@/components/shell/app-shell";
import { routes } from "@/content/site";
import { ButtonLink } from "@/ui";

export const metadata: Metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <AppShell>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
        <p className="font-display text-5xl leading-none font-bold text-brand">404</p>
        <h1 className="font-display text-2xl leading-7 font-bold text-text-primary uppercase">Nothing at this address</h1>
        <p className="max-w-[420px] text-sm leading-5 text-text-muted">The page may have moved, or it is not built yet. The Image studio is open.</p>
        <ButtonLink href={routes.image} variant="lime" size="md">
          Go to Image
        </ButtonLink>
      </div>
    </AppShell>
  );
}
