"use client";

import { Check } from "lucide-react";
import { useRef, useState } from "react";
import useSWR from "swr";
import { LoginDialog } from "@/components/entry/login-dialog";
import { horizonCopy } from "@/content/horizon";
import { routes } from "@/content/site";
import { api, errorMessage, fetcher } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Spinner } from "@/ui";

const copy = horizonCopy.news;

interface Prefs {
  preferences: { notices: Record<string, boolean> };
}

/** The lime button as drawn: 40 high, inset lime edge, two drop shadows. */
export const limeButton =
  "inline-flex h-10 shrink-0 items-center justify-center gap-[6px] rounded-lg px-3 text-sm leading-4 font-semibold whitespace-nowrap text-text-inverse transition-[filter] duration-150 hover:brightness-110 active:brightness-95 disabled:opacity-60 [box-shadow:#829B19_0px_-3px_0px_inset,#00000040_0px_6px_4px,#00000026_0px_32px_24px]";
export const limeFill = { backgroundImage: "linear-gradient(180deg, #FFFF1400 0%, #FFFF14 100%), linear-gradient(#D1FE17, #D1FE17)" };
/** The white button beside it. */
export const whiteButton =
  "inline-flex h-10 shrink-0 items-center justify-center rounded-lg bg-text-primary px-3 text-sm leading-4 font-semibold whitespace-nowrap text-text-inverse transition-colors duration-150 hover:bg-text-soft [box-shadow:#00000052_0px_-3px_0px_inset,#00000040_0px_6px_4px,#00000026_0px_32px_24px]";

type Note = { text: string; tone: "info" | "error"; action?: "retry" | "off" } | null;

/**
 * "Get launch news". There is no waitlist on the server, so this turns on the member's
 * `productNews` notice (PATCH /api/account/preferences). Guests and visitors are asked to
 * create an account first, because a guest has no address to send news to.
 * Returns the button and the one-line note that goes under the buttons.
 */
export function useLaunchNews() {
  const { member, loading } = useSession();
  const prefs = useSWR<Prefs>(member ? "/api/account/preferences" : null, fetcher);
  const [busy, setBusy] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  /** The sign-in window is opened from code, not a trigger, so give focus back by hand. */
  function onJoinChange(open: boolean) {
    setJoinOpen(open);
    if (!open) setTimeout(() => buttonRef.current?.focus(), 0);
  }
  const [note, setNote] = useState<Note>(null);
  const on = !!prefs.data?.preferences.notices.productNews;

  async function save(value: boolean) {
    setBusy(true);
    setNote(null);
    try {
      const next = await api<Prefs>("/api/account/preferences", { method: "PATCH", body: { notices: { productNews: value } } });
      await prefs.mutate(next, { revalidate: false });
      setNote(value ? { text: copy.onHint, tone: "info", action: "off" } : null);
    } catch (e) {
      setNote({ text: errorMessage(e), tone: "error", action: "retry" });
    }
    setBusy(false);
  }

  function press() {
    if (!member) {
      setNote({ text: copy.signedOutHint, tone: "info" });
      setJoinOpen(true);
    } else if (on) {
      setNote({ text: copy.onHint, tone: "info", action: "off" });
    } else {
      void save(true);
    }
  }

  const waiting = loading || (!!member && prefs.isLoading);

  const button = (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={limeButton}
        style={limeFill}
        onClick={press}
        disabled={busy || waiting}
        aria-busy={busy || waiting}
        aria-pressed={member ? on : undefined}
        data-news={on ? "on" : "off"}
      >
        {busy ? <Spinner /> : on ? <Check size={16} strokeWidth={1.5} aria-hidden /> : null}
        {busy ? copy.working : on ? copy.on : copy.cta}
      </button>
      <LoginDialog open={joinOpen} onOpenChange={onJoinChange} mode="join" next={routes.horizon} />
    </>
  );

  const noteLine = note ? (
    <p
      role={note.tone === "error" ? "alert" : "status"}
      className={note.tone === "error" ? "text-center text-sm leading-5 text-danger" : "text-center text-sm leading-5 text-text-tab"}
    >
      {note.text}{" "}
      {note.action ? (
        <button
          type="button"
          onClick={() => void save(note.action === "retry")}
          className="font-semibold text-text-primary underline underline-offset-2 transition-colors duration-150 hover:text-brand"
        >
          {note.action === "retry" ? copy.retry : copy.turnOff}
        </button>
      ) : null}
    </p>
  ) : null;

  return { button, noteLine };
}
