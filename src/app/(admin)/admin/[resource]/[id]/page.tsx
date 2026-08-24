import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { resourceByKey } from "@/lib/config/resources";
import { createServiceClient } from "@/lib/supabase/service";
import { requireRole } from "@/lib/auth";
import { EntityForm } from "@/components/admin/EntityForm";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ resource: string; id: string }>;
}) {
  const { resource, id } = await params;
  const config = resourceByKey(resource);
  if (!config) return { title: "Admin" };
  return { title: id === "new" ? `New ${config.label.singular}` : `Edit ${config.label.singular}` };
}

export default async function ResourceEditPage({
  params,
}: {
  params: Promise<{ resource: string; id: string }>;
}) {
  const { resource, id } = await params;
  const config = resourceByKey(resource);
  if (!config) notFound();

  await requireRole(config.minRole);

  const isNew = id === "new";
  const service = createServiceClient();

  let row: Record<string, unknown> | null = null;
  if (!isNew && service) {
    const { data } = await service.from(config.table).select("*").eq("id", id).maybeSingle();
    row = (data as Record<string, unknown> | null) ?? null;
    if (!row) notFound();
  }

  // Options for every relation field on this form, resolved server-side.
  const relationOptions: Record<string, { value: string; label: string }[]> = {};
  if (service) {
    for (const field of config.fields) {
      if (field.widget !== "relation" || !field.source) continue;
      const labelCol =
        field.source === "industries" || field.source === "post_topics" || field.source === "team_members"
          ? "name"
          : "title";
      const { data } = await service
        .from(field.source)
        .select(`id, ${labelCol}`)
        .order(labelCol)
        .limit(200);
      relationOptions[field.key] = (data ?? []).map((r) => ({
        value: String((r as Record<string, unknown>).id),
        label: String((r as Record<string, unknown>)[labelCol] ?? ""),
      }));
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/admin/${resource}`}
          className="inline-flex items-center gap-1.5 text-body-sm text-fg-muted hover:text-brand"
        >
          <ArrowLeft className="size-4" aria-hidden />
          All {config.label.plural.toLowerCase()}
        </Link>

        {!isNew && config.previewPath && row?.slug ? (
          <Link
            href={config.previewPath(row)}
            target="_blank"
            className="inline-flex items-center gap-1.5 text-body-sm text-accent hover:underline"
          >
            View on the site <ExternalLink className="size-3.5" aria-hidden />
          </Link>
        ) : null}
      </div>

      <h1 className="text-h2 mb-1 text-fg">
        {isNew ? `New ${config.label.singular.toLowerCase()}` : String(row?.title ?? row?.name ?? row?.label ?? "Edit")}
      </h1>
      <p className="mb-8 text-body-sm text-fg-muted">{config.description}</p>

      <EntityForm
        config={config}
        id={isNew ? null : id}
        initial={row ?? {}}
        relationOptions={relationOptions}
        databaseReady={Boolean(service)}
      />
    </div>
  );
}
