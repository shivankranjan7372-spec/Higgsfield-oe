"use client";

import { AtSign, Eye, EyeOff, Gift, Info, LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { LogoMark } from "@/components/brand/logo";
import { loginCopy as c } from "@/content/entry";
import { errorMessage } from "@/lib/api";
import { logIn, signUp, useSession } from "@/lib/session";
import { Spinner, cn } from "@/ui";

export type LoginMode = "login" | "join";

/** Only a path on this site: "/x", never "//host" or "https://…". */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || typeof next !== "string") return null;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  // URL parsing drops tabs and newlines and reads "\\" as "/", so "/\t/evil.example" would
  // still leave the site. Parse it the way the browser will and keep it only if it stays here.
  const base = "https://parallax.invalid";
  try {
    const url = new URL(next, base);
    if (url.origin !== base) return null;
    const path = url.pathname + url.search + url.hash;
    // "/.//host" normalises to "//host", which a browser would read as another site.
    return path.startsWith("//") ? null : path;
  } catch {
    return null;
  }
}

/* Sizes from the design: a 48-high row, 12 radius, the faint white fill. */
const row = "flex h-12 w-full items-center rounded-xl text-base leading-5 font-semibold transition-colors duration-150";
const field = cn(row, "gap-[6px] bg-border-subtle px-3 font-medium focus-within:bg-border-default hover:bg-border-default");

/** The two-line heading: "Start making / with ▣ Parallax". */
export function LoginHeading({ mode, as: Tag = "h2", id }: { mode: LoginMode; as?: "h1" | "h2"; id?: string }) {
  return (
    <Tag id={id} className="flex flex-col items-center text-center font-sans text-[32px] leading-9 font-semibold tracking-[-0.0375em] text-text-primary">
      <span>{c[mode].headline}</span>
      <span className="flex items-center gap-2">
        {c.withWord[mode]}
        <span className="flex items-center gap-2 text-brand">
          <LogoMark size={28} />
          {c.brandName}
        </span>
      </span>
    </Tag>
  );
}

/**
 * The email and password form, used by the sign-in window and by /login and /join.
 * `onDone` runs after the server accepted; when `next` is a safe path the form goes there.
 */
export function LoginForm({
  mode,
  onModeChange,
  next,
  onDone,
  autoFocus,
}: {
  mode: LoginMode;
  onModeChange: (m: LoginMode) => void;
  next?: string | null;
  onDone?: () => void;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const { user } = useSession();
  const guest = !!user?.isGuest;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const ids = useId();
  const words = c[mode];

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setProblem(null);
    try {
      if (mode === "join") await signUp({ email: email.trim(), password });
      else await logIn({ email: email.trim(), password });
      const to = safeNext(next);
      onDone?.();
      if (to) router.push(to);
    } catch (err) {
      setProblem(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex w-full flex-col" aria-describedby={problem ? `${ids}-err` : undefined}>
      <div className="flex flex-col gap-3">
        <label className={field}>
          <AtSign className="size-5 shrink-0 text-text-tab" strokeWidth={1.5} aria-hidden />
          <span className="sr-only">{c.email}</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            autoFocus={autoFocus}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={c.email}
            className="h-6 min-w-0 flex-1 bg-transparent text-text-primary outline-none placeholder:text-text-tab"
          />
          <span className="size-5 shrink-0" aria-hidden />
        </label>
        <label className={field}>
          <LockKeyhole className="size-5 shrink-0 text-text-tab" strokeWidth={1.5} aria-hidden />
          <span className="sr-only">{c.password}</span>
          <input
            type={show ? "text" : "password"}
            name="password"
            autoComplete={mode === "join" ? "new-password" : "current-password"}
            required
            minLength={mode === "join" ? 8 : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === "join" ? c.passwordHintJoin : c.password}
            className="h-6 min-w-0 flex-1 bg-transparent text-text-primary outline-none placeholder:text-text-tab"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? c.hidePassword : c.showPassword}
            aria-pressed={show}
            className="flex size-5 shrink-0 items-center justify-center rounded-xs text-text-tab transition-colors duration-150 hover:text-text-primary"
          >
            {show ? <EyeOff className="size-4" strokeWidth={1.5} aria-hidden /> : <Eye className="size-4" strokeWidth={1.5} aria-hidden />}
          </button>
        </label>

        {problem ? (
          <p id={`${ids}-err`} role="alert" className="-mt-1 px-1 text-sm leading-4 font-medium text-danger">
            {problem}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className={cn(row, "justify-center gap-2 bg-text-primary text-text-inverse shadow-[0_2px_4px_#0000001A] hover:bg-text-soft disabled:opacity-60")}
        >
          {busy ? <Spinner label={words.busy} /> : null}
          {busy ? words.busy : words.submit}
        </button>
      </div>

      <div className="my-5 flex h-4 items-center gap-4" aria-hidden>
        <span className="h-px flex-1 bg-border-subtle" />
        <span className="text-sm leading-4 font-medium text-text-secondary">{c.divider}</span>
        <span className="h-px flex-1 bg-border-subtle" />
      </div>

      <button
        type="button"
        onClick={() => {
          setProblem(null);
          onModeChange(mode === "join" ? "login" : "join");
        }}
        className={cn(row, "justify-center gap-1 bg-border-subtle text-text-primary hover:bg-border-default")}
      >
        <span className="hidden font-medium text-text-secondary sm:inline">{words.switchPrompt}</span>
        {words.switchLabel}
      </button>

      {guest ? (
        <p data-guest-note className="mt-4 flex items-start justify-center gap-2 px-2 text-center text-sm leading-4 font-medium text-brand">
          <Info className="mt-px size-4 shrink-0" strokeWidth={1.5} aria-hidden />
          <span>{mode === "join" ? c.guestKeep : c.guestLose}</span>
        </p>
      ) : mode === "join" ? (
        <p className="flex h-12 items-center justify-center gap-2 text-sm leading-4 font-medium text-brand">
          <Gift className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
          {c.joinPerk}
        </p>
      ) : null}
    </form>
  );
}

export function SmallPrint({ className }: { className?: string }) {
  return <p className={cn("text-center text-xs leading-4 text-text-secondary", className)}>{c.smallPrint}</p>;
}
