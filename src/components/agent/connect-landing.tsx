"use client";

import { CheckCircle2, CircleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { mutate } from "swr";
import { Logo } from "@/components/brand/logo";
import { copy, agentRoutes } from "@/content/agent";
import { api, errorMessage } from "@/lib/api";
import { useLive, useQueryParam } from "@/lib/browser";
import { Button, ButtonLink, Spinner } from "@/ui";
import { keys } from "./data";

/**
 * Where an app's sign-in window lands. It reads `connected_account_id` from the address,
 * asks the server to finish the connection, shows the result and closes itself.
 */
export function ConnectLanding({ slug }: { slug: string }) {
  const id = useQueryParam("connected_account_id");
  const [state, setState] = useState<{ kind: "checking" | "done" | "failed"; text?: string; app?: string }>({ kind: "checking" });

  const live = useLive();
  const lacking = live && !id;

  useEffect(() => {
    if (!id) return;
    const found = id;
    let closed = false;
    api<{ connection: { app: string; status: string } }>(`/api/agent/connectors/apps/${encodeURIComponent(slug)}/callback?connected_account_id=${encodeURIComponent(found)}`)
      .then((res) => {
        setState({ kind: "done", app: res.connection.app });
        void mutate(keys.connectors);
        // Tell the page that opened us, then close after a moment to let the member read it.
        try {
          window.opener?.postMessage({ type: "parallax:connected", app: res.connection.app }, window.location.origin);
        } catch {}
        window.setTimeout(() => {
          if (!closed && window.opener) window.close();
        }, 1800);
      })
      .catch((e) => setState({ kind: "failed", text: errorMessage(e) }));
    return () => {
      closed = true;
    };
  }, [slug, id]);

  const shown = lacking ? { kind: "failed" as const, text: copy.connect.missing, app: undefined } : state;
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-surface-primary px-6 text-center text-text-primary">
      <Logo />
      <div className="flex max-w-[380px] flex-col items-center gap-4 rounded-3xl border border-border-subtle bg-surface-secondary p-8" role="status">
        {shown.kind === "checking" ? <Spinner /> : shown.kind === "done" ? <CheckCircle2 className="size-8 text-brand" strokeWidth={1.5} aria-hidden /> : <CircleAlert className="size-8 text-danger" strokeWidth={1.5} aria-hidden />}
        <p className="text-sm leading-5">
          {shown.kind === "checking" ? copy.connect.checking : shown.kind === "done" ? copy.connect.done(shown.app ?? slug) : shown.text || copy.connect.failed}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.close()}>
            {copy.connect.close}
          </Button>
          <ButtonLink href={agentRoutes.connectors} variant="soft" size="sm">
            {copy.connect.back}
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
