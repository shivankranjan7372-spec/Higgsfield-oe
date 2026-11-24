"use client";

import { ImageIcon, Laptop, Smartphone, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type FormEvent } from "react";
import useSWR from "swr";
import { Avatar } from "@/components/shell/parts";
import { common, deleteCopy, gate, languageNames, prefsCopy, profileCopy, sessionsCopy, signInCopy } from "@/content/account";
import { routes } from "@/content/site";
import { api, errorMessage, fetcher, type Asset, type SessionUser } from "@/lib/api";
import { useNow } from "@/lib/browser";
import { refreshSession, setSession, useSession } from "@/lib/session";
import { Button, ButtonLink, Popover, PopoverContent, PopoverTrigger, Spinner, Tag, cn } from "@/ui";
import { AccountFrame } from "./frame";
import { Card, FIELD, FieldRow, GuestBanner, LoadError, LoadingCard, ROW_LINE, SignInCard, Status, formatDate, formatDateTime } from "./parts";

export interface Preferences {
  defaultPrivacy: "private" | "public";
  language: string;
  theme: "system" | "dark" | "light";
  notices: Record<string, boolean>;
}

interface AccountAnswer {
  user: SessionUser;
  balance: number;
  preferences: Preferences;
  hasPassword: boolean;
}

interface SessionRow {
  id: string;
  current: boolean;
  createdAt: number;
  expiresAt: number;
  device: string;
  lastSeenAt: number;
}

const ACCOUNT = "/api/account";

/** "4 min ago" from the live clock, or a date for anything older than a day. */
function useAgo() {
  const now = useNow();
  return (ms: number) => {
    if (now === null) return formatDateTime(ms);
    const s = Math.max(0, now - Math.floor(ms / 1000));
    if (s < 90) return "just now";
    if (s < 3600) return `${Math.round(s / 60)} min ago`;
    if (s < 86400) return `${Math.round(s / 3600)} h ago`;
    return formatDate(ms);
  };
}

/** Keeps a save's outcome on screen until the next attempt. */
function useOutcome() {
  const [ok, setOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (work: () => Promise<string | null>) => {
    setBusy(true);
    setOk(null);
    setError(null);
    try {
      setOk(await work());
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return { ok, error, busy, run, setOk, setError };
}

// ── Profile ─────────────────────────────────────────────────────────

function AvatarPicker({ user, onDone }: { user: SessionUser; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const out = useOutcome();
  const { data, error, isLoading, mutate } = useSWR<{ assets: Asset[] }>(open ? "/api/assets?kind=image&limit=24" : null, fetcher);
  const pick = (assetId: string | null) =>
    out.run(async () => {
      await api("/api/account/profile", { method: "PATCH", body: { avatarAssetId: assetId } });
      setOpen(false);
      onDone();
      return assetId ? profileCopy.avatarSaved : profileCopy.avatarRemoved;
    });
  const list = data?.assets ?? [];
  return (
    <div className="flex flex-col gap-[6px]">
      <div className="flex flex-wrap items-center gap-3">
        <Avatar name={user.name} url={user.avatarUrl} size={40} />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="soft" size="sm">
              <ImageIcon className="size-4" strokeWidth={1.5} aria-hidden />
              {profileCopy.avatarPick}
            </Button>
          </PopoverTrigger>
          <PopoverContent look="panel" align="start" sideOffset={8} className="w-[300px] p-3" aria-label={profileCopy.pickerTitle}>
            <p className="pb-2 text-sm leading-5 font-medium text-text-primary">{profileCopy.pickerTitle}</p>
            {isLoading ? (
              <div className="grid grid-cols-4 gap-2">
                {Array.from({ length: 8 }, (_, i) => (
                  <div key={i} className="shimmer aspect-square rounded-md bg-border-subtle" />
                ))}
              </div>
            ) : error ? (
              <LoadError message={errorMessage(error)} onRetry={() => mutate()} />
            ) : list.length === 0 ? (
              <div className="flex flex-col items-start gap-2 text-sm leading-5 text-text-secondary">
                <p>{profileCopy.avatarEmpty}</p>
                <ButtonLink href={routes.library} variant="outline" size="sm">
                  {profileCopy.avatarOpenLibrary}
                </ButtonLink>
              </div>
            ) : (
              <ul className="scroll-quiet grid max-h-[280px] grid-cols-4 gap-2 overflow-y-auto" aria-label={profileCopy.pickerTitle}>
                {list.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => pick(a.id)}
                      disabled={out.busy}
                      aria-label={a.title || a.prompt || a.id}
                      className="block aspect-square w-full overflow-clip rounded-md bg-border-subtle transition-opacity duration-150 hover:opacity-80"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={a.posterUrl ?? a.url} alt="" loading="lazy" className="size-full object-cover" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </PopoverContent>
        </Popover>
        {user.avatarUrl ? (
          <Button variant="ghost" size="sm" onClick={() => pick(null)} disabled={out.busy}>
            <X className="size-4" strokeWidth={1.5} aria-hidden />
            {profileCopy.avatarRemove}
          </Button>
        ) : null}
      </div>
      <Status ok={out.ok} error={out.error} />
    </div>
  );
}

function HandleCheck({ handle, own }: { handle: string; own: string }) {
  const [answer, setAnswer] = useState<{ handle: string; available: boolean; message: string } | null>(null);
  const clean = handle.trim().replace(/^@/, "").toLowerCase();
  useEffect(() => {
    if (!clean || clean === own) return;
    const ctl = new AbortController();
    const t = setTimeout(() => {
      api<{ handle: string; available: boolean; message: string }>(`/api/account/handle?handle=${encodeURIComponent(clean)}`, { signal: ctl.signal })
        .then((a) => setAnswer({ ...a, handle: clean }))
        .catch(() => {});
    }, 300);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [clean, own]);
  if (!clean) return null;
  if (clean === own) return <span className="text-text-secondary">{profileCopy.handleOwn}</span>;
  if (!answer || answer.handle !== clean) return <span className="text-text-secondary" aria-live="polite">{profileCopy.handleChecking}</span>;
  return (
    <span aria-live="polite" className={answer.available ? "text-brand" : "text-danger"}>
      {answer.available ? profileCopy.handleFree : answer.message}
    </span>
  );
}

function ProfileCard({ user, onSaved }: { user: SessionUser; onSaved: () => void }) {
  const ids = useId();
  const [name, setName] = useState(user.name);
  const [handle, setHandle] = useState(user.handle);
  const [bio, setBio] = useState(user.bio);
  const out = useOutcome();
  const save = (e: FormEvent) => {
    e.preventDefault();
    out.run(async () => {
      const body: Record<string, string> = {};
      if (name.trim() !== user.name) body.name = name;
      if (handle.trim().replace(/^@/, "").toLowerCase() !== user.handle) body.handle = handle;
      if (bio !== user.bio) body.bio = bio;
      if (Object.keys(body).length === 0) return profileCopy.nothingChanged;
      const r = await api<{ user: SessionUser }>("/api/account/profile", { method: "PATCH", body });
      setName(r.user.name);
      setHandle(r.user.handle);
      setBio(r.user.bio);
      onSaved();
      return common.saved;
    });
  };
  return (
    <Card id="profile" title={profileCopy.title} hint={profileCopy.hint}>
      <FieldRow label={profileCopy.avatar}>
        <AvatarPicker user={user} onDone={onSaved} />
      </FieldRow>
      <form onSubmit={save} className="flex flex-col">
        <FieldRow label={profileCopy.name} htmlFor={`${ids}-name`}>
          <input id={`${ids}-name`} className={FIELD} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
        </FieldRow>
        <FieldRow label={profileCopy.handle} htmlFor={`${ids}-handle`} help={<HandleCheck handle={handle} own={user.handle} />}>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm leading-5 text-text-secondary">@</span>
            <input
              id={`${ids}-handle`}
              className={cn(FIELD, "pl-7")}
              value={handle}
              maxLength={31}
              onChange={(e) => setHandle(e.target.value)}
              autoComplete="username"
              spellCheck={false}
              required
            />
          </div>
        </FieldRow>
        <FieldRow label={profileCopy.bio} htmlFor={`${ids}-bio`} help={profileCopy.bioCount(bio.length)}>
          <textarea
            id={`${ids}-bio`}
            className={cn(FIELD, "h-auto min-h-[88px] resize-y py-[10px]")}
            value={bio}
            maxLength={300}
            placeholder={profileCopy.bioPlaceholder}
            onChange={(e) => setBio(e.target.value)}
          />
        </FieldRow>
        <div className={cn("flex flex-wrap items-center gap-3 pt-3", ROW_LINE)}>
          <Button type="submit" variant="lime" size="sm" disabled={out.busy}>
            {out.busy ? common.saving : common.save}
          </Button>
          <Status ok={out.ok} error={out.error} />
        </div>
      </form>
    </Card>
  );
}

// ── Sign-in details ─────────────────────────────────────────────────

function EmailForm({ user, onSaved }: { user: SessionUser; onSaved: () => void }) {
  const ids = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const out = useOutcome();
  const save = (e: FormEvent) => {
    e.preventDefault();
    out.run(async () => {
      await api("/api/account/email", { method: "POST", body: { email, password } });
      setEmail("");
      setPassword("");
      onSaved();
      return signInCopy.emailSaved;
    });
  };
  return (
    <form onSubmit={save} className="flex flex-col" aria-label={signInCopy.changeEmail}>
      <FieldRow label={signInCopy.email} htmlFor={`${ids}-email`}>
        <p className="flex min-h-10 min-w-0 items-center truncate text-sm leading-5 text-text-primary" data-testid="current-email">
          {user.email}
        </p>
        <input id={`${ids}-email`} type="email" className={FIELD} placeholder={signInCopy.newEmail} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        <input
          aria-label={signInCopy.currentPassword}
          type="password"
          className={FIELD}
          placeholder={signInCopy.currentPassword}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="soft" size="sm" disabled={out.busy}>
            {out.busy ? common.saving : signInCopy.changeEmail}
          </Button>
          <Status ok={out.ok} error={out.error} />
        </div>
      </FieldRow>
    </form>
  );
}

function PasswordForm({ onSaved }: { onSaved: () => void }) {
  const ids = useId();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const out = useOutcome();
  const save = (e: FormEvent) => {
    e.preventDefault();
    out.run(async () => {
      const r = await api<{ changed: boolean; signedOut: number }>("/api/account/password", { method: "POST", body: { currentPassword: current, newPassword: next } });
      setCurrent("");
      setNext("");
      onSaved();
      return signInCopy.passwordSaved(r.signedOut);
    });
  };
  return (
    <form onSubmit={save} className="flex flex-col" aria-label={signInCopy.changePassword}>
      <FieldRow label={signInCopy.changePassword} htmlFor={`${ids}-cur`} help={signInCopy.passwordRule}>
        <input id={`${ids}-cur`} type="password" className={FIELD} placeholder={signInCopy.currentPassword} value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
        <input
          aria-label={signInCopy.newPassword}
          type="password"
          className={FIELD}
          placeholder={signInCopy.newPassword}
          value={next}
          minLength={8}
          maxLength={200}
          onChange={(e) => setNext(e.target.value)}
          autoComplete="new-password"
          required
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="soft" size="sm" disabled={out.busy}>
            {out.busy ? common.saving : signInCopy.changePassword}
          </Button>
          <Status ok={out.ok} error={out.error} />
        </div>
      </FieldRow>
    </form>
  );
}

function SignInDetailsCard({ user, hasPassword, onSaved }: { user: SessionUser; hasPassword: boolean; onSaved: () => void }) {
  return (
    <Card id="sign-in" title={signInCopy.title} hint={signInCopy.hint}>
      {hasPassword && !user.isGuest ? (
        <>
          <EmailForm user={user} onSaved={onSaved} />
          <PasswordForm onSaved={onSaved} />
        </>
      ) : (
        <div className={cn("flex flex-col items-start gap-3 py-3 sm:flex-row sm:items-center", ROW_LINE)}>
          <p className="min-w-0 grow text-sm leading-5 text-text-secondary">{signInCopy.guest}</p>
          <ButtonLink href={`${routes.join}?next=${encodeURIComponent(routes.settings)}`} variant="lime" size="sm">
            {gate.join}
          </ButtonLink>
        </div>
      )}
    </Card>
  );
}

// ── Sessions ────────────────────────────────────────────────────────

function SessionsCard() {
  const { data, error, isLoading, mutate } = useSWR<{ sessions: SessionRow[] }>("/api/account/sessions", fetcher);
  const out = useOutcome();
  const [gone, setGone] = useState<string | null>(null);
  const ago = useAgo();
  const list = data?.sessions ?? [];
  const others = list.filter((s) => !s.current).length;

  const signOutOne = (id: string) =>
    out.run(async () => {
      setGone(id);
      try {
        await api(`/api/account/sessions/${id}`, { method: "DELETE" });
      } finally {
        setGone(null);
      }
      await mutate();
      return sessionsCopy.signedOutOne;
    });
  const signOutOthers = () =>
    out.run(async () => {
      const r = await api<{ signedOut: number }>("/api/account/sessions", { method: "DELETE" });
      await mutate();
      return sessionsCopy.signedOutMany(r.signedOut);
    });

  return (
    <Card
      id="sessions"
      title={sessionsCopy.title}
      aside={
        others > 0 ? (
          <Button variant="outline" size="xs" onClick={signOutOthers} disabled={out.busy}>
            {sessionsCopy.signOutOthers}
          </Button>
        ) : (
          <span className="truncate text-sm leading-5 text-text-secondary">{sessionsCopy.hint}</span>
        )
      }
    >
      {isLoading ? (
        <div className="flex flex-col gap-2">
          <div className="shimmer h-[52px] rounded-lg bg-border-subtle" />
          <div className="shimmer h-[52px] rounded-lg bg-border-subtle" />
        </div>
      ) : error ? (
        <LoadError message={errorMessage(error)} onRetry={() => mutate()} />
      ) : (
        <ul aria-label={sessionsCopy.title} className="flex flex-col">
          {list.map((s) => {
            const phone = /iOS|Android/i.test(s.device);
            const Icon = phone ? Smartphone : Laptop;
            return (
              <li key={s.id} className={cn("flex min-h-[52px] items-center gap-[10px] py-2", ROW_LINE)}>
                <Icon className="size-4 shrink-0 text-text-secondary" strokeWidth={1.5} aria-hidden />
                <div className="flex min-w-0 grow flex-col">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm leading-5 font-medium text-text-primary">{s.device || sessionsCopy.unknown}</span>
                    {s.current ? <Tag tone="brand">{sessionsCopy.thisDevice}</Tag> : null}
                  </span>
                  <span className="truncate text-xs leading-4 text-text-secondary">
                    {sessionsCopy.lastSeen} {ago(s.lastSeenAt)} · {sessionsCopy.signedInAt} {formatDate(s.createdAt)}
                  </span>
                </div>
                {!s.current ? (
                  <Button variant="outline" size="xs" onClick={() => signOutOne(s.id)} disabled={out.busy} aria-label={`${sessionsCopy.signOut}: ${s.device || sessionsCopy.unknown}`}>
                    {gone === s.id ? <Spinner className="size-3" /> : sessionsCopy.signOut}
                  </Button>
                ) : null}
              </li>
            );
          })}
          {others === 0 ? <li className={cn("pt-3 text-sm leading-5 text-text-secondary", ROW_LINE)}>{sessionsCopy.onlyThis}</li> : null}
        </ul>
      )}
      {out.ok || out.error ? (
        <div className="pt-3">
          <Status ok={out.ok} error={out.error} />
        </div>
      ) : null}
    </Card>
  );
}

// ── Preferences ─────────────────────────────────────────────────────

function Segmented({ label, value, options, onChange, disabled }: { label: string; value: string; options: Record<string, string>; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex w-fit max-w-full gap-[2px] overflow-x-auto rounded-lg bg-border-subtle p-[2px] scroll-none">
      {Object.entries(options).map(([v, text]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          disabled={disabled}
          onClick={() => value !== v && onChange(v)}
          className={cn(
            "h-8 shrink-0 rounded-md px-3 text-xs leading-4 font-medium transition-colors duration-150 disabled:opacity-40",
            value === v ? "bg-surface-glass text-text-primary shadow-inset-soft" : "text-text-tab hover:text-text-primary",
          )}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

function PreferencesCard({ prefs: initial }: { prefs: Preferences }) {
  const ids = useId();
  const [prefs, setPrefs] = useState(initial);
  const [langs, setLangs] = useState<string[]>(Object.keys(languageNames));
  const out = useOutcome();
  useEffect(() => {
    api<{ options: { languages: string[] } }>("/api/account/preferences")
      .then((r) => setLangs(r.options.languages))
      .catch(() => {});
  }, []);
  const save = (patch: Partial<Preferences>) => {
    const before = prefs;
    setPrefs({ ...prefs, ...patch });
    out.run(async () => {
      try {
        const r = await api<{ preferences: Preferences }>("/api/account/preferences", { method: "PATCH", body: patch });
        setPrefs(r.preferences);
        return common.saved;
      } catch (e) {
        setPrefs(before);
        throw e;
      }
    });
  };
  return (
    <Card id="preferences" title={prefsCopy.title} hint={prefsCopy.hint}>
      <FieldRow label={prefsCopy.privacy} help={prefsCopy.privacyHelp}>
        <Segmented label={prefsCopy.privacy} value={prefs.defaultPrivacy} options={prefsCopy.privacyOptions} onChange={(v) => save({ defaultPrivacy: v as Preferences["defaultPrivacy"] })} disabled={out.busy} />
      </FieldRow>
      <FieldRow label={prefsCopy.language} htmlFor={`${ids}-lang`}>
        <select
          id={`${ids}-lang`}
          className={cn(FIELD, "w-full cursor-pointer sm:w-[240px]")}
          value={prefs.language}
          disabled={out.busy}
          onChange={(e) => save({ language: e.target.value })}
        >
          {langs.map((l) => (
            <option key={l} value={l} className="bg-surface-menu">
              {languageNames[l] ?? l}
            </option>
          ))}
        </select>
      </FieldRow>
      <FieldRow label={prefsCopy.theme}>
        <Segmented label={prefsCopy.theme} value={prefs.theme} options={prefsCopy.themeOptions} onChange={(v) => save({ theme: v as Preferences["theme"] })} disabled={out.busy} />
      </FieldRow>
      <FieldRow label={prefsCopy.notices}>
        <Link href={`${routes.settings}/notifications`} className="w-fit pt-[10px] text-sm leading-5 font-medium text-brand underline-offset-4 hover:underline">
          {prefsCopy.noticesLink}
        </Link>
      </FieldRow>
      {out.ok || out.error ? (
        <div className={cn("pt-3", ROW_LINE)}>
          <Status ok={out.ok} error={out.error} />
        </div>
      ) : null}
    </Card>
  );
}

// ── Delete ──────────────────────────────────────────────────────────

function DeleteCard({ hasPassword }: { hasPassword: boolean }) {
  const ids = useId();
  const router = useRouter();
  const [typed, setTyped] = useState("");
  const [password, setPassword] = useState("");
  const out = useOutcome();
  const ready = typed === deleteCopy.word && (!hasPassword || password.length > 0);
  const remove = (e: FormEvent) => {
    e.preventDefault();
    out.run(async () => {
      await api(ACCOUNT, { method: "DELETE", body: hasPassword ? { confirm: typed, password } : { confirm: typed } });
      await setSession({ user: null, balance: 0 });
      router.push(routes.home);
      return null;
    });
  };
  return (
    <Card id="delete" title={deleteCopy.title} hint={deleteCopy.hint} tone="danger">
      <form onSubmit={remove} className="flex flex-col">
        <p className={cn("py-3 text-sm leading-5 text-text-secondary", ROW_LINE)}>{deleteCopy.body}</p>
        <FieldRow label={deleteCopy.typeLabel} htmlFor={`${ids}-confirm`}>
          <input id={`${ids}-confirm`} className={FIELD} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} placeholder={deleteCopy.word} />
          {hasPassword ? (
            <input aria-label={deleteCopy.password} type="password" className={FIELD} placeholder={deleteCopy.password} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          ) : null}
        </FieldRow>
        <div className={cn("flex flex-wrap items-center gap-3 pt-3", ROW_LINE)}>
          <button
            type="submit"
            disabled={!ready || out.busy}
            className="inline-flex h-8 items-center rounded-md bg-danger px-3 text-sm leading-4 font-semibold text-text-inverse transition-opacity duration-150 hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
          >
            {out.busy ? deleteCopy.deleting : deleteCopy.button}
          </button>
          <Status error={out.error} />
        </div>
      </form>
    </Card>
  );
}

// ── Page ────────────────────────────────────────────────────────────

export function SettingsPage() {
  const { user, loading } = useSession();
  const { data, error, isLoading, mutate } = useSWR<AccountAnswer>(user ? ACCOUNT : null, fetcher);
  const onSaved = () => {
    mutate();
    refreshSession();
  };

  let body;
  if (loading || (user && isLoading)) {
    body = (
      <>
        <LoadingCard rows={4} />
        <LoadingCard rows={2} />
      </>
    );
  } else if (!user) {
    body = <SignInCard {...gateFor("settings")} next={routes.settings} />;
  } else if (error || !data) {
    body = <LoadError message={errorMessage(error)} onRetry={() => mutate()} />;
  } else {
    const u = data.user;
    body = (
      <>
        {u.isGuest ? <GuestBanner next={routes.settings} /> : null}
        <ProfileCard key={u.id} user={u} onSaved={onSaved} />
        <SignInDetailsCard user={u} hasPassword={data.hasPassword} onSaved={onSaved} />
        <SessionsCard />
        <PreferencesCard prefs={data.preferences} />
        <DeleteCard hasPassword={data.hasPassword} />
      </>
    );
  }
  return (
    <AccountFrame page="settings" title="Settings">
      {body}
    </AccountFrame>
  );
}

function gateFor(page: keyof typeof gate.signedOut) {
  return gate.signedOut[page];
}

