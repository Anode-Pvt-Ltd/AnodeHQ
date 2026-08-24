"use client";

import * as React from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { Container } from "@/components/primitives/Container";
import { Button } from "@/components/primitives/Button";

export default function SiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("[site] unhandled error", error);
  }, [error]);

  return (
    <div className="bg-bg pt-[72px]">
      <Container>
        <div className="py-20 lg:py-28">
          <p className="text-label mb-4 text-danger">Something went wrong</p>
          <h1 className="text-display-2 max-w-[16ch] text-fg">
            That did not load as it should.
          </h1>
          <p className="mt-6 max-w-[52ch] text-body-lg text-fg-muted">
            The fault is at our end, not yours. Try again — and if it keeps happening, tell us and
            we will fix it.
          </p>
          {error.digest && (
            <p className="mt-4 font-mono text-[0.75rem] text-fg-subtle">Reference: {error.digest}</p>
          )}
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" icon={RefreshCw} iconPosition="start" onClick={reset}>
              Try again
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/contact">Report it</Link>
            </Button>
          </div>
        </div>
      </Container>
    </div>
  );
}
