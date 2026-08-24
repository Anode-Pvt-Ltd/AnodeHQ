"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, Save } from "lucide-react";
import { cn, slugify } from "@/lib/utils";
import { Button } from "@/components/primitives/Button";
import { FieldRow, Input, Select, Textarea } from "@/components/primitives/Field";
import { IconPicker } from "./IconPicker";
import { saveContent } from "@/lib/mutations/content";
import type { FieldConfig, ResourceConfig } from "@/lib/config/resources";

/**
 * The single edit view for every content type. Which fields appear, what they
 * are called and what each one changes on the public site all come from the
 * resource config — spec §11.3.
 */
export function EntityForm({
  config,
  id,
  initial,
  relationOptions,
  databaseReady,
}: {
  config: ResourceConfig;
  id: string | null;
  initial: Record<string, unknown>;
  relationOptions: Record<string, { value: string; label: string }[]>;
  databaseReady: boolean;
}) {
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, startTransition] = React.useTransition();
  const [dirty, setDirty] = React.useState(false);
  const [slugTouched, setSlugTouched] = React.useState(Boolean(initial.slug));

  // Guard against losing work on navigation
  React.useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const fieldByKey = React.useMemo(
    () => new Map(config.fields.map((f) => [f.key, f])),
    [config.fields],
  );

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    const form = new FormData(e.currentTarget);

    startTransition(async () => {
      const res = await saveContent(config.key, id, form);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.message ?? "Could not save.");
        return;
      }
      setDirty(false);
      toast.success(res.message ?? "Saved.");
      if (!id && res.id) router.replace(`/admin/${config.key}/${res.id}`);
      else router.refresh();
    });
  }

  // Auto-derive the slug from the title until it is edited by hand
  const onTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDirty(true);
    if (slugTouched || !formRef.current) return;
    const slugInput = formRef.current.elements.namedItem("slug") as HTMLInputElement | null;
    if (slugInput) slugInput.value = slugify(e.currentTarget.value);
  };

  return (
    <form ref={formRef} onSubmit={onSubmit} onChange={() => setDirty(true)} noValidate>
      {!databaseReady && (
        <p className="mb-6 rounded-lg border border-warning/30 bg-warning/8 px-4 py-3 text-body-sm text-warning">
          The database is not configured, so this form cannot save yet. Every field below is live —
          it will write as soon as the Supabase environment variables are set.
        </p>
      )}

      <div className="flex flex-col gap-7">
        {config.groups.map((group) => (
          <fieldset key={group.label} className="rounded-xl border border-border bg-surface p-5 lg:p-6">
            <legend className="px-2 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-fg-subtle">
              {group.label}
            </legend>
            <div className="mt-2 flex flex-col gap-5">
              {group.fields.map((key) => {
                const field = fieldByKey.get(key);
                if (!field) return null;
                return (
                  <Field
                    key={key}
                    field={field}
                    value={initial[key]}
                    error={errors[key]}
                    options={relationOptions[key]}
                    onTitleChange={key === "title" || key === "name" ? onTitleChange : undefined}
                    onSlugTouched={key === "slug" ? () => setSlugTouched(true) : undefined}
                  />
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>

      <div className="sticky bottom-0 z-10 mt-7 flex flex-wrap items-center gap-3 border-t border-border bg-surface/95 py-4 backdrop-blur">
        <Button type="submit" icon={Save} iconPosition="start" loading={pending} disabled={!databaseReady}>
          {id ? "Save changes" : `Create ${config.label.singular.toLowerCase()}`}
        </Button>
        {config.previewPath && initial.slug ? (
          <Button asChild variant="secondary" icon={Eye} iconPosition="start">
            <a href={config.previewPath(initial)} target="_blank" rel="noreferrer">Preview</a>
          </Button>
        ) : null}
        {dirty && <span className="text-body-sm text-warning">Unsaved changes</span>}
      </div>
    </form>
  );
}

function Field({
  field, value, error, options, onTitleChange, onSlugTouched,
}: {
  field: FieldConfig;
  value: unknown;
  error?: string;
  options?: { value: string; label: string }[];
  onTitleChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSlugTouched?: () => void;
}) {
  const id = `f-${field.key}`;
  const help = [field.help, field.controls && `Controls: ${field.controls}`]
    .filter(Boolean)
    .join(" · ");

  const str = (v: unknown) => (v == null ? "" : String(v));

  switch (field.widget) {
    case "toggle":
      return (
        <label
          htmlFor={id}
          className={cn(
            "flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3.5 transition-colors hover:bg-bg-subtle",
            "has-[:checked]:border-brand has-[:checked]:bg-teal-50/60 dark:has-[:checked]:bg-teal-900/25",
          )}
        >
          <input
            id={id}
            name={field.key}
            type="checkbox"
            defaultChecked={Boolean(value)}
            className="mt-0.5 size-[1.15rem] cursor-pointer rounded accent-[var(--color-brand)]"
          />
          <span>
            <span className="block text-[0.9375rem] font-medium text-fg">{field.label}</span>
            {help && <span className="mt-0.5 block text-[0.8125rem] leading-snug text-fg-muted">{help}</span>}
          </span>
        </label>
      );

    case "iconPicker":
      return (
        <FieldRow label={field.label} htmlFor={id} required={field.required} help={help} error={error}>
          <IconPicker name={field.key} defaultValue={str(value)} id={id} />
        </FieldRow>
      );

    case "select":
    case "relation": {
      const opts = field.options ?? options ?? [];
      return (
        <FieldRow label={field.label} htmlFor={id} required={field.required} help={help} error={error}>
          <Select id={id} name={field.key} defaultValue={str(value)}>
            <option value="">{field.required ? "Choose…" : "None"}</option>
            {opts.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </FieldRow>
      );
    }

    case "textarea":
    case "richText":
      return (
        <FieldRow label={field.label} htmlFor={id} required={field.required} help={help} error={error}>
          <Textarea
            id={id}
            name={field.key}
            rows={field.rows ?? 5}
            maxLength={field.maxLength}
            defaultValue={str(value)}
            className={field.widget === "richText" ? "font-mono text-[0.8125rem]" : undefined}
          />
        </FieldRow>
      );

    case "tags":
      return (
        <FieldRow
          label={field.label}
          htmlFor={id}
          required={field.required}
          help={`${help}${help ? " · " : ""}One per line.`}
          error={error}
        >
          <Textarea
            id={id}
            name={field.key}
            rows={field.rows ?? 5}
            defaultValue={Array.isArray(value) ? value.join("\n") : str(value)}
          />
        </FieldRow>
      );

    case "json":
      return (
        <FieldRow label={field.label} htmlFor={id} required={field.required} help={help} error={error}>
          <Textarea
            id={id}
            name={field.key}
            rows={field.rows ?? 8}
            className="font-mono text-[0.8125rem]"
            defaultValue={value ? JSON.stringify(value, null, 2) : ""}
          />
        </FieldRow>
      );

    case "number":
      return (
        <FieldRow label={field.label} htmlFor={id} required={field.required} help={help} error={error}>
          <Input id={id} name={field.key} type="number" step="any" defaultValue={str(value)} />
        </FieldRow>
      );

    case "date":
    case "datetime":
      return (
        <FieldRow label={field.label} htmlFor={id} required={field.required} help={help} error={error}>
          <Input
            id={id}
            name={field.key}
            type={field.widget === "date" ? "date" : "datetime-local"}
            defaultValue={value ? new Date(String(value)).toISOString().slice(0, field.widget === "date" ? 10 : 16) : ""}
          />
        </FieldRow>
      );

    case "slug":
      return (
        <FieldRow label={field.label} htmlFor={id} required={field.required} help={help} error={error}>
          <Input
            id={id}
            name={field.key}
            defaultValue={str(value)}
            onInput={onSlugTouched}
            className="font-mono text-[0.875rem]"
          />
        </FieldRow>
      );

    default:
      return (
        <FieldRow label={field.label} htmlFor={id} required={field.required} help={help} error={error}>
          <Input
            id={id}
            name={field.key}
            maxLength={field.maxLength}
            defaultValue={str(value)}
            onChange={onTitleChange}
          />
        </FieldRow>
      );
  }
}
