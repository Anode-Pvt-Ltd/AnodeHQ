import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, CircleAlert } from "lucide-react";
import { Container } from "@/components/primitives/Container";
import { Button } from "@/components/primitives/Button";

export const metadata: Metadata = {
  title: "Subscription",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const okay = status !== "invalid";

  return (
    <div className="bg-bg pt-[72px]">
      <Container>
        <div className="py-24 text-center lg:py-32">
          <span
            className={
              okay
                ? "mx-auto mb-6 flex size-14 items-center justify-center rounded-full bg-success/12 text-success"
                : "mx-auto mb-6 flex size-14 items-center justify-center rounded-full bg-warning/12 text-warning"
            }
          >
            {okay ? <Check className="size-7" aria-hidden /> : <CircleAlert className="size-7" aria-hidden />}
          </span>
          <h1 className="text-display-2 mx-auto max-w-[18ch] text-fg">
            {okay ? "You are subscribed." : "That link has expired."}
          </h1>
          <p className="mx-auto mt-5 max-w-[46ch] text-body-lg text-fg-muted">
            {okay
              ? "Roughly one engineering write-up a month. Unsubscribe from any message in one click."
              : "Confirmation links are valid for seven days. Sign up again from the footer and we will send a fresh one."}
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" icon={ArrowRight}>
              <Link href="/insights">Read the latest</Link>
            </Button>
            <Button asChild size="lg" variant="secondary" icon={ArrowRight}>
              <Link href="/">Back to the homepage</Link>
            </Button>
          </div>
        </div>
      </Container>
    </div>
  );
}
