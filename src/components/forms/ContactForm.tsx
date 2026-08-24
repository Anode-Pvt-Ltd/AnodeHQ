"use client";

import * as React from "react";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/primitives/Button";
import { FieldRow, Input, Textarea } from "@/components/primitives/Field";
import { contactSchema, type ContactInput } from "@/lib/schemas";

type Errors = Partial<Record<keyof ContactInput | "form", string>>;

export function ContactForm({ responsePromise }: { responsePromise: string }) {
  const [values, setValues] = React.useState({
    name: "", email: "", phone: "", company: "", subject: "", message: "",
  });
  const [website, setWebsite] = React.useState("");
  const [errors, setErrors] = React.useState<Errors>({});
  const [state, setState] = React.useState<"idle" | "sending" | "sent">("idle");
  const startedAt = React.useRef(Date.now());

  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((v) => ({ ...v, [k]: e.currentTarget.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    const parsed = contactSchema.safeParse({ ...values, website, startedAt: startedAt.current });
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof ContactInput;
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }

    setState("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json?.error?.fields) {
          const next: Errors = {};
          for (const [k, msgs] of Object.entries(json.error.fields as Record<string, string[]>)) {
            next[k as keyof ContactInput] = msgs[0];
          }
          setErrors(next);
        } else {
          setErrors({ form: json?.error?.message ?? "Something went wrong. Please try again." });
        }
        setState("idle");
        return;
      }
      setState("sent");
    } catch {
      setErrors({ form: "We could not reach the server. Check your connection and try again." });
      setState("idle");
    }
  }

  if (state === "sent") {
    return (
      <div className="rounded-xl border border-success/30 bg-success/8 p-8 text-center" role="status">
        <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-success/15 text-success">
          <Check className="size-6" aria-hidden />
        </span>
        <h2 className="text-h3 mb-2 text-fg">Message received</h2>
        <p className="mx-auto max-w-sm text-body-sm text-fg-muted">{responsePromise}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <FieldRow label="Your name" htmlFor="c-name" required error={errors.name}>
          <Input id="c-name" name="name" autoComplete="name" value={values.name} onChange={set("name")} required />
        </FieldRow>
        <FieldRow label="Work email" htmlFor="c-email" required error={errors.email}>
          <Input id="c-email" name="email" type="email" autoComplete="email" value={values.email} onChange={set("email")} required />
        </FieldRow>
        <FieldRow label="Phone" htmlFor="c-phone" optionalLabel error={errors.phone}>
          <Input id="c-phone" name="phone" type="tel" autoComplete="tel" value={values.phone} onChange={set("phone")} />
        </FieldRow>
        <FieldRow label="Company" htmlFor="c-company" optionalLabel error={errors.company}>
          <Input id="c-company" name="company" autoComplete="organization" value={values.company} onChange={set("company")} />
        </FieldRow>
      </div>

      <FieldRow label="Subject" htmlFor="c-subject" optionalLabel error={errors.subject}>
        <Input id="c-subject" name="subject" value={values.subject} onChange={set("subject")} />
      </FieldRow>

      <FieldRow
        label="How can we help?"
        htmlFor="c-message"
        required
        help="If it has a scope — a board, a timeline, a volume — the quote form will get you a better answer."
        error={errors.message}
      >
        <Textarea id="c-message" name="message" rows={6} value={values.message} onChange={set("message")} required />
      </FieldRow>

      <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="c-website">Leave this field empty</label>
        <input id="c-website" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.currentTarget.value)} />
      </div>

      {errors.form && (
        <p role="alert" className="rounded-lg border border-danger/30 bg-danger/8 px-4 py-3 text-body-sm text-danger">
          {errors.form}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" size="lg" icon={ArrowRight} loading={state === "sending"}>
          Send message
        </Button>
        <p className="text-body-sm text-fg-subtle">{responsePromise}</p>
      </div>
    </form>
  );
}
