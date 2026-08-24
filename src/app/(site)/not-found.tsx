import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/primitives/Container";
import { Button } from "@/components/primitives/Button";
import { getServiceSummaries } from "@/lib/queries";
import { ServiceCard } from "@/components/content/Cards";

export default async function NotFound() {
  const services = await getServiceSummaries();

  return (
    <div className="bg-bg pt-[72px]">
      <Container>
        <div className="py-20 lg:py-28">
          <p className="text-label mb-4 text-brand">Error 404</p>
          <h1 className="text-display-2 max-w-[16ch] text-fg">
            That page is an open circuit.
          </h1>
          <p className="mt-6 max-w-[52ch] text-body-lg text-fg-muted">
            The link is broken or the page has moved. Nothing here is lost — try one of the routes
            below, or tell us what you were looking for.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" icon={ArrowRight}>
              <Link href="/">Back to the homepage</Link>
            </Button>
            <Button asChild size="lg" variant="secondary" icon={ArrowRight}>
              <Link href="/contact">Tell us what broke</Link>
            </Button>
          </div>

          <h2 className="text-label mb-6 mt-16 text-fg-subtle">Popular routes</h2>
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {services.slice(0, 3).map((s) => (
              <li key={s.slug}>
                <ServiceCard service={s} compact />
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </div>
  );
}
