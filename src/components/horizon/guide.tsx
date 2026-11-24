"use client";

import { ArrowRight, ArrowUpRight, Lightbulb } from "lucide-react";
import Link from "next/link";
import { CREDIT_USD, formatCredits, GUEST_CREDITS, MAX_BATCH, MILLI, PLANS, SIGNUP_CREDITS } from "@/config/economy";
import { guideCopy } from "@/content/horizon";
import { routes } from "@/content/site";
import { useSession } from "@/lib/session";
import { defaultModel } from "@/registry";
import { Artwork, cn, Tag } from "@/ui";
import { Display, headlineFill } from "./parts";

const copy = guideCopy;
const card = "rounded-4xl border border-border-subtle bg-border-subtle";

/** The Guide: credits, studios and prompt tips, in the Horizon page's visual language. Not drawn. */
export function GuidePage() {
  return (
    <div className="flex w-full min-w-0 flex-col items-center bg-black px-4 pb-[120px] desktop:px-0">
      <header className="flex flex-col items-center gap-[6px] pt-16 pb-10 text-center desktop:pt-20">
        <p className="text-xs leading-5 font-medium tracking-[0.0833em] text-text-idle uppercase">{copy.eyebrow}</p>
        <Display as="h1" lines={[copy.title]} className="items-center text-3xl leading-9 desktop:text-[40px] desktop:leading-[48px]" />
        <p className="mt-2 text-sm leading-5 text-text-tab">{copy.lead}</p>
        <nav aria-label={copy.eyebrow} className="mt-6 flex h-10 items-center gap-1 rounded-full border border-border-subtle bg-border-subtle px-[3px]">
          {copy.nav.map((n) => (
            <a
              key={n.id}
              href={`#${n.id}`}
              className="flex h-8 items-center rounded-full px-3 text-xs leading-4 font-medium text-text-tab transition-colors duration-150 hover:bg-border-subtle hover:text-text-primary"
            >
              {n.label}
            </a>
          ))}
        </nav>
      </header>

      <div className="flex w-full max-w-[1312px] flex-col gap-20">
        <Credits />
        <Studios />
        <Prompts />
      </div>
    </div>
  );
}

function SectionTitle({ id, children }: { id: string; children: string }) {
  return (
    <h2 id={`${id}-title`} className="font-display text-2xl leading-8 font-bold tracking-[-0.04em] uppercase desktop:text-3xl">
      <span className="bg-clip-text text-transparent" style={headlineFill}>
        {children}
      </span>
    </h2>
  );
}

function Credits() {
  const c = copy.credits;
  const facts = [
    { value: formatCredits(SIGNUP_CREDITS * MILLI), text: c.facts.signup },
    { value: formatCredits(GUEST_CREDITS * MILLI), text: c.facts.guest },
    { value: `$${CREDIT_USD.toFixed(2)}`, text: c.facts.value },
    { value: String(MAX_BATCH), text: c.facts.batch },
  ];
  return (
    <section id="credits" aria-labelledby="credits-title" className="flex scroll-mt-20 flex-col gap-6">
      <div className="flex flex-col gap-2">
        <SectionTitle id="credits">{c.title}</SectionTitle>
        <p className="max-w-[560px] text-sm leading-5 font-medium text-text-idle">{c.lead}</p>
      </div>

      <ul className="grid grid-cols-2 gap-4 desktop:grid-cols-4">
        {facts.map((f) => (
          <li key={f.text} className={cn(card, "flex flex-col gap-2 p-6")}>
            <span className="font-display text-3xl leading-9 font-bold text-text-primary desktop:text-[40px] desktop:leading-[48px]">{f.value}</span>
            <span className="text-sm leading-5 text-text-tab">{f.text}</span>
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-1 gap-4 desktop:grid-cols-2">
        <div className={cn(card, "flex flex-col gap-4 p-6")}>
          <ul className="flex flex-col gap-3">
            {c.rules.map((r) => (
              <li key={r} className="flex items-start gap-3 text-sm leading-5 font-medium text-text-primary">
                <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-brand" />
                {r}
              </li>
            ))}
          </ul>
          <Balance />
        </div>

        <div className={cn(card, "flex flex-col gap-4 p-6")}>
          <p className="text-xs leading-5 font-medium tracking-[0.0833em] text-text-idle uppercase">{c.plansTitle}</p>
          <ul className="flex flex-col">
            {Object.values(PLANS).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-4 border-b border-border-subtle py-3 last:border-b-0">
                <span className="min-w-0">
                  <span className="block text-sm leading-5 font-semibold text-text-primary">{p.name}</span>
                  <span className="block text-xs leading-4 text-text-secondary">{c.concurrent(p.concurrency)}</span>
                </span>
                <span className="shrink-0 text-right text-sm leading-5 text-text-tab">
                  <span className="font-mono text-text-primary">{formatCredits(p.monthlyCredits * MILLI)}</span> {c.perMonth}
                </span>
              </li>
            ))}
          </ul>
          <Link
            href={c.pricing.href}
            className="mt-auto inline-flex w-fit items-center gap-1 rounded-md text-sm leading-5 font-semibold text-brand transition-colors duration-150 hover:text-brand-glow"
          >
            {c.pricing.label}
            <ArrowRight size={14} strokeWidth={1.5} aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}

function Balance() {
  const c = copy.credits;
  const { user, member, balance, loading } = useSession();
  if (loading) return <div aria-hidden className="mt-auto h-12 shimmer rounded-xl bg-border-subtle" />;
  return (
    <div className="mt-auto flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-subtle bg-black/30 px-4 py-3">
      {user ? (
        <p className="text-sm leading-5 text-text-tab">
          {c.balanceLabel}: <span className="font-mono font-semibold text-text-primary">{formatCredits(balance)}</span>
        </p>
      ) : (
        <p className="text-sm leading-5 text-text-tab">{c.signedOut}</p>
      )}
      {member ? null : (
        <Link
          href={`${routes.join}?next=${encodeURIComponent(routes.guide)}`}
          className="inline-flex h-8 items-center rounded-md bg-brand px-3 text-sm leading-4 font-semibold text-text-inverse transition-colors duration-150 hover:bg-brand-glow"
        >
          {c.join}
        </Link>
      )}
    </div>
  );
}

function Studios() {
  const s = copy.studios;
  return (
    <section id="studios" aria-labelledby="studios-title" className="flex scroll-mt-20 flex-col gap-6">
      <SectionTitle id="studios">{s.title}</SectionTitle>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {s.items.map((it) => (
          <li key={it.id}>
            <Link
              href={it.href}
              className={cn(card, "group flex h-full flex-col overflow-hidden transition-colors duration-150 hover:bg-border-default")}
            >
              <Artwork name={`guide/studio-${it.id}`} className="aspect-[16/7] w-full" />
              <span className="flex flex-1 flex-col gap-1 p-5">
                <span className="flex items-center gap-2">
                  <span className="text-base leading-6 font-semibold text-text-primary">{it.name}</span>
                  {"soon" in it ? <Tag tone="neutral">{it.soon}</Tag> : null}
                  <ArrowUpRight size={16} strokeWidth={1.5} aria-hidden className="ml-auto text-text-tab transition-colors duration-150 group-hover:text-brand" />
                </span>
                <span className="text-sm leading-5 text-text-tab">{it.text}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Prompts() {
  const p = copy.prompts;
  const model = defaultModel("image");
  const href = `${routes.image}?${model ? `model=${model.id}&` : ""}prompt=${encodeURIComponent(p.example.text)}`;
  return (
    <section id="prompts" aria-labelledby="prompts-title" className="flex scroll-mt-20 flex-col gap-6">
      <SectionTitle id="prompts">{p.title}</SectionTitle>
      <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {p.tips.map((t, i) => (
          <li key={t.title} className={cn(card, "flex flex-col gap-2 p-6")}>
            <span className="font-mono text-xs leading-4 text-brand">{String(i + 1).padStart(2, "0")}</span>
            <span className="text-base leading-6 font-semibold text-text-primary">{t.title}</span>
            <span className="text-sm leading-5 text-text-tab">{t.text}</span>
          </li>
        ))}
      </ol>
      <div className={cn(card, "flex flex-col gap-4 p-6 desktop:flex-row desktop:items-center desktop:justify-between")}>
        <div className="flex min-w-0 items-start gap-3">
          <Lightbulb size={20} strokeWidth={1.5} aria-hidden className="mt-0.5 shrink-0 text-brand" />
          <p className="min-w-0 text-sm leading-5 text-text-tab">
            <span className="font-semibold text-text-primary">{p.example.label}: </span>
            {p.example.text}
          </p>
        </div>
        <Link
          href={href}
          className="inline-flex h-10 w-fit shrink-0 items-center gap-2 rounded-lg bg-text-primary px-4 text-sm leading-4 font-semibold text-text-inverse transition-colors duration-150 hover:bg-text-soft"
        >
          {p.example.cta}
          <ArrowRight size={14} strokeWidth={1.5} aria-hidden />
        </Link>
      </div>
    </section>
  );
}
