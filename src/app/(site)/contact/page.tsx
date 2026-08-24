import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock, Mail, MapPin, Phone } from "lucide-react";
import { getSettings } from "@/lib/queries";
import { Container } from "@/components/primitives/Container";
import { Section } from "@/components/primitives/Section";
import { ContactForm } from "@/components/forms/ContactForm";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Talk to an engineer at Anode. Email, phone or the form — every message gets a reply within one business day.",
  alternates: { canonical: "/contact" },
};

export const revalidate = 3600;

export default async function ContactPage() {
  const settings = await getSettings();
  const { contact } = settings;

  return (
    <>
      <div className="bg-bg-subtle pt-[72px]">
        <Container>
          <div className="py-14 lg:py-16">
            <p className="text-label mb-4 text-brand">Contact</p>
            <h1 className="text-display-2 max-w-[15ch] text-fg">Talk to an engineer.</h1>
            <p className="mt-5 max-w-[54ch] text-body-lg text-fg-muted">
              For anything with a defined scope, the{" "}
              <Link href="/quote" className="font-medium text-accent underline underline-offset-4">
                quote form
              </Link>{" "}
              will get you a better answer faster. For everything else, this reaches us directly.
            </p>
          </div>
        </Container>
      </div>

      <Section>
        <div className="grid gap-12 lg:grid-cols-[1.3fr_1fr] lg:gap-16">
          <ContactForm responsePromise={contact.responsePromise} />

          <aside className="flex flex-col gap-8">
            <div>
              <h2 className="text-label mb-4 text-fg-subtle">Direct</h2>
              <ul className="flex flex-col gap-4">
                <li className="flex items-start gap-3">
                  <Mail className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
                  <a href={`mailto:${contact.email}`} className="text-body-sm text-fg transition-colors hover:text-brand">
                    {contact.email}
                  </a>
                </li>
                <li className="flex items-start gap-3">
                  <Phone className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
                  <a
                    href={`tel:${contact.phone.replace(/\s/g, "")}`}
                    className="text-body-sm text-fg transition-colors hover:text-brand"
                  >
                    {contact.phone}
                  </a>
                </li>
                <li className="flex items-start gap-3">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
                  <address className="not-italic text-body-sm text-fg-muted">
                    {contact.addressLines.map((l) => (
                      <span key={l} className="block">{l}</span>
                    ))}
                  </address>
                </li>
              </ul>
            </div>

            <div>
              <h2 className="text-label mb-4 text-fg-subtle">Opening hours</h2>
              <dl className="flex flex-col gap-2">
                {contact.hours.map((h) => (
                  <div key={h.day} className="flex justify-between gap-4 text-body-sm">
                    <dt className="text-fg-muted">{h.day}</dt>
                    <dd className="tabular text-fg">{h.hours}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 flex items-start gap-2 text-body-sm text-fg-subtle">
                <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
                {contact.responsePromise}
              </p>
            </div>

            {/* Static map — no third-party script, so nothing tracks the visitor */}
            <div>
              <h2 className="text-label mb-4 text-fg-subtle">Where we are</h2>
              <div
                className="trace-pattern relative aspect-[4/3] overflow-hidden rounded-xl border border-border bg-bg-subtle text-fg-subtle"
                role="img"
                aria-label={`Map showing Anode at ${contact.addressLines.join(", ")}`}
              >
                <span className="absolute left-1/2 top-1/2 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-brand text-on-brand shadow-md">
                  <MapPin className="size-5" aria-hidden />
                </span>
                <span className="tabular absolute bottom-3 left-3 rounded-md bg-surface/90 px-2 py-1 font-mono text-[0.6875rem] text-fg-muted backdrop-blur">
                  {contact.geo.lat.toFixed(4)}, {contact.geo.lng.toFixed(4)}
                </span>
              </div>
              <a
                href={`https://www.openstreetmap.org/?mlat=${contact.geo.lat}&mlon=${contact.geo.lng}#map=${contact.geo.zoom}/${contact.geo.lat}/${contact.geo.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-body-sm font-medium text-accent hover:underline"
              >
                Open in maps <ArrowRight className="size-3.5" aria-hidden />
              </a>
            </div>
          </aside>
        </div>
      </Section>
    </>
  );
}
