"use client";

import { Check, ImagePlus } from "lucide-react";
import { useRef, useState } from "react";
import { mutate } from "swr";
import { ads } from "@/content/ads";
import { api, errorMessage, type Asset } from "@/lib/api";
import { ensureSession } from "@/lib/session";
import { Spinner, cn } from "@/ui";
import { keys, usePhotos } from "./data";

/** Uploads picture files one at a time (the API takes one per request) and returns the new assets. */
export async function uploadPhotos(files: File[]): Promise<Asset[]> {
  await ensureSession();
  const done: Asset[] = [];
  for (const file of files) {
    const form = new FormData();
    form.append("file", file);
    form.append("accept", "image");
    const { asset } = await api<{ asset: Asset }>("/api/assets", { method: "POST", body: form });
    done.push(asset);
  }
  await mutate(keys.photos);
  return done;
}

/** The "upload a photo" tile: a hidden file input behind a dashed square. */
export function UploadTile({ multiple, onUploaded, className }: { multiple?: boolean; onUploaded: (assets: Asset[]) => void; className?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <button
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
        className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border-strong text-text-secondary transition-colors duration-150 hover:bg-border-subtle hover:text-text-primary"
      >
        {busy ? <Spinner label={ads.pickers.uploading} /> : <ImagePlus className="size-4" strokeWidth={1.5} aria-hidden />}
        <span className="px-1 text-center text-2xs leading-3 font-medium">{busy ? ads.pickers.uploading : ads.pickers.upload}</span>
      </button>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        multiple={multiple}
        aria-label={ads.pickers.upload}
        className="sr-only"
        tabIndex={-1}
        onChange={async (e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          if (!files.length) return;
          setBusy(true);
          setProblem(null);
          try {
            onUploaded(await uploadPhotos(files));
          } catch (err) {
            setProblem(errorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      />
      {problem ? (
        <p role="alert" className="text-2xs leading-3 text-danger">
          {problem}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The member's pictures as a grid of small squares, with an upload tile first. `chosen` lights
 * the picked ones; `onToggle` is called with the picture clicked.
 */
export function PhotoGrid({
  chosen,
  onToggle,
  multiple,
  onUploaded,
  columns = "grid-cols-4",
}: {
  chosen: string[];
  onToggle: (asset: Asset) => void;
  multiple?: boolean;
  onUploaded: (assets: Asset[]) => void;
  columns?: string;
}) {
  const { list, loading } = usePhotos();
  return (
    <ul className={cn("grid gap-2", columns)}>
      <li>
        <UploadTile multiple={multiple} onUploaded={onUploaded} />
      </li>
      {loading
        ? Array.from({ length: 3 }, (_, i) => <li key={i} className="shimmer aspect-square rounded-lg bg-surface-tertiary" />)
        : list.map((asset) => {
            const on = chosen.includes(asset.id);
            return (
              <li key={asset.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  aria-label={asset.title || asset.prompt || "Photo"}
                  onClick={() => onToggle(asset)}
                  className={cn(
                    "relative block aspect-square w-full overflow-clip rounded-lg bg-surface-tertiary ring-2 transition-[box-shadow] duration-150",
                    on ? "ring-brand" : "ring-transparent hover:ring-border-strong",
                  )}
                >
                  {/* Member files sit behind the session cookie, so next/image cannot load them. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={asset.posterUrl ?? asset.url} alt="" loading="lazy" className="size-full object-cover" />
                  {on ? (
                    <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-brand text-ink">
                      <Check className="size-3" strokeWidth={2} aria-hidden />
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
    </ul>
  );
}
