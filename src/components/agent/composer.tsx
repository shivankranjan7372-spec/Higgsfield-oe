"use client";

import { ArrowUp, Check, ChevronDown, Cpu, FileAudio, Film, Hand, Plus, Square, X, Zap } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { copy } from "@/content/agent";
import { api, errorMessage, type Asset } from "@/lib/api";
import { ensureSession } from "@/lib/session";
import { cn, Popover, PopoverContent, PopoverTrigger, Spinner } from "@/ui";
import { useConfig } from "./data";

export interface Attached {
  id: string;
  kind: Asset["kind"];
  url: string;
  posterUrl: string | null;
  title: string;
}

export interface SendInput {
  text: string;
  fileIds: string[];
  mode: string;
  model: string;
}

/** Remembered for the tab, so the home and a chat agree on the mode and model. */
const picked: { mode: string | null; model: string | null } = { mode: null, model: null };

const DEFAULT_MODE = { id: "ask", name: "Ask before generating" };

function Thumb({ file, onRemove }: { file: Attached; onRemove: () => void }) {
  return (
    <li className="group relative size-12 shrink-0 overflow-clip rounded-md border border-border-default bg-surface-tertiary">
      {file.kind === "image" || file.posterUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={file.posterUrl ?? file.url} alt={file.title} className="size-full object-cover" />
      ) : (
        <span className="flex size-full items-center justify-center text-text-secondary" title={file.title}>
          {file.kind === "video" ? <Film className="size-4" strokeWidth={1.5} /> : <FileAudio className="size-4" strokeWidth={1.5} />}
        </span>
      )}
      <button
        type="button"
        aria-label={`${copy.composer.remove}: ${file.title}`}
        onClick={onRemove}
        className="absolute top-[2px] right-[2px] flex size-5 items-center justify-center rounded-full bg-scrim text-text-primary"
      >
        <X className="size-3" strokeWidth={2} aria-hidden />
      </button>
    </li>
  );
}

/**
 * The prompt box: text, attached files, the assistant model, the approval mode and Send.
 * The home draws its context row under it; a chat swaps Send for Stop while a turn runs.
 */
export function AgentComposer({
  value,
  onChange,
  onSend,
  running,
  onStop,
  placeholder = copy.placeholder,
  below,
  autoFocus,
}: {
  value: string;
  onChange: (text: string) => void;
  onSend: (input: SendInput) => Promise<boolean>;
  running?: boolean;
  onStop?: () => void;
  placeholder?: string;
  below?: ReactNode;
  autoFocus?: boolean;
}) {
  const { data: config } = useConfig();
  const [mode, setMode] = useState<string | null>(picked.mode);
  const [model, setModel] = useState<string | null>(picked.model);
  const [files, setFiles] = useState<Attached[]>([]);
  const [uploading, setUploading] = useState(0);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [modelOpen, setModelOpen] = useState(false);
  const [modeOpen, setModeOpen] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);

  const modeId = mode ?? config?.defaultMode ?? DEFAULT_MODE.id;
  // A choice the current engine does not offer falls back to its default.
  const modelId = (model && (!config || config.models.some((m) => m.id === model)) ? model : null) ?? config?.defaultModel ?? "auto";
  const modeDef = config?.modes.find((m) => m.id === modeId) ?? (modeId === DEFAULT_MODE.id ? DEFAULT_MODE : { id: modeId, name: modeId });
  const modelDef = config?.models.find((m) => m.id === modelId);
  const maxFiles = config?.limits.maxFilesPerMessage ?? 10;
  const maxLen = config?.limits.messageMaxLength ?? 20000;

  // The box grows with its text, up to a third of the screen.
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, Math.max(160, window.innerHeight / 3))}px`;
  }, [value]);

  const canSend = !sending && uploading === 0 && (value.trim().length > 0 || files.length > 0);

  const send = async () => {
    if (!canSend) return;
    setProblem(null);
    setSending(true);
    try {
      const ok = await onSend({ text: value.trim(), fileIds: files.map((f) => f.id), mode: modeId, model: modelId });
      if (ok) setFiles([]);
    } catch (e) {
      setProblem(errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  const upload = async (list: FileList | null) => {
    if (!list?.length) return;
    setProblem(null);
    const room = maxFiles - files.length;
    const chosen = [...list].slice(0, Math.max(0, room));
    if (list.length > room) setProblem(copy.composer.tooMany(maxFiles));
    if (!chosen.length) return;
    try {
      await ensureSession();
    } catch (e) {
      setProblem(errorMessage(e));
      return;
    }
    setUploading((n) => n + chosen.length);
    await Promise.all(
      chosen.map(async (file) => {
        const form = new FormData();
        form.append("file", file);
        form.append("accept", "image,video,audio");
        try {
          const { asset } = await api<{ asset: Asset }>("/api/assets", { method: "POST", body: form });
          setFiles((prev) => [...prev, { id: asset.id, kind: asset.kind, url: asset.url, posterUrl: asset.posterUrl, title: asset.title || file.name }]);
        } catch (e) {
          setProblem(errorMessage(e));
        } finally {
          setUploading((n) => n - 1);
        }
      }),
    );
  };

  return (
    <div className="flex w-full flex-col">
      <div
        className="w-full rounded-3xl bg-surface-sunken p-1 backdrop-blur-[40px]"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void upload(e.dataTransfer.files);
        }}
      >
        <div className="flex flex-col gap-3 rounded-2xl bg-surface-secondary px-3 pt-4 pb-3">
          {files.length || uploading ? (
            <ul className="flex gap-2 overflow-x-auto scroll-none" aria-label={copy.composer.attach}>
              {files.map((f) => (
                <Thumb key={f.id} file={f} onRemove={() => setFiles((prev) => prev.filter((x) => x.id !== f.id))} />
              ))}
              {Array.from({ length: uploading }, (_, i) => (
                <li key={`u${i}`} className="shimmer flex size-12 shrink-0 items-center justify-center rounded-md bg-surface-tertiary" aria-label={copy.composer.uploading}>
                  <Spinner />
                </li>
              ))}
            </ul>
          ) : null}
          <label htmlFor="agent-prompt" className="sr-only">
            {placeholder}
          </label>
          <textarea
            id="agent-prompt"
            ref={area}
            autoFocus={autoFocus}
            rows={2}
            value={value}
            maxLength={maxLen}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void send();
              }
            }}
            className="min-h-[45px] w-full resize-none bg-transparent px-0 text-sm leading-5 font-medium text-text-primary caret-brand outline-none scroll-quiet placeholder:text-text-secondary"
          />
          <div className="flex h-8 items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1">
              <input ref={picker} type="file" multiple accept="image/*,video/*,audio/*" className="hidden" onChange={(e) => void upload(e.target.files).then(() => (e.target.value = ""))} />
              <button
                type="button"
                aria-label={copy.composer.attach}
                onClick={() => picker.current?.click()}
                className="flex size-8 shrink-0 items-center justify-center rounded-lg text-text-primary backdrop-blur-[40px] transition-colors duration-150 hover:bg-border-subtle"
              >
                <Plus className="size-4" strokeWidth={1.5} aria-hidden />
              </button>
              <Popover
                open={modelOpen}
                onOpenChange={(o) => {
                  setModelOpen(o);
                  // A visitor has no account yet; the options come with one.
                  if (o && !config) void ensureSession().catch(() => {});
                }}
              >
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label={`${copy.composer.model}: ${modelDef?.name ?? "Auto"}`}
                    className="flex h-8 min-w-0 items-center gap-[2px] rounded-lg px-2 transition-colors duration-150 hover:bg-border-subtle data-[state=open]:bg-border-subtle"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Cpu className="size-4 shrink-0 text-text-secondary" strokeWidth={1.5} aria-hidden />
                      <span className="truncate text-xs leading-4 font-medium text-text-primary">{modelDef?.name ?? "Auto"}</span>
                      {modelDef ? (
                        <span className="flex h-5 shrink-0 items-center rounded-full bg-[#D1FE170D] px-[6px] text-xs leading-4 font-medium text-brand" title={copy.tierHint}>
                          {copy.tiers[modelDef.tier] ?? modelDef.tier}
                        </span>
                      ) : null}
                    </span>
                    <span className="flex size-5 shrink-0 items-center justify-center">
                      <ChevronDown className="size-4 text-text-secondary" strokeWidth={1.5} aria-hidden />
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-[280px]">
                  <div className="flex h-8 items-center justify-between px-2 text-xs leading-4 font-medium text-text-tab">
                    {copy.composer.model}
                    <span className="font-normal text-text-tertiary">{copy.tierHint}</span>
                  </div>
                  {!config ? (
                    <div className="flex h-9 items-center px-2" aria-hidden>
                      <Spinner />
                    </div>
                  ) : null}
                  {(config?.models ?? []).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={m.id === modelId}
                      onClick={() => {
                        setModel(m.id);
                        picked.model = m.id;
                        setModelOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-start gap-2 rounded-md px-2 py-2 text-left transition-colors duration-150 hover:bg-border-subtle",
                        m.id === modelId && "bg-border-subtle",
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 text-sm leading-5 font-medium text-text-primary">
                          {m.name}
                          <span className="rounded-full bg-[#D1FE170D] px-[6px] text-2xs leading-4 text-brand">{copy.tiers[m.tier] ?? m.tier}</span>
                        </span>
                        {m.description ? <span className="block text-xs leading-4 text-text-secondary">{m.description}</span> : null}
                      </span>
                      {m.id === modelId ? <Check className="mt-[2px] size-4 shrink-0" strokeWidth={1.5} aria-hidden /> : null}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Popover
                open={modeOpen}
                onOpenChange={(o) => {
                  setModeOpen(o);
                  if (o && !config) void ensureSession().catch(() => {});
                }}
              >
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label={`${copy.composer.mode}: ${modeDef.name}`}
                    className="flex h-8 min-w-0 items-center rounded-lg px-2 text-xs leading-4 font-medium text-text-tab transition-colors duration-150 hover:bg-border-subtle hover:text-text-primary data-[state=open]:bg-border-subtle"
                  >
                    {modeId === "ask" ? (
                      <Hand className="mr-[6px] size-4 shrink-0" strokeWidth={1.5} aria-hidden />
                    ) : (
                      <Zap className="mr-[6px] size-4 shrink-0 text-brand" strokeWidth={1.5} aria-hidden />
                    )}
                    <span className="hidden truncate sm:inline">{modeDef.name}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[300px]">
                  <div className="flex h-8 items-center px-2 text-xs leading-4 font-medium text-text-tab">{copy.composer.mode}</div>
                  {(config?.modes ?? [DEFAULT_MODE]).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={m.id === modeId}
                      onClick={() => {
                        setMode(m.id);
                        picked.mode = m.id;
                        setModeOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-start gap-2 rounded-md px-2 py-2 text-left transition-colors duration-150 hover:bg-border-subtle",
                        m.id === modeId && "bg-border-subtle",
                      )}
                    >
                      {m.id === "ask" ? (
                        <Hand className="mt-[2px] size-4 shrink-0" strokeWidth={1.5} aria-hidden />
                      ) : (
                        <Zap className="mt-[2px] size-4 shrink-0 text-brand" strokeWidth={1.5} aria-hidden />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm leading-5 font-medium text-text-primary">{m.name}</span>
                        {"description" in m && typeof m.description === "string" && m.description ? <span className="block text-xs leading-4 text-text-secondary">{m.description}</span> : null}
                      </span>
                      {m.id === modeId ? <Check className="mt-[2px] size-4 shrink-0" strokeWidth={1.5} aria-hidden /> : null}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
              {running && onStop ? (
                <button
                  type="button"
                  aria-label={copy.composer.stop}
                  onClick={onStop}
                  className="flex size-8 items-center justify-center rounded-md bg-text-primary text-text-inverse transition-colors duration-150 hover:bg-text-soft"
                >
                  <Square className="size-3 fill-current" strokeWidth={1.5} aria-hidden />
                </button>
              ) : null}
              <button
                type="button"
                aria-label={copy.composer.send}
                onClick={() => void send()}
                aria-disabled={!canSend}
                className={cn(
                  "relative flex size-8 items-center justify-center rounded-md bg-brand text-ink transition-colors duration-150 [box-shadow:#FFFFFF99_0px_1px_1px_inset,#00000040_0px_-1px_0px_inset] hover:bg-brand-glow",
                  !canSend && "cursor-default",
                )}
                style={{ backgroundImage: "linear-gradient(in oklab 180deg, #00000000 50%, #0000001A 100%)" }}
              >
                {sending ? <Spinner /> : <ArrowUp className={cn("size-4", !canSend && "opacity-45")} strokeWidth={1.5} aria-hidden />}
              </button>
            </div>
          </div>
        </div>
      </div>
      {problem ? (
        <p role="alert" className="mt-2 flex items-center justify-between gap-2 px-3 text-xs leading-4 text-danger">
          {problem}
          <button type="button" aria-label="Dismiss" onClick={() => setProblem(null)} className="rounded-sm p-1 text-text-secondary hover:text-text-primary">
            <X className="size-3" strokeWidth={2} aria-hidden />
          </button>
        </p>
      ) : null}
      {below}
    </div>
  );
}
