"use client";

import { X } from "lucide-react";
import { Dialog as D } from "radix-ui";
import { useState } from "react";
import { loginCopy } from "@/content/entry";
import { LoginForm, LoginHeading, SmallPrint, type LoginMode } from "./login-form";

export interface LoginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Which side to show first. */
  mode?: "login" | "join";
  /** Where to go after signing in. Defaults to staying on the current page. */
  next?: string;
}

/**
 * The sign-in window that opens over any page. The nav opens it; so may any screen.
 *
 *   const [open, setOpen] = useState(false);
 *   <LoginDialog open={open} onOpenChange={setOpen} mode="join" />
 *
 * Email and password, with a switch between "create account" and "log in". After the server
 * accepts, the window closes, or the page goes to `next` (a path on this site only).
 */
export function LoginDialog({ open, onOpenChange, mode = "login", next }: LoginDialogProps) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 animate-fade-in bg-scrim" />
        {/* Remounted on each open, so it starts on the side the caller asked for. */}
        {open ? <LoginWindow initial={mode} next={next} onClose={() => onOpenChange(false)} /> : null}
      </D.Portal>
    </D.Root>
  );
}

function LoginWindow({ initial, next, onClose }: { initial: LoginMode; next?: string; onClose: () => void }) {
  const [mode, setMode] = useState<LoginMode>(initial);
  return (
    <D.Content
      aria-describedby={undefined}
      className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-32px)] w-[min(464px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 animate-fade-in flex-col overflow-y-auto rounded-4xl bg-surface-glass text-text-primary outline-none backdrop-blur-[40px] scroll-quiet desktop:h-[676px] sm:min-h-[676px]"
    >
      <D.Title className="sr-only">{loginCopy[mode].title}</D.Title>
      <div className="mx-auto flex w-full max-w-[336px] flex-1 flex-col px-0 pt-[72px] max-sm:px-5 max-sm:pt-16">
        <LoginHeading mode={mode} />
        <div className="mt-8">
          <LoginForm mode={mode} onModeChange={setMode} next={next} onDone={onClose} autoFocus />
        </div>
        <SmallPrint className="mt-auto w-[min(400px,calc(100vw-48px))] self-center pt-6 pb-8" />
      </div>
      <D.Close
        aria-label="Close"
        className="absolute top-3 right-3 flex size-8 items-center justify-center rounded-full border border-[#FFFFFF0A] bg-border-subtle text-text-primary transition-colors duration-150 hover:bg-border-default"
      >
        <X className="size-3" strokeWidth={2.5} aria-hidden />
      </D.Close>
    </D.Content>
  );
}
