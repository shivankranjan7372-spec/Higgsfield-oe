import type { Metadata } from "next";
import { Suspense } from "react";
import { AppRunner, AppRunnerSkeleton } from "@/components/apps/app-runner";
import { AppShell } from "@/components/shell/app-shell";

export const metadata: Metadata = { title: "Apps" };

export default function AppPage({ params }: PageProps<"/apps/[id]">) {
  return (
    <AppShell active="apps" footer>
      <Suspense fallback={<AppRunnerSkeleton />}>{params.then(({ id }) => <AppRunner id={id} />)}</Suspense>
    </AppShell>
  );
}
