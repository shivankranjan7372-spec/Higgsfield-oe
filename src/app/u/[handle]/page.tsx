import type { Metadata } from "next";
import { Suspense } from "react";
import { ProfileView } from "@/components/community/profile-view";
import { AppShell } from "@/components/shell/app-shell";

export const metadata: Metadata = { title: "Profile" };

async function Member({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  return <ProfileView handle={decodeURIComponent(handle)} />;
}

export default function ProfilePage({ params }: PageProps<"/u/[handle]">) {
  return (
    <AppShell active="explore">
      <Suspense fallback={<div className="flex-1 bg-black" />}>
        <Member params={params} />
      </Suspense>
    </AppShell>
  );
}
