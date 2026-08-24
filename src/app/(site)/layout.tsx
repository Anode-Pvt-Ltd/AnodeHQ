import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { StickyQuoteBar } from "@/components/layout/StickyQuoteBar";
import { getCertifications, getNavigation, getSettings } from "@/lib/queries";
import { absoluteUrl } from "@/lib/utils";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [settings, nav, certifications] = await Promise.all([
    getSettings(), getNavigation(), getCertifications(),
  ]);

  const org = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: settings.contact.companyName,
    legalName: settings.contact.legalName,
    url: absoluteUrl("/"),
    logo: absoluteUrl("/brand/icon-512.png"),
    description: settings.seo.description,
    email: settings.contact.email,
    telephone: settings.contact.phone,
    address: {
      "@type": "PostalAddress",
      streetAddress: settings.contact.addressLines.slice(0, 2).join(", "),
      addressLocality: settings.contact.addressLines[2] ?? "",
      addressCountry: settings.contact.addressLines.at(-1) ?? "",
    },
    sameAs: settings.social.map((s) => s.href),
    contactPoint: [{
      "@type": "ContactPoint",
      contactType: "sales",
      email: settings.contact.salesEmail,
      telephone: settings.contact.phone,
      availableLanguage: ["English"],
    }],
  };

  const site = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Anode",
    url: absoluteUrl("/"),
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: absoluteUrl("/search?q={search_term_string}") },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <>
      <SiteHeader items={nav.header} />
      <main id="main">{children}</main>
      <SiteFooter settings={settings} items={nav.footer} certifications={certifications} />
      <StickyQuoteBar responsePromise={settings.contact.responsePromise} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(org) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(site) }} />
    </>
  );
}
