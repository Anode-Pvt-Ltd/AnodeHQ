import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSettings } from "@/lib/queries";
import { Container } from "@/components/primitives/Container";
import { Section } from "@/components/primitives/Section";
import { Prose } from "@/components/primitives/Prose";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { formatDate } from "@/lib/utils";

export const revalidate = 3600;
export const dynamicParams = false;

const UPDATED = "2026-06-01T00:00:00.000Z";

const PAGES: Record<string, { title: string; description: string; body: string }> = {
  privacy: {
    title: "Privacy Policy",
    description: "How Anode collects, uses and stores the personal data you provide through this website.",
    body: `
<h3>Who we are</h3>
<p>Anode Electronics Ltd is the data controller for personal data collected through this website. You can reach us at the address in the footer or by email.</p>
<h3>What we collect, and why</h3>
<p>We collect only what a reply needs. Through the quote form: your name, email address, and optionally phone, company and country, together with the project details and any files you attach. Through the contact form: name, email and your message. Through the newsletter: your email address only.</p>
<p>We also record which page you arrived from and any campaign parameters in the URL, so we know which of our work is useful. We store a one-way hash of your IP address to enforce rate limits — never the address itself.</p>
<h3>Legal basis</h3>
<p>For enquiry and quote forms, processing is necessary to take steps at your request before entering into a contract. For the newsletter, the basis is your consent, given by confirming the double opt-in email, and you can withdraw it at any time using the unsubscribe link in every message.</p>
<h3>Files you send us</h3>
<p>Attachments are stored in a private bucket with no public access. They are readable only by our staff with a commercial role, through short-lived signed links, and every access is logged. We do not share them with anyone outside Anode.</p>
<h3>How long we keep it</h3>
<p>Quote and enquiry records are kept for three years from the last contact, so we can pick up a conversation you return to. Newsletter subscriptions are kept until you unsubscribe. Unconfirmed newsletter sign-ups are deleted after seven days.</p>
<h3>Who else sees it</h3>
<p>Our hosting and database providers process data on our behalf under contract. We do not sell personal data, and we do not share it for advertising. Analytics on this site are aggregated and do not identify individuals.</p>
<h3>Cookies</h3>
<p>This site sets no advertising or tracking cookies. See the cookie policy for the small number of functional items we do store.</p>
<h3>Your rights</h3>
<p>You may request access to, correction of, or deletion of your personal data, and you may object to processing or request that we restrict it. Email us and we will respond within thirty days. If you are not satisfied, you may complain to your data protection authority.</p>
<h3>Changes</h3>
<p>If this policy changes materially we will note the date below and, where the change affects an active enquiry, tell you directly.</p>`,
  },
  terms: {
    title: "Terms of Service",
    description: "The terms on which this website is provided, and how engagement terms are agreed.",
    body: `
<h3>About these terms</h3>
<p>These terms govern your use of this website. They do not govern engineering work — that is covered by a separate written agreement signed before a project starts.</p>
<h3>Using this site</h3>
<p>You may read, print and share the content here for your own evaluation purposes. Case studies, technical write-ups and images remain our property or that of our clients; please do not republish them without asking.</p>
<h3>Accuracy</h3>
<p>We write our technical content carefully, and it reflects how we work at the time of publication. It is general information, not engineering advice for your specific product, and applying it without review is at your own risk.</p>
<h3>Enquiries are not offers</h3>
<p>Submitting a quote request does not create a contract. Any proposal we send is an invitation to agree terms, and work begins only once a scope, price and schedule are signed by both sides.</p>
<h3>Intellectual property in projects</h3>
<p>Under our standard engagement terms, intellectual property created specifically for your project transfers to you on payment, and you receive the source files. Pre-existing tools, libraries and methods that we bring to the work remain ours, licensed to you for use in the delivered product.</p>
<h3>Confidentiality</h3>
<p>We sign your NDA before technical discussion. A substantial share of our work is confidential and never appears in a case study, on this site, or in any pitch.</p>
<h3>Liability</h3>
<p>Nothing here limits liability for death or personal injury caused by negligence, for fraud, or for anything else that cannot lawfully be limited. Subject to that, we exclude liability for indirect or consequential loss arising from use of this website.</p>
<h3>Governing law</h3>
<p>These terms are governed by the laws of England and Wales, and the courts of England and Wales have exclusive jurisdiction.</p>`,
  },
  cookies: {
    title: "Cookie Policy",
    description: "The small number of functional items this website stores in your browser, and why.",
    body: `
<h3>The short version</h3>
<p>This site sets no advertising cookies, no third-party tracking cookies, and no cross-site identifiers. There is no consent banner because there is nothing to consent to.</p>
<h3>What we do store</h3>
<p><strong>Theme preference.</strong> If you choose light or dark using the control in the header, that choice is saved in your browser's local storage so the site does not flash the wrong theme on your next visit. It never leaves your device.</p>
<p><strong>Quote form progress.</strong> While you are filling in the quote form, your answers are held in session storage so a refresh or an accidental back button does not lose them. They are cleared as soon as you submit, and they are gone when you close the tab.</p>
<p><strong>Analytics.</strong> We measure aggregate page performance and traffic. This is configured without cookies and without identifying individual visitors.</p>
<h3>Things we deliberately avoid</h3>
<p>No embedded map scripts, no social widgets, no advertising pixels, no session replay. Where a page needs a map, we render a static one rather than loading a third-party frame that would track you.</p>
<h3>Clearing what is stored</h3>
<p>Clearing site data in your browser removes everything above. The site will keep working — you will simply be back on the system theme.</p>`,
  },
};

export async function generateStaticParams() {
  return Object.keys(PAGES).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const page = PAGES[(await params).slug];
  if (!page) return {};
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: `/legal/${(await params).slug}` },
  };
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = PAGES[slug];
  if (!page) notFound();

  const settings = await getSettings();

  return (
    <>
      <div className="bg-bg-subtle pt-[72px]">
        <Container>
          <div className="py-14">
            <Breadcrumbs items={[{ label: page.title, href: `/legal/${slug}` }]} />
            <h1 className="text-display-2 text-fg">{page.title}</h1>
            <p className="mt-4 text-body-sm text-fg-subtle">
              Last updated {formatDate(UPDATED, settings.seo.timezone)}
            </p>
          </div>
        </Container>
      </div>
      <Section>
        <Prose html={page.body} />
        <p className="measure mt-10 border-t border-border pt-6 text-body-sm text-fg-muted">
          Questions about this policy?{" "}
          <a href={`mailto:${settings.contact.email}`} className="font-medium text-accent underline underline-offset-4">
            {settings.contact.email}
          </a>
        </p>
      </Section>
    </>
  );
}
