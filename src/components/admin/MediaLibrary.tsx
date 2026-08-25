"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileUp, ImageOff, Loader2, Save, Search, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/primitives/Button";
import { FieldRow, Input, Textarea } from "@/components/primitives/Field";
import { Badge } from "@/components/primitives/Badge";
import { deleteMedia, updateMedia } from "@/lib/mutations/media";

export interface MediaItem {
  id: string;
  bucket: string;
  path: string;
  filename: string;
  kind: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  altText: string | null;
  caption: string | null;
  folderId: string | null;
}

export function MediaLibrary({
  items, publicBase, databaseReady,
}: {
  items: MediaItem[];

  publicBase: string;
  databaseReady: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [onlyMissingAlt, setOnlyMissingAlt] = React.useState(false);
  const [selected, setSelected] = React.useState<MediaItem | null>(null);
  const [uploading, setUploading] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const inputRef = React.useRef<HTMLInputElement>(null);

  const missingAlt = items.filter((i) => i.kind === "image" && !i.altText).length;

  const shown = items.filter((i) => {
    if (onlyMissingAlt && (i.kind !== "image" || i.altText)) return false;
    const q = query.trim().toLowerCase();
    return !q || i.filename.toLowerCase().includes(q) || (i.altText ?? "").toLowerCase().includes(q);
  });

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      setUploading(file.name);
      try {
        const res = await fetch("/api/media/upload-url", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ filename: file.name, mimeType: file.type, sizeBytes: file.size }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error?.message ?? "Upload failed.");

        if (json.data.uploadUrl) {
          const put = await fetch(json.data.uploadUrl, { method: "PUT", body: file });
          if (!put.ok) throw new Error("The upload did not complete.");
        }

        // Dimensions are read in the browser; the server re-checks the real size.
        let width: number | null = null;
        let height: number | null = null;
        if (file.type.startsWith("image/") && file.type !== "image/svg+xml") {
          const bmp = await createImageBitmap(file).catch(() => null);
          if (bmp) { width = bmp.width; height = bmp.height; bmp.close(); }
        }

        const attach = await fetch("/api/media/attach", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ path: json.data.path, filename: file.name, mimeType: file.type, sizeBytes: file.size, width, height }),
        });
        const attachJson = await attach.json();
        if (!attach.ok) throw new Error(attachJson?.error?.message ?? "Could not register the file.");

        toast.success(`${file.name} uploaded — add alt text before using it`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upload failed.");
      } finally {
        setUploading(null);
      }
    }
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  const save = (item: MediaItem, altText: string, caption: string) => {
    startTransition(async () => {
      const res = await updateMedia(item.id, { alt_text: altText || null, caption: caption || null });
      toast[res.ok ? "success" : "error"](res.message ?? "");
      if (res.ok) { setSelected(null); router.refresh(); }
    });
  };

  const remove = (item: MediaItem) => {
    if (!confirm(`Delete ${item.filename}? References to it become empty rather than broken.`)) return;
    startTransition(async () => {
      const res = await deleteMedia(item.id);
      toast[res.ok ? "success" : "error"](res.message ?? "");
      if (res.ok) { setSelected(null); router.refresh(); }
    });
  };

  return (
    <div>
      {/* upload */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); void upload(e.dataTransfer.files); }}
        className="mb-6 rounded-xl border-2 border-dashed border-border bg-bg-subtle p-8 text-center"
      >
        <FileUp className="mx-auto mb-3 size-6 text-fg-subtle" aria-hidden />
        <p className="mb-1 text-body-sm text-fg">
          Drag files here, or{" "}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="font-semibold text-accent underline underline-offset-4"
            disabled={!databaseReady}
          >
            browse
          </button>
        </p>
        <p className="text-[0.75rem] text-fg-subtle">JPEG, PNG, WebP, AVIF or SVG · up to 10 MB</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*"
          className="sr-only"
          onChange={(e) => void upload(e.currentTarget.files)}
        />
        {uploading && (
          <p className="mt-3 flex items-center justify-center gap-2 text-body-sm text-fg-muted" role="status">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Uploading {uploading}…
          </p>
        )}
      </div>

      {/* filters */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
          <label htmlFor="media-search" className="sr-only">Filter media</label>
          <Input
            id="media-search"
            type="search"
            placeholder="Filter by filename or alt text…"
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            className="pl-9"
          />
        </div>
        <button
          type="button"
          onClick={() => setOnlyMissingAlt((v) => !v)}
          aria-pressed={onlyMissingAlt}
          className={cn(
            "inline-flex h-11 items-center gap-2 rounded-full border px-4 text-[0.8125rem] font-medium transition-colors",
            onlyMissingAlt
              ? "border-warning bg-warning/12 text-warning"
              : "border-border text-fg-muted hover:border-border-strong hover:text-fg",
          )}
        >
          <ImageOff className="size-4" aria-hidden />
          Missing alt text
          <span className="tabular">{missingAlt}</span>
        </button>
        <p className="tabular ml-auto text-body-sm text-fg-muted">{shown.length} files</p>
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-6 py-16 text-center text-body-sm text-fg-subtle">
          {databaseReady
            ? "No files yet. Drop one above to get started."
            : "The media library needs a database. The site is currently using the generated images in /public/img."}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setSelected(item)}
                className="group block w-full overflow-hidden rounded-xl border border-border bg-surface text-left transition-colors hover:border-brand/40"
              >
                <span className="relative block aspect-[4/3] bg-bg-subtle">
                  {publicBase && item.kind === "image" ? (
                    // Storage-hosted user uploads; next/image is reserved for
                    // site content with known dimensions.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`${publicBase}/${item.bucket}/${item.path}`}
                      alt={item.altText ?? ""}
                      loading="lazy"
                      className="size-full object-cover"
                    />
                  ) : (
                    <span className="flex size-full items-center justify-center font-mono text-[0.75rem] text-fg-subtle">
                      {item.kind}
                    </span>
                  )}
                  {item.kind === "image" && !item.altText && (
                    <span className="absolute right-2 top-2">
                      <Badge tone="warning">No alt</Badge>
                    </span>
                  )}
                </span>
                <span className="block p-3">
                  <span className="block truncate text-[0.8125rem] font-medium text-fg">{item.filename}</span>
                  <span className="tabular block text-[0.75rem] text-fg-subtle">
                    {item.width && item.height ? `${item.width}×${item.height} · ` : ""}
                    {(item.sizeBytes / 1024).toFixed(0)} KB
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <MediaDrawer
          item={selected}
          publicBase={publicBase}
          pending={pending}
          onClose={() => setSelected(null)}
          onSave={save}
          onDelete={remove}
        />
      )}
    </div>
  );
}

function MediaDrawer({
  item, publicBase, pending, onClose, onSave, onDelete,
}: {
  item: MediaItem;
  publicBase: string;
  pending: boolean;
  onClose: () => void;
  onSave: (item: MediaItem, alt: string, caption: string) => void;
  onDelete: (item: MediaItem) => void;
}) {
  const [alt, setAlt] = React.useState(item.altText ?? "");
  const [caption, setCaption] = React.useState(item.caption ?? "");

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Details for ${item.filename}`}
      className="fixed inset-0 z-50 flex justify-end bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="h-full w-full max-w-md overflow-y-auto bg-surface p-6 shadow-lg">
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="text-h4 min-w-0 break-words text-fg">{item.filename}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-body-sm text-fg-muted hover:bg-bg-subtle"
          >
            Close
          </button>
        </div>

        {publicBase && item.kind === "image" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`${publicBase}/${item.bucket}/${item.path}`}
            alt={item.altText ?? ""}
            className="mb-5 w-full rounded-lg border border-border"
          />
        )}

        <div className="mb-5 flex flex-col gap-4">
          <FieldRow
            label="Alt text"
            htmlFor="media-alt"
            required={item.kind === "image"}
            help="Describes the image for screen readers and when it fails to load. Required for images at the database level."
          >
            <Textarea id="media-alt" rows={3} value={alt} onChange={(e) => setAlt(e.currentTarget.value)} />
          </FieldRow>

          <FieldRow
            label="Caption"
            htmlFor="media-caption"
            optionalLabel
            help="Rendered under gallery images and rich-text figures. Never used as alt text."
          >
            <Input id="media-caption" value={caption} onChange={(e) => setCaption(e.currentTarget.value)} />
          </FieldRow>
        </div>

        <dl className="mb-6 grid grid-cols-2 gap-3 rounded-lg bg-bg-subtle p-4 text-[0.8125rem]">
          <div><dt className="text-fg-subtle">Type</dt><dd className="font-mono text-fg">{item.mimeType}</dd></div>
          <div><dt className="text-fg-subtle">Size</dt><dd className="tabular text-fg">{(item.sizeBytes / 1024).toFixed(0)} KB</dd></div>
          {item.width && (
            <div><dt className="text-fg-subtle">Dimensions</dt><dd className="tabular text-fg">{item.width}×{item.height}</dd></div>
          )}
          <div><dt className="text-fg-subtle">Bucket</dt><dd className="font-mono text-fg">{item.bucket}</dd></div>
        </dl>

        <div className="flex flex-wrap gap-2">
          <Button icon={Save} iconPosition="start" loading={pending} onClick={() => onSave(item, alt, caption)}>
            Save
          </Button>
          <Button variant="ghost" icon={Trash2} iconPosition="start" onClick={() => onDelete(item)} disabled={pending}>
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
