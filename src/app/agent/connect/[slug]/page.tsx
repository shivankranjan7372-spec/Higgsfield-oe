import type { Metadata } from "next";
import { Suspense } from "react";
import { ConnectLanding } from "@/components/agent/connect-landing";

export const metadata: Metadata = { title: "Connecting an app" };

export default function ConnectPage({ params }: PageProps<"/agent/connect/[slug]">) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-surface-primary" />}>
      <BySlug params={params} />
    </Suspense>
  );
}

async function BySlug({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ConnectLanding slug={slug} />;
}
