import { requireRole } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { MediaLibrary } from "@/components/admin/MediaLibrary";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const metadata = { title: "Media" };

export default async function MediaPage() {
  await requireRole("editor");
  const service = createServiceClient();

  let items: Record<string, unknown>[] = [];

  if (service) {
    const { data: media } = await service
      .from("media")
      .select("id, bucket, path, filename, mime_type, kind, size_bytes, width, height, alt_text, caption, folder_id, created_at")
      .order("created_at", { ascending: false })
      .limit(300);
    items = (media ?? []) as Record<string, unknown>[];
  }

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-7">
        <h1 className="text-h2 text-fg">Media</h1>
        <p className="mt-1.5 max-w-2xl text-body-sm text-fg-muted">
          Uploads go straight from the browser to storage on a signed URL, so a 25&nbsp;MB file never
          passes through the server. Alt text is required for images at the database level.
        </p>
      </header>

      <MediaLibrary
        items={items.map((m) => ({
          id: String(m.id),
          bucket: String(m.bucket),
          path: String(m.path),
          filename: String(m.filename),
          kind: String(m.kind),
          mimeType: String(m.mime_type),
          sizeBytes: Number(m.size_bytes ?? 0),
          width: m.width ? Number(m.width) : null,
          height: m.height ? Number(m.height) : null,
          altText: m.alt_text ? String(m.alt_text) : null,
          caption: m.caption ? String(m.caption) : null,
          folderId: m.folder_id ? String(m.folder_id) : null,
        }))}

        publicBase={env.supabaseUrl ? `${env.supabaseUrl}/storage/v1/object/public` : ""}
        databaseReady={Boolean(service)}
      />
    </div>
  );
}
