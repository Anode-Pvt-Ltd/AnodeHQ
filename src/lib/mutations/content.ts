"use server";

import { revalidateTag } from "next/cache";
import { z } from "zod";
import { requireRole, logAudit } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { resourceByKey } from "@/lib/config/resources";
import { ALL_TAGS } from "@/lib/cache";
import { slugify } from "@/lib/utils";

export interface ActionResult {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  id?: string;
}

/** Coerces raw FormData into typed column values using the resource config. */
function coerce(resourceKey: string, form: FormData) {
  const config = resourceByKey(resourceKey);
  if (!config) throw new Error(`Unknown resource: ${resourceKey}`);

  const values: Record<string, unknown> = {};
  const fieldErrors: Record<string, string> = {};

  for (const field of config.fields) {
    const raw = form.get(field.key);

    if (field.widget === "toggle") {
      values[field.key] = raw === "on" || raw === "true";
      continue;
    }

    const str = typeof raw === "string" ? raw.trim() : "";

    if (field.required && !str) {
      fieldErrors[field.key] = `${field.label} is required`;
      continue;
    }

    switch (field.widget) {
      case "number":
        values[field.key] = str === "" ? null : Number(str);
        if (str !== "" && Number.isNaN(values[field.key])) {
          fieldErrors[field.key] = `${field.label} must be a number`;
        }
        break;
      case "tags":
        values[field.key] = str ? str.split("\n").map((s) => s.trim()).filter(Boolean) : [];
        break;
      case "json":
        if (!str) { values[field.key] = {}; break; }
        try {
          values[field.key] = JSON.parse(str);
        } catch {
          fieldErrors[field.key] = "That is not valid JSON";
        }
        break;
      case "slug":
        values[field.key] = str ? slugify(str) : null;
        break;
      case "datetime":
      case "date":
        values[field.key] = str ? new Date(str).toISOString() : null;
        break;
      case "relation":
      case "select":
        values[field.key] = str || null;
        break;
      default:
        if (field.maxLength && str.length > field.maxLength) {
          fieldErrors[field.key] = `${field.label} must be ${field.maxLength} characters or fewer`;
        }
        values[field.key] = str || null;
    }
  }

  // "Published" means both the status and a timestamp that has passed.
  if (values.status === "published" && !values.published_at) {
    values.published_at = new Date().toISOString();
  }

  return { config, values, fieldErrors };
}

function purge(resourceKey: string, slug?: unknown) {
  const map: Record<string, string[]> = {
    projects: ["projects", "industries"],
    services: ["services", "projects", "nav"],
    industries: ["industries", "projects", "nav"],
    posts: ["posts", "topics", "nav"],
    process_stages: ["process"],
    testimonials: ["testimonials", "projects"],
    clients: ["clients"],
    team_members: ["team", "posts"],
    certifications: ["certifications"],
    stats: ["stats"],
    faqs: ["faqs"],
    post_topics: ["posts", "topics"],
  };
  for (const tag of map[resourceKey] ?? []) revalidateTag(tag, "max");

  if (typeof slug === "string" && slug) {
    const prefix: Record<string, string> = {
      projects: "project:", services: "service:", industries: "industry:", posts: "post:",
    };
    const p = prefix[resourceKey];
    if (p) revalidateTag(`${p}${slug}`, "max");
  }
}

export async function saveContent(
  resourceKey: string,
  id: string | null,
  form: FormData,
): Promise<ActionResult> {
  try {
    const config = resourceByKey(resourceKey);
    if (!config) return { ok: false, message: "Unknown content type." };

    const actor = await requireRole(config.minRole);
    const service = createServiceClient();
    if (!service) return { ok: false, message: "The database is not configured." };

    const { values, fieldErrors } = coerce(resourceKey, form);
    if (Object.keys(fieldErrors).length) {
      return { ok: false, fieldErrors, message: "Some fields need attention." };
    }

    if (id) {
      const { error } = await service.from(config.table).update(values).eq("id", id);
      if (error) throw error;
      await logAudit(actor.id, "update", config.table, id, values);
      purge(resourceKey, values.slug);
      return { ok: true, id, message: "Saved." };
    }

    const { data, error } = await service.from(config.table).insert(values).select("id").single();
    if (error) throw error;
    await logAudit(actor.id, "insert", config.table, data.id as string, values);
    purge(resourceKey, values.slug);
    return { ok: true, id: data.id as string, message: "Created." };
  } catch (err) {
    const message =
      err instanceof Error && err.message.includes("duplicate key")
        ? "That slug is already in use."
        : err instanceof Error
          ? err.message
          : "Could not save.";
    return { ok: false, message };
  }
}

export async function deleteContent(resourceKey: string, id: string): Promise<ActionResult> {
  try {
    const config = resourceByKey(resourceKey);
    if (!config) return { ok: false, message: "Unknown content type." };

    const actor = await requireRole("admin");
    const service = createServiceClient();
    if (!service) return { ok: false, message: "The database is not configured." };

    // Capture the row first so the audit diff can reconstruct it.
    const { data: before } = await service.from(config.table).select("*").eq("id", id).maybeSingle();
    const { error } = await service.from(config.table).delete().eq("id", id);
    if (error) throw error;

    await logAudit(actor.id, "delete", config.table, id, before);
    purge(resourceKey, (before as Record<string, unknown> | null)?.slug);
    return { ok: true, message: "Deleted." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not delete." };
  }
}

export async function setStatus(
  resourceKey: string,
  id: string,
  status: "draft" | "scheduled" | "published" | "archived",
): Promise<ActionResult> {
  try {
    const config = resourceByKey(resourceKey);
    if (!config) return { ok: false, message: "Unknown content type." };

    const actor = await requireRole(config.minRole);
    const service = createServiceClient();
    if (!service) return { ok: false, message: "The database is not configured." };

    const patch: Record<string, unknown> = { status };
    if (status === "published") patch.published_at = new Date().toISOString();

    const { data, error } = await service
      .from(config.table).update(patch).eq("id", id).select("slug").maybeSingle();
    if (error) throw error;

    await logAudit(actor.id, status === "published" ? "publish" : "update", config.table, id, patch);
    purge(resourceKey, (data as Record<string, unknown> | null)?.slug);
    return { ok: true, message: status === "published" ? "Published." : `Set to ${status}.` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not update." };
  }
}

export async function reorderItems(resourceKey: string, ids: string[]): Promise<ActionResult> {
  try {
    const config = resourceByKey(resourceKey);
    if (!config) return { ok: false, message: "Unknown content type." };

    await requireRole(config.minRole);
    const service = createServiceClient();
    if (!service) return { ok: false, message: "The database is not configured." };

    const parsed = z.array(z.string().uuid()).max(500).parse(ids);
    const { error } = await service.rpc("reorder", { p_table: config.table, p_ids: parsed });
    if (error) throw error;

    purge(resourceKey);
    return { ok: true, message: "Reordered." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not reorder." };
  }
}

export async function purgeAll(): Promise<ActionResult> {
  await requireRole("admin");
  for (const tag of ALL_TAGS) revalidateTag(tag, "max");
  return { ok: true, message: "Every cache tag purged." };
}
