import type { Metadata } from "next";
import { Suspense } from "react";
import { PostView } from "@/components/community/post-view";
import { AppShell } from "@/components/shell/app-shell";

export const metadata: Metadata = { title: "Post" };

async function Post({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PostView id={id} />;
}

export default function PostPage({ params }: PageProps<"/community/post/[id]">) {
  return (
    <AppShell active="explore">
      <Suspense fallback={<div className="flex-1 bg-black" />}>
        <Post params={params} />
      </Suspense>
    </AppShell>
  );
}
