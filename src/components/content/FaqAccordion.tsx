import { Plus } from "lucide-react";
import { absoluteUrl } from "@/lib/utils";
import type { Faq } from "@/types/app";

/**
 * Native <details> — keyboard accessible and open-by-default-free without JS.
 * Emits FAQPage JSON-LD from the same rows, and only when there are two or more.
 */
export function FaqAccordion({ faqs, heading = "Common questions" }: { faqs: Faq[]; heading?: string }) {
  if (!faqs.length) return null;

  const jsonLd =
    faqs.length >= 2
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          url: absoluteUrl("/"),
          mainEntity: faqs.map((f) => ({
            "@type": "Question",
            name: f.question,
            acceptedAnswer: { "@type": "Answer", text: f.answer },
          })),
        }
      : null;

  return (
    <div>
      <h2 className="text-h2 mb-8 max-w-[16ch] text-fg">{heading}</h2>
      <ul className="divide-y divide-border border-y border-border">
        {faqs.map((f) => (
          <li key={f.id}>
            <details className="group">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-5 text-left [&::-webkit-details-marker]:hidden">
                <span className="text-h4 text-fg transition-colors group-hover:text-brand">{f.question}</span>
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-border text-fg-muted transition-transform duration-[var(--dur-base)] group-open:rotate-45 group-open:border-brand group-open:text-brand">
                  <Plus className="size-4" aria-hidden />
                </span>
              </summary>
              <p className="measure pb-6 text-body-lg text-fg-muted">{f.answer}</p>
            </details>
          </li>
        ))}
      </ul>
      {jsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      )}
    </div>
  );
}
