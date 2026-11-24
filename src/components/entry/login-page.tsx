"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { loginCopy } from "@/content/entry";
import { routes } from "@/content/site";
import { useQueryParam } from "@/lib/browser";
import { useSession } from "@/lib/session";
import { buttonClass } from "@/ui";
import { LoginForm, LoginHeading, SmallPrint, safeNext, type LoginMode } from "./login-form";

/** /login and /join: the sign-in window as a page, for direct links. Honours ?next=<path>. */
export function LoginPage({ mode: initial }: { mode: LoginMode }) {
  const router = useRouter();
  const [mode, setMode] = useState<LoginMode>(initial);
  const next = safeNext(useQueryParam("next"));
  const { member } = useSession();

  return (
    <div className="flex flex-1 items-start justify-center px-4 py-10 sm:items-center">
      <section
        aria-labelledby="entry-heading"
        className="flex w-full max-w-[464px] flex-col rounded-4xl bg-surface-glass px-5 pt-16 backdrop-blur-[40px] sm:min-h-[676px] sm:px-16 sm:pt-[72px]"
      >
        <LoginHeading mode={mode} as="h1" id="entry-heading" />
        <div className="mt-8">
          {member ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <p className="text-sm leading-5 text-text-secondary">{loginCopy.signedInAs(member.name)}</p>
              <Link href={next ?? routes.home} className={buttonClass("white", "md", "h-12 w-full rounded-xl text-base")}>
                {loginCopy.pageDone}
              </Link>
            </div>
          ) : (
            <LoginForm
              mode={mode}
              onModeChange={(m) => {
                setMode(m);
                const q = next ? `?next=${encodeURIComponent(next)}` : "";
                window.history.replaceState(null, "", `${m === "join" ? routes.join : routes.login}${q}`);
              }}
              next={next ?? routes.home}
              onDone={() => router.refresh()}
              autoFocus
            />
          )}
        </div>
        <SmallPrint className="mt-auto pt-6 pb-8" />
      </section>
    </div>
  );
}
