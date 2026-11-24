"use client";

import { AtSign, Box, ChevronLeft, Folder as FolderIcon, Heart, Image as ImageIcon, Music, Trash2, Upload, Video } from "lucide-react";
import Link from "next/link";
import { useRef, useState, type DragEvent, type ReactNode } from "react";
import useSWR from "swr";
import { LoginDialog } from "@/components/entry/login-dialog";
import { library, type SectionId } from "@/content/library";
import { routes } from "@/content/site";
import { api, errorMessage, fetcher } from "@/lib/api";
import { useQueryParam } from "@/lib/browser";
import { ensureSession, useSession } from "@/lib/session";
import { Artwork, Button, ButtonLink, cn, IconButton } from "@/ui";
import { AssetBrowser, type Scope } from "./asset-browser";
import { ErrorLine, PANEL } from "./common";
import { formatBytes, refreshLibrary, type Folder, type Summary } from "./data";
import { ElementsView } from "./elements";
import { FolderList, FolderMenu } from "./folders";
import { TrashView } from "./trash";

const SECTIONS: SectionId[] = ["all", "folders", "favourites", "elements", "trash", "image", "video", "audio", "uploads"];

function go(view: SectionId, folder?: string) {
  const u = new URL(window.location.href);
  u.search = "";
  if (view !== "all") u.searchParams.set("view", view);
  if (folder) u.searchParams.set("folder", folder);
  window.history.pushState(null, "", u);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

const icons: Record<SectionId, ReactNode> = {
  all: <Box className="size-3.5" strokeWidth={1.5} aria-hidden />,
  folders: <FolderIcon className="size-3.5 fill-current" strokeWidth={1.5} aria-hidden />,
  favourites: <Heart className="size-3.5 fill-current" strokeWidth={1.5} aria-hidden />,
  elements: <AtSign className="size-3.5" strokeWidth={1.5} aria-hidden />,
  trash: <Trash2 className="size-3.5" strokeWidth={1.5} aria-hidden />,
  image: <ImageIcon className="size-3.5" strokeWidth={1.5} aria-hidden />,
  video: <Video className="size-3.5 fill-current" strokeWidth={1.5} aria-hidden />,
  audio: <Music className="size-3.5" strokeWidth={1.5} aria-hidden />,
  uploads: <Upload className="size-3.5" strokeWidth={1.5} aria-hidden />,
};

function countFor(id: SectionId, s?: Summary): number | null {
  if (!s) return null;
  const c = s.counts;
  const n = { all: c.all, folders: c.folders, favourites: c.favorites, elements: c.elements, trash: c.trash, image: c.image, video: c.video, audio: c.audio, uploads: c.uploads }[id];
  // The design shows no count on Trash and the type rows when they are empty.
  if ((id === "trash" || id === "image" || id === "video" || id === "audio" || id === "uploads") && n === 0) return null;
  return n;
}

function SideRow({ id, active, count, tools, onPick }: { id: SectionId; active: boolean; count: number | null; tools?: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-9 shrink-0 items-center justify-between gap-2 rounded-xl pl-[6px] text-left transition-colors duration-150 max-md:pr-2.5",
        tools ? "md:pr-[10px]" : "md:pr-[6px]",
        active ? "bg-border-subtle" : "hover:bg-[#FFFFFF08]",
      )}
    >
      <span className="flex items-center gap-2">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-[#FFFFFF30] bg-[#FFFFFF0F] text-text-primary [box-shadow:#FFFFFF29_0px_0px_6px_inset]">
          {icons[id]}
        </span>
        <span className="text-sm leading-5 font-medium whitespace-nowrap text-text-primary">{library.sections[id]}</span>
      </span>
      {count !== null ? (
        <span className="flex h-[18px] shrink-0 items-center justify-center rounded-sm bg-border-subtle px-[6px] text-2xs leading-[14px] font-semibold text-text-muted">{count}</span>
      ) : null}
    </button>
  );
}

export function Library() {
  const { user, loading } = useSession();
  const viewParam = useQueryParam("view");
  const folderParam = useQueryParam("folder");
  // Links written by the server (notices, search results, the command list) use the API's own
  // words: ?favorite=1, ?source=upload, ?upload=1, ?kind=video, ?folder=<id>, ?asset=<id>.
  const favoriteParam = useQueryParam("favorite");
  const sourceParam = useQueryParam("source");
  const uploadParam = useQueryParam("upload");
  const kindParam = useQueryParam("kind");
  const assetParam = useQueryParam("asset");
  const view: SectionId = SECTIONS.includes(viewParam as SectionId)
    ? (viewParam as SectionId)
    : folderParam
      ? "folders"
      : favoriteParam === "1"
        ? "favourites"
        : sourceParam === "upload" || uploadParam === "1"
          ? "uploads"
          : kindParam === "image" || kindParam === "video" || kindParam === "audio"
            ? kindParam
            : "all";
  const [loginOpen, setLoginOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProblem, setUploadProblem] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const depth = useRef(0);

  const signedIn = !!user;
  const summary = useSWR<Summary>(signedIn ? "/api/library/summary" : null, fetcher);
  const folders = useSWR<{ folders: Folder[]; unfiled: number }>(signedIn ? "/api/folders" : null, fetcher);
  const folderList = folders.data?.folders ?? [];
  const openFolder = view === "folders" && folderParam ? folderList.find((f) => f.id === folderParam) : undefined;

  const upload = async (files: File[]) => {
    if (files.length === 0) return;
    setUploading(true);
    setUploadProblem(null);
    try {
      await ensureSession();
      const problems: string[] = [];
      for (const file of files) {
        const form = new FormData();
        form.append("file", file);
        try {
          const r = await api<{ asset: { id: string } }>("/api/assets", { method: "POST", body: form });
          if (openFolder) await api(`/api/folders/${openFolder.id}/assets`, { method: "POST", body: { ids: [r.asset.id] } });
        } catch (e) {
          problems.push(`${file.name}: ${errorMessage(e)}`);
        }
      }
      if (problems.length) setUploadProblem(problems.join(" "));
    } catch (e) {
      setUploadProblem(errorMessage(e));
    } finally {
      setUploading(false);
      await refreshLibrary();
    }
  };

  const onDrag = (e: DragEvent, kind: "enter" | "leave" | "over") => {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    if (kind === "enter") depth.current++;
    if (kind === "leave") depth.current--;
    setDragging(depth.current > 0);
  };

  if (!loading && !user) {
    return (
      <div className="flex min-h-0 flex-1 flex-col px-2 pt-2 pb-3">
        <div className={cn(PANEL, "flex flex-1 flex-col items-center justify-center gap-6 overflow-y-auto p-6 text-center")}>
          <Artwork name="library/signed-out" className="aspect-[16/9] w-full max-w-[420px] rounded-2xl" />
          <div className="flex max-w-[460px] flex-col gap-2">
            <h1 className="text-xl leading-[28px] font-semibold tracking-[-0.01em] text-text-primary">{library.signedOut.title}</h1>
            <p className="text-sm leading-5 text-text-secondary">{library.signedOut.body}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="lime" size="md" onClick={() => setLoginOpen(true)}>
              {library.signedOut.cta}
            </Button>
            <ButtonLink href={`${routes.join}?next=${encodeURIComponent(routes.library)}`} variant="outline" size="md">
              {library.signedOut.join}
            </ButtonLink>
          </div>
        </div>
        <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} mode="login" next={routes.library} />
      </div>
    );
  }

  const s = summary.data;
  const scope: Scope | null =
    view === "all"
      ? {}
      : view === "favourites"
        ? { favorite: true }
        : view === "image" || view === "video" || view === "audio"
          ? { kind: view }
          : view === "uploads"
            ? { source: "upload" }
            : openFolder
              ? { folder: openFolder.id }
              : null;
  const emptyLine =
    view === "favourites"
      ? library.empty.favourites.line
      : view === "uploads"
        ? library.empty.uploads.line
        : openFolder
          ? library.empty.folder.line
          : library.empty.all.line;

  const browserProps = {
    summary: s,
    folders: folderList,
    emptyLine,
    onUpload: () => fileInput.current?.click(),
    uploading,
    enabled: signedIn,
    openFirst: assetParam,
  };

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col gap-1 px-2 pt-2 pb-3 md:flex-row"
      onDragEnter={(e) => onDrag(e, "enter")}
      onDragLeave={(e) => onDrag(e, "leave")}
      onDragOver={(e) => onDrag(e, "over")}
      onDrop={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        depth.current = 0;
        setDragging(false);
        void upload([...e.dataTransfer.files]);
      }}
    >
      <nav
        aria-label={library.title}
        className={cn(PANEL, "flex shrink-0 gap-[2px] overflow-x-auto p-[7px] scroll-none md:w-[230px] md:flex-col md:overflow-x-visible md:overflow-y-auto")}
      >
        {(["all", "folders", "favourites", "elements", "trash"] as const).map((id) => (
          <SideRow key={id} id={id} active={view === id} count={countFor(id, s)} onPick={() => go(id)} />
        ))}
        <div className="hidden shrink-0 items-center pt-5 pb-[6px] pl-[6px] md:flex">
          <span className="text-xs leading-4 text-text-secondary">{library.kindsLabel}</span>
        </div>
        {(["image", "video", "audio", "uploads"] as const).map((id) => (
          <SideRow key={id} id={id} tools active={view === id} count={countFor(id, s)} onPick={() => go(id)} />
        ))}
        {s ? (
          <div className="mt-auto hidden flex-col gap-2 px-[6px] pt-5 pb-1 md:flex">
            <div className="flex items-center justify-between text-xs leading-4">
              <span className="text-text-secondary">{library.storage.label}</span>
              <span className="font-semibold text-text-primary">{formatBytes(s.storage.totalBytes)}</span>
            </div>
            <div className="flex h-1 overflow-hidden rounded-full bg-border-subtle" aria-hidden>
              {(["image", "video", "audio"] as const).map((k, i) =>
                s.storage.totalBytes > 0 && s.storage.byKind[k] > 0 ? (
                  <span
                    key={k}
                    style={{ width: `${(s.storage.byKind[k] / s.storage.totalBytes) * 100}%` }}
                    className={cn("h-full", ["bg-brand", "bg-text-primary", "bg-text-secondary"][i])}
                  />
                ) : null,
              )}
            </div>
            {s.storage.trashBytes > 0 ? <span className="text-2xs leading-[14px] text-text-tertiary">{library.storage.trash(formatBytes(s.storage.trashBytes))}</span> : null}
          </div>
        ) : null}
      </nav>

      <section className={cn(PANEL, "relative flex min-h-0 min-w-0 flex-1 flex-col p-[15px]")}>
        {user?.isGuest ? (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-brand-tint px-3 py-2 text-sm leading-5 text-text-primary">
            <span className="min-w-0">{library.guest.note}</span>
            <Link href={`${routes.join}?next=${encodeURIComponent(routes.library)}`} className="font-semibold text-brand hover:underline">
              {library.guest.cta}
            </Link>
          </div>
        ) : null}
        {uploadProblem ? (
          <div className="mb-3">
            <ErrorLine message={uploadProblem} onRetry={() => setUploadProblem(null)} />
          </div>
        ) : null}
        {summary.error && !s ? (
          <div className="mb-3">
            <ErrorLine message={errorMessage(summary.error)} onRetry={() => void summary.mutate()} />
          </div>
        ) : null}

        {!signedIn ? null : view === "trash" ? (
          <TrashView />
        ) : view === "elements" ? (
          <ElementsView />
        ) : view === "folders" && !openFolder ? (
          folderParam && folders.data ? (
            <>
              <ErrorLine message="That folder does not exist." />
              <Button variant="outline" size="sm" className="mt-3 self-start" onClick={() => go("folders")}>
                {library.folders.back}
              </Button>
            </>
          ) : (
            <FolderList
              folders={folderList}
              loading={(folders.isLoading || loading) && !folders.data}
              error={folders.error}
              onRetry={() => void folders.mutate()}
              onOpen={(id) => go("folders", id)}
            />
          )
        ) : scope ? (
          <AssetBrowser
            key={view + (openFolder?.id ?? "")}
            {...browserProps}
            scope={scope}
            title={openFolder ? openFolder.name : library.sections[view]}
            lead={
              openFolder ? (
                <IconButton size={28} tone="soft" aria-label={library.folders.back} onClick={() => go("folders")}>
                  <ChevronLeft className="size-4" strokeWidth={1.5} aria-hidden />
                </IconButton>
              ) : null
            }
            actions={openFolder ? <FolderMenu folder={openFolder} label onDeleted={() => go("folders")} /> : null}
          />
        ) : null}

        {dragging ? (
          <div className="pointer-events-none absolute inset-2 z-40 flex items-center justify-center rounded-2xl border-2 border-dashed border-brand bg-[#0F1113E6]">
            <span className="flex items-center gap-2 text-sm leading-5 font-medium text-brand">
              <Upload className="size-5" strokeWidth={1.5} aria-hidden />
              {library.dropHere}
            </span>
          </div>
        ) : null}
      </section>

      <input
        ref={fileInput}
        type="file"
        multiple
        accept="image/*,video/*,audio/*"
        className="hidden"
        aria-label={library.upload}
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          void upload(files);
        }}
      />
    </div>
  );
}
