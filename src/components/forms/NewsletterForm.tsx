"use client";

import * as React from "react";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/primitives/Button";
import { Input } from "@/components/primitives/Field";
import { newsletterSchema } from "@/lib/schemas";

export function NewsletterForm({ source = "footer" }: { source?: string }) {
  const [email, setEmail] = React.useState("");
  const [website, setWebsite] = React.useState(""); // honeypot
  const [state, setState] = React.useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = React.useState<string | null>(null);
  const id = React.useId();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    const parsed = newsletterSchema.safeParse({ email, source, website });
    if (!parsed.success) {
      setState("error");
      setMessage(parsed.error.issues[0]?.message ?? "Check the address and try again.");
      return;
    }

    setState("sending");
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Something went wrong.");
      setState("done");
      setMessage("Check your inbox — we've sent a confirmation link.");
    } catch (err) {
      setState("error");
      setMessage(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }

  if (state === "done") {
    return (
      <p className="flex items-start gap-2 text-body-sm text-success" role="status">
        <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
        {message}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-2">
      <div className="flex gap-2">
        <label htmlFor={id} className="sr-only">Email address</label>
        <Input
          id={id}
          type="email"
          name="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
          aria-invalid={state === "error" || undefined}
          className="min-w-0 flex-1"
          required
        />
        <Button type="submit" size="md" icon={ArrowRight} loading={state === "sending"} aria-label="Subscribe">
          <span className="sr-only sm:not-sr-only">Join</span>
        </Button>
      </div>

      {/* honeypot — visually and programmatically hidden from people */}
      <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor={`${id}-website`}>Leave this field empty</label>
        <input
          id={`${id}-website`} name="website" type="text" tabIndex={-1} autoComplete="off"
          value={website} onChange={(e) => setWebsite(e.currentTarget.value)}
        />
      </div>

      {message && state === "error" && (
        <p role="alert" className="text-[0.8125rem] text-danger">{message}</p>
      )}
      <p className="text-[0.75rem] leading-snug text-fg-subtle">
        Occasional engineering write-ups. No sales email, unsubscribe in one click.
      </p>
    </form>
  );
}
