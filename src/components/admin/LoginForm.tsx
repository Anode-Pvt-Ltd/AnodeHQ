"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/primitives/Button";
import { FieldRow, Input } from "@/components/primitives/Field";
import { getBrowserClient } from "@/lib/supabase/browser";

export function LoginForm({ nextPath, configured }: { nextPath: string; configured: boolean }) {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  if (!configured) {
    return (
      <p className="text-body-sm text-fg-muted">
        Supabase is not configured yet, so there is nothing to sign in to. Add the environment
        variables and apply the migrations first — the admin home page lists the steps.
      </p>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const sb = getBrowserClient();
    if (!sb) {
      setError("Authentication is not configured.");
      setBusy(false);
      return;
    }

    const { error: signInError } = await sb.auth.signInWithPassword({ email, password });
    if (signInError) {
      // Deliberately generic: never reveal whether an address has an account.
      setError("That email and password combination was not recognised.");
      setBusy(false);
      return;
    }

    router.replace(nextPath);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FieldRow label="Email" htmlFor="login-email" required>
        <Input
          id="login-email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
          required
          autoFocus
        />
      </FieldRow>

      <FieldRow label="Password" htmlFor="login-password" required>
        <Input
          id="login-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.currentTarget.value)}
          required
        />
      </FieldRow>

      {error && (
        <p role="alert" className="rounded-lg border border-danger/30 bg-danger/8 px-3.5 py-2.5 text-body-sm text-danger">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" fullWidth icon={ArrowRight} loading={busy}>
        Sign in
      </Button>
    </form>
  );
}
