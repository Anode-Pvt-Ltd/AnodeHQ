import { notFound } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { resourceByKey } from "@/lib/config/resources";
import { createServiceClient } from "@/lib/supabase/service";
import { requireRole } from "@/lib/auth";
import { ResourceTable } from "@/components/admin/ResourceTable";
import { Button } from "@/components/primitives/Button";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ resource: string }> }) {
  const config = resourceByKey((await params).resource);
  return { title: config?.label.plural ?? "Admin" };
}

export default async function ResourceListPage({
  params,
}: {
  params: Promise<{ resource: string }>;
}) {
  const { resource } = await params;
  const config = resourceByKey(resource);
  if (!config) notFound();

  await requireRole(config.minRole);

  const service = createServiceClient();
  let rows: Record<string, unknown>[] = [];
  let loadError: string | null = null;

  if (service) {
    const { data, error } = await service
      .from(config.table)
      .select("*")
      .order(config.defaultSort.key, { ascending: config.defaultSort.dir === "asc" })
      .limit(500);
    if (error) loadError = error.message;
    else rows = (data ?? []) as Record<string, unknown>[];
  }

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-h2 text-fg">{config.label.plural}</h1>
          <p className="mt-1.5 max-w-2xl text-body-sm text-fg-muted">{config.description}</p>
        </div>
        <Button asChild icon={Plus} iconPosition="start">
          <Link href={`/admin/${resource}/new`}>New {config.label.singular.toLowerCase()}</Link>
        </Button>
      </header>

      {loadError && (
        <p role="alert" className="mb-5 rounded-lg border border-danger/30 bg-danger/8 px-4 py-3 text-body-sm text-danger">
          Could not load rows: {loadError}
        </p>
      )}

      <ResourceTable config={config} rows={rows} />
    </div>
  );
}
