import type { Metadata } from "next";
import { Suspense } from "react";
import { AgentChat } from "@/components/agent/chat";

export const metadata: Metadata = { title: "Agent chat" };

export default function AgentChatPage({ params }: PageProps<"/agent/c/[id]">) {
  return (
    <Suspense fallback={<div className="h-dvh bg-surface-primary" />}>
      <ChatById params={params} />
    </Suspense>
  );
}

async function ChatById({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AgentChat id={id} />;
}
