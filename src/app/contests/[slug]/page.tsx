import type { Metadata } from "next";
import { Suspense } from "react";
import { ContestView } from "@/components/community/contest-view";
import { AppShell } from "@/components/shell/app-shell";

export const metadata: Metadata = { title: "Contest" };

async function One({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ContestView slug={slug} />;
}

export default function ContestPage({ params }: PageProps<"/contests/[slug]">) {
  return (
    <AppShell active="contests">
      <Suspense fallback={<div className="flex-1 bg-black" />}>
        <One params={params} />
      </Suspense>
    </AppShell>
  );
}
