"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, FileUp, Loader2, Paperclip, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/primitives/Button";
import { Choice, FieldRow, Input, Select, Textarea } from "@/components/primitives/Field";
import {
  ALLOWED_UPLOAD_EXT, BUDGET_RANGES, MAX_UPLOAD_BYTES, PROJECT_TYPES, QUANTITIES, STAGES,
  STAGE_LABELS, TIMELINES, quoteStep1, quoteStep2, quoteStep3, quoteStep4, quoteSubmitSchema,
} from "@/lib/schemas";
import type { IndustrySummary, ServiceSummary } from "@/types/app";

/**
 * Four steps, each its own Zod object; the submit schema is their intersection,
 * so a step cannot be skipped by posting directly. Answers persist in
 * sessionStorage, making the form refresh-safe. Spec §7.
 */

const STEPS = ["Project", "Scope", "Files", "You"] as const;
const STORAGE_KEY = "anode:quote:v1";

interface Attachment {
  path: string;
  filename: string;
  sizeBytes: number;
  mimeType: string;
}

interface FormState {
  projectType: string;
  industrySlug: string;
  stage: string;
  serviceSlugs: string[];
  quantityEstimate: string;
  timeline: string;
  budgetRange: string;
  description: string;
  ndaRequired: boolean;
  fullName: string;
  email: string;
  phone: string;
  company: string;
  country: string;
  howHeard: string;
}

const EMPTY: FormState = {
  projectType: "", industrySlug: "", stage: "", serviceSlugs: [], quantityEstimate: "",
  timeline: "", budgetRange: "", description: "", ndaRequired: false,
  fullName: "", email: "", phone: "", company: "", country: "", howHeard: "",
};

export function QuoteWizard({
  services, industries, responsePromise,
}: {
  services: ServiceSummary[];
  industries: IndustrySummary[];
  responsePromise: string;
}) {
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [v, setV] = React.useState<FormState>(EMPTY);
  const [attachments, setAttachments] = React.useState<Attachment[]>([]);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [website, setWebsite] = React.useState("");
  const startedAt = React.useRef(Date.now());
  const formToken = React.useRef<string>("");
  const headingRef = React.useRef<HTMLHeadingElement>(null);

  // restore + persist
  React.useEffect(() => {
    formToken.current = crypto.randomUUID();
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { v: FormState; step: number };
        setV({ ...EMPTY, ...parsed.v });
        setStep(Math.min(parsed.step ?? 0, 3));
      }
    } catch { /* private mode — start fresh */ }
  }, []);

  React.useEffect(() => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ v, step })); } catch { /* ignore */ }
  }, [v, step]);

  const set = <K extends keyof FormState>(k: K, value: FormState[K]) =>
    setV((prev) => ({ ...prev, [k]: value }));

  const toggleService = (slug: string) =>
    setV((prev) => ({
      ...prev,
      serviceSlugs: prev.serviceSlugs.includes(slug)
        ? prev.serviceSlugs.filter((s) => s !== slug)
        : [...prev.serviceSlugs, slug],
    }));

  function validateStep(index: number): boolean {
    const schemas = [
      () => quoteStep1.safeParse({ projectType: v.projectType, industrySlug: v.industrySlug, stage: v.stage }),
      () =>
        quoteStep2.safeParse({
          serviceSlugs: v.serviceSlugs,
          quantityEstimate: v.quantityEstimate || undefined,
          timeline: v.timeline,
          budgetRange: v.budgetRange || undefined,
          description: v.description,
        }),
      () => quoteStep3.safeParse({ attachments, ndaRequired: v.ndaRequired }),
      () =>
        quoteStep4.safeParse({
          fullName: v.fullName, email: v.email, phone: v.phone,
          company: v.company, country: v.country, howHeard: v.howHeard,
        }),
    ];
    const result = schemas[index]!();
    if (result.success) { setErrors({}); return true; }
    const next: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!next[key]) next[key] = issue.message;
    }
    setErrors(next);
    return false;
  }

  const goNext = () => {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(s + 1, 3));
    requestAnimationFrame(() => headingRef.current?.focus());
  };
  const goBack = () => {
    setErrors({});
    setStep((s) => Math.max(s - 1, 0));
    requestAnimationFrame(() => headingRef.current?.focus());
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!validateStep(3)) return;

    const payload = {
      projectType: v.projectType,
      industrySlug: v.industrySlug,
      stage: v.stage,
      serviceSlugs: v.serviceSlugs,
      quantityEstimate: v.quantityEstimate || undefined,
      timeline: v.timeline,
      budgetRange: v.budgetRange || undefined,
      description: v.description,
      attachments,
      ndaRequired: v.ndaRequired,
      fullName: v.fullName,
      email: v.email,
      phone: v.phone,
      company: v.company,
      country: v.country,
      howHeard: v.howHeard,
      website,
      startedAt: startedAt.current,
      source: collectSource(),
    };

    const parsed = quoteSubmitSchema.safeParse(payload);
    if (!parsed.success) {
      setFormError("Some answers are still missing. Step back through and check the highlighted fields.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const json = await res.json();
      if (!res.ok) {
        setFormError(json?.error?.message ?? "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }
      try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
      router.push(`/quote/sent?ref=${encodeURIComponent(json.data.reference)}`);
    } catch {
      setFormError("We could not reach the server. Your answers are saved — try again in a moment.");
      setSubmitting(false);
    }
  }

  const industryName = industries.find((i) => i.slug === v.industrySlug)?.name;

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-14">
      <form onSubmit={onSubmit} noValidate className="min-w-0">
        {/* progress */}
        <ol className="mb-8 flex items-center gap-2" aria-label="Progress">
          {STEPS.map((label, i) => (
            <li key={label} className="flex flex-1 items-center gap-2">
              <span
                aria-current={i === step ? "step" : undefined}
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-[0.75rem] font-semibold transition-colors",
                  i < step ? "bg-brand text-on-brand"
                    : i === step ? "bg-brand text-on-brand ring-4 ring-brand/20"
                    : "border border-border bg-surface text-fg-subtle",
                )}
              >
                {i < step ? <Check className="size-3.5" aria-hidden /> : i + 1}
              </span>
              <span className={cn("hidden text-body-sm sm:inline", i === step ? "font-semibold text-fg" : "text-fg-subtle")}>
                {label}
              </span>
              {i < STEPS.length - 1 && <span className="h-px flex-1 bg-border" aria-hidden />}
            </li>
          ))}
        </ol>

        <h2 ref={headingRef} tabIndex={-1} className="text-h3 mb-1 text-fg outline-none">
          {["What are you building?", "What do you need from us?", "Anything to share?", "How do we reach you?"][step]}
        </h2>
        <p className="mb-7 text-body-sm text-fg-muted">
          {[
            "Three quick questions so we can point this at the right engineer.",
            "The more constraints you give, the more useful the reply.",
            "Optional — schematics, gerbers, a BOM or a requirements document.",
            "Last step. We reply from an engineer, not a sales team.",
          ][step]}
        </p>

        {/* ---------------------------------------------------- step 1 */}
        {step === 0 && (
          <div className="flex flex-col gap-6">
            <fieldset>
              <legend className="mb-3 text-body-sm font-medium text-fg">
                What best describes the project? <span className="text-danger" aria-hidden>*</span>
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {PROJECT_TYPES.map((t) => (
                  <Choice
                    key={t} type="radio" name="projectType" id={`pt-${t}`} value={t} label={t}
                    checked={v.projectType === t} onChange={() => set("projectType", t)}
                  />
                ))}
              </div>
              {errors.projectType && <p role="alert" className="mt-2 text-[0.8125rem] text-danger">{errors.projectType}</p>}
            </fieldset>

            <FieldRow label="Closest sector" htmlFor="q-industry" required error={errors.industrySlug}>
              <Select id="q-industry" value={v.industrySlug} onChange={(e) => set("industrySlug", e.currentTarget.value)}>
                <option value="">Choose a sector…</option>
                {industries.map((i) => <option key={i.slug} value={i.slug}>{i.name}</option>)}
                <option value="other">Something else</option>
              </Select>
            </FieldRow>

            <fieldset>
              <legend className="mb-3 text-body-sm font-medium text-fg">
                Where is it today? <span className="text-danger" aria-hidden>*</span>
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {STAGES.map((s) => (
                  <Choice
                    key={s} type="radio" name="stage" id={`st-${s}`} value={s} label={STAGE_LABELS[s]}
                    checked={v.stage === s} onChange={() => set("stage", s)}
                  />
                ))}
              </div>
              {errors.stage && <p role="alert" className="mt-2 text-[0.8125rem] text-danger">{errors.stage}</p>}
            </fieldset>
          </div>
        )}

        {/* ---------------------------------------------------- step 2 */}
        {step === 1 && (
          <div className="flex flex-col gap-6">
            <fieldset>
              <legend className="mb-3 text-body-sm font-medium text-fg">
                Which services? <span className="text-danger" aria-hidden>*</span>
                <span className="ml-1.5 font-normal text-fg-subtle">Select all that apply</span>
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {services.map((s) => (
                  <Choice
                    key={s.slug} id={`sv-${s.slug}`} value={s.slug} label={s.title} description={s.summary}
                    checked={v.serviceSlugs.includes(s.slug)} onChange={() => toggleService(s.slug)}
                  />
                ))}
              </div>
              {errors.serviceSlugs && <p role="alert" className="mt-2 text-[0.8125rem] text-danger">{errors.serviceSlugs}</p>}
            </fieldset>

            <div className="grid gap-5 sm:grid-cols-2">
              <FieldRow label="Expected volume" htmlFor="q-qty" optionalLabel error={errors.quantityEstimate}>
                <Select id="q-qty" value={v.quantityEstimate} onChange={(e) => set("quantityEstimate", e.currentTarget.value)}>
                  <option value="">Not sure yet</option>
                  {QUANTITIES.map((q) => <option key={q} value={q}>{q}</option>)}
                </Select>
              </FieldRow>
              <FieldRow label="Timeline" htmlFor="q-timeline" required error={errors.timeline}>
                <Select id="q-timeline" value={v.timeline} onChange={(e) => set("timeline", e.currentTarget.value)}>
                  <option value="">Choose…</option>
                  {TIMELINES.map((t) => <option key={t} value={t}>{t}</option>)}
                </Select>
              </FieldRow>
            </div>

            <FieldRow
              label="Budget range"
              htmlFor="q-budget"
              optionalLabel
              help="A band helps us propose something realistic. Leave it blank if you would rather not say — it will not affect whether we reply."
              error={errors.budgetRange}
            >
              <Select id="q-budget" value={v.budgetRange} onChange={(e) => set("budgetRange", e.currentTarget.value)}>
                <option value="">Prefer not to say</option>
                {BUDGET_RANGES.map((b) => <option key={b} value={b}>{b}</option>)}
              </Select>
            </FieldRow>

            <FieldRow
              label="Tell us about it"
              htmlFor="q-desc"
              required
              help="What it does, the environment it runs in, and anything that has already gone wrong."
              error={errors.description}
            >
              <Textarea id="q-desc" rows={6} value={v.description} onChange={(e) => set("description", e.currentTarget.value)} />
            </FieldRow>
          </div>
        )}

        {/* ---------------------------------------------------- step 3 */}
        {step === 2 && (
          <div className="flex flex-col gap-6">
            <FileDropzone
              formToken={formToken}
              attachments={attachments}
              onChange={setAttachments}
              error={errors.attachments}
            />
            <Choice
              id="q-nda"
              value="nda"
              label="We will need an NDA before sharing detail"
              description="Send us yours and we will sign it — that is faster than negotiating ours."
              checked={v.ndaRequired}
              onChange={(c) => set("ndaRequired", c)}
            />
          </div>
        )}

        {/* ---------------------------------------------------- step 4 */}
        {step === 3 && (
          <div className="flex flex-col gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <FieldRow label="Your name" htmlFor="q-name" required error={errors.fullName}>
                <Input id="q-name" autoComplete="name" value={v.fullName} onChange={(e) => set("fullName", e.currentTarget.value)} />
              </FieldRow>
              <FieldRow label="Work email" htmlFor="q-email" required error={errors.email}>
                <Input id="q-email" type="email" autoComplete="email" value={v.email} onChange={(e) => set("email", e.currentTarget.value)} />
              </FieldRow>
              <FieldRow label="Phone" htmlFor="q-phone" optionalLabel error={errors.phone}>
                <Input id="q-phone" type="tel" autoComplete="tel" value={v.phone} onChange={(e) => set("phone", e.currentTarget.value)} />
              </FieldRow>
              <FieldRow label="Company" htmlFor="q-company" optionalLabel error={errors.company}>
                <Input id="q-company" autoComplete="organization" value={v.company} onChange={(e) => set("company", e.currentTarget.value)} />
              </FieldRow>
              <FieldRow label="Country" htmlFor="q-country" optionalLabel error={errors.country}>
                <Input id="q-country" autoComplete="country-name" value={v.country} onChange={(e) => set("country", e.currentTarget.value)} />
              </FieldRow>
              <FieldRow label="How did you hear about us?" htmlFor="q-heard" optionalLabel error={errors.howHeard}>
                <Input id="q-heard" value={v.howHeard} onChange={(e) => set("howHeard", e.currentTarget.value)} />
              </FieldRow>
            </div>

            <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
              <label htmlFor="q-website">Leave this field empty</label>
              <input id="q-website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.currentTarget.value)} />
            </div>

            <p className="text-[0.8125rem] leading-relaxed text-fg-subtle">
              We use these details only to reply to your enquiry. Nothing is shared with third
              parties and there is no marketing list attached to this form.
            </p>
          </div>
        )}

        {formError && (
          <p role="alert" className="mt-6 rounded-lg border border-danger/30 bg-danger/8 px-4 py-3 text-body-sm text-danger">
            {formError}
          </p>
        )}

        {/* nav */}
        <div className="mt-9 flex flex-wrap items-center gap-3 border-t border-border pt-6">
          {step > 0 && (
            <Button type="button" variant="ghost" icon={ArrowLeft} iconPosition="start" onClick={goBack}>
              Back
            </Button>
          )}
          {step < 3 ? (
            <Button type="button" size="lg" icon={ArrowRight} onClick={goNext} className="ml-auto">
              Continue
            </Button>
          ) : (
            <Button type="submit" size="lg" icon={ArrowRight} loading={submitting} className="ml-auto">
              Send request
            </Button>
          )}
        </div>
      </form>

      {/* live summary */}
      <aside className="hidden lg:block">
        <div className="sticky top-28 rounded-xl border border-border bg-bg-subtle p-6">
          <h2 className="text-label mb-4 text-fg-subtle">Your request so far</h2>
          <dl className="flex flex-col gap-3 text-body-sm">
            <SummaryRow label="Project" value={v.projectType} />
            <SummaryRow label="Sector" value={industryName ?? (v.industrySlug === "other" ? "Something else" : "")} />
            <SummaryRow label="Stage" value={v.stage ? STAGE_LABELS[v.stage as keyof typeof STAGE_LABELS] : ""} />
            <SummaryRow
              label="Services"
              value={v.serviceSlugs.map((s) => services.find((x) => x.slug === s)?.title ?? s).join(", ")}
            />
            <SummaryRow label="Timeline" value={v.timeline} />
            <SummaryRow label="Volume" value={v.quantityEstimate} />
            <SummaryRow label="Files" value={attachments.length ? `${attachments.length} attached` : ""} />
            <SummaryRow label="NDA" value={v.ndaRequired ? "Required" : ""} />
          </dl>
          <p className="mt-6 border-t border-border pt-4 text-[0.8125rem] text-fg-subtle">{responsePromise}</p>
        </div>
      </aside>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-20 shrink-0 text-fg-subtle">{label}</dt>
      <dd className={cn("min-w-0 flex-1", value ? "text-fg" : "text-fg-subtle/60")}>{value || "—"}</dd>
    </div>
  );
}

/* --------------------------------------------------------- dropzone */

function FileDropzone({
  formToken, attachments, onChange, error,
}: {
  formToken: React.RefObject<string>;
  attachments: Attachment[];
  onChange: (a: Attachment[]) => void;
  error?: string;
}) {
  const [busy, setBusy] = React.useState<string | null>(null);
  const [localError, setLocalError] = React.useState<string | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setLocalError(null);

    for (const file of Array.from(files)) {
      if (attachments.length >= 5) { setLocalError("Up to five files."); break; }

      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!ALLOWED_UPLOAD_EXT.includes(ext as (typeof ALLOWED_UPLOAD_EXT)[number])) {
        setLocalError(`We cannot accept .${ext} files. Zip it and try again.`);
        continue;
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        setLocalError(`${file.name} is larger than 25 MB.`);
        continue;
      }

      setBusy(file.name);
      try {
        const res = await fetch("/api/quote/upload-url", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            mimeType: file.type || "application/octet-stream",
            sizeBytes: file.size,
            formToken: formToken.current,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error?.message ?? "Upload failed.");

        // With storage configured the browser PUTs straight to it, never through
        // the function — that is what keeps a 25 MB schematic possible (§9.3).
        if (json.data.uploadUrl) {
          const put = await fetch(json.data.uploadUrl, { method: "PUT", body: file });
          if (!put.ok) throw new Error("The upload did not complete.");
        }

        onChange([
          ...attachments,
          { path: json.data.path, filename: file.name, sizeBytes: file.size, mimeType: file.type || "application/octet-stream" },
        ]);
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : "Upload failed.");
      } finally {
        setBusy(null);
      }
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div>
      <p className="mb-2 text-body-sm font-medium text-fg">
        Attachments <span className="font-normal text-fg-subtle">(optional)</span>
      </p>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); void upload(e.dataTransfer.files); }}
        className={cn(
          "rounded-xl border-2 border-dashed p-8 text-center transition-colors",
          dragging ? "border-brand bg-teal-50/60 dark:bg-teal-900/25" : "border-border bg-bg-subtle",
        )}
      >
        <FileUp className="mx-auto mb-3 size-6 text-fg-subtle" aria-hidden />
        <p className="mb-1 text-body-sm text-fg">
          Drag files here, or{" "}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="font-semibold text-accent underline underline-offset-4"
          >
            browse
          </button>
        </p>
        <p className="text-[0.75rem] text-fg-subtle">
          PDF, ZIP, STEP, Gerber, Altium or KiCad · up to 25 MB each · five files
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="sr-only"
          accept={ALLOWED_UPLOAD_EXT.map((e) => `.${e}`).join(",")}
          onChange={(e) => void upload(e.currentTarget.files)}
        />
      </div>

      {busy && (
        <p className="mt-3 flex items-center gap-2 text-body-sm text-fg-muted" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Uploading {busy}…
        </p>
      )}

      {(localError || error) && (
        <p role="alert" className="mt-3 text-[0.8125rem] text-danger">{localError ?? error}</p>
      )}

      {attachments.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2">
          {attachments.map((a) => (
            <li key={a.path} className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3.5 py-2.5">
              <Paperclip className="size-4 shrink-0 text-fg-subtle" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-body-sm text-fg">{a.filename}</span>
              <span className="tabular shrink-0 text-[0.75rem] text-fg-subtle">
                {(a.sizeBytes / 1024 / 1024).toFixed(1)} MB
              </span>
              <button
                type="button"
                onClick={() => onChange(attachments.filter((x) => x.path !== a.path))}
                aria-label={`Remove ${a.filename}`}
                className="-mr-1 rounded p-1.5 text-fg-subtle hover:bg-bg-subtle hover:text-danger"
              >
                <X className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function collectSource(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const p = new URLSearchParams(window.location.search);
  const out: Record<string, string> = {};
  for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) {
    const val = p.get(k);
    if (val) out[k] = val;
  }
  if (document.referrer) out.referrer = document.referrer;
  out.landing_path = window.location.pathname;
  return out;
}
