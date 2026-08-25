import { requireRole } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { SettingsEditor } from "@/components/admin/SettingsEditor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

/** What each settings key controls on the public site — spec §12.1. */
export const SETTING_HELP: Record<string, string> = {
  "hero.eyebrow": "Homepage — the small teal caps line above the headline.",
  "hero.headline_lines": "Homepage — one display line each. Max three.",
  "hero.accent_word": "Homepage — the word inside the last line rendered in brand teal.",
  "hero.subcopy": "Homepage — the paragraph under the headline. Target 140–180 characters.",
  "hero.cta_primary": "Homepage — the filled teal button. { label, href }",
  "hero.cta_secondary": "Homepage — the ghost link with the arrow. { label, href }",
  "hero.proof_caption": "Homepage — the line beside the projects-delivered stat.",
  "copy.process_heading": "Homepage and /process — the two-line heading on the teal panel.",
  "copy.section_headings": "Homepage — eyebrow, heading and intro for each band.",
  "copy.cta_band": "Every page — the closing call-to-action band.",
  "copy.differentiators": "Homepage Why band and /why-anode — icon, title, claim, evidence.",
  "copy.comparison": "/why-anode — the in-house vs freelance vs Anode table.",
  "contact.company_name": "Footer, JSON-LD Organization name, email templates.",
  "contact.legal_name": "Footer copyright line and the legal pages.",
  "contact.email": "/contact, the footer and JSON-LD ContactPoint.",
  "contact.sales_email": "Not rendered — the destination for quote alerts.",
  "contact.phone": "/contact and the footer.",
  "contact.address_lines": "/contact, the footer and JSON-LD PostalAddress.",
  "contact.hours": "/contact — the opening hours block.",
  "contact.response_promise": "/contact, /quote, /quote/sent, the footer and the sticky mobile bar.",
  "contact.geo": "/contact — the static map marker. { lat, lng, zoom }",
  "social.links": "Footer icon row and JSON-LD sameAs.",
  "seo.title_template": "Every page — the %s | Anode pattern.",
  "seo.default_title": "The homepage title and the fallback everywhere else.",
  "seo.description": "Fallback meta description where a record has none.",
  "seo.timezone": "Every rendered date across the site and the admin.",
  "features.flags": "Kill switches: pcb_3d, newsletter, search, insights.",
};

export default async function SettingsPage() {
  await requireRole("admin");
  const service = createServiceClient();

  let rows: Record<string, unknown>[] = [];
  if (service) {
    const { data } = await service
      .from("site_settings").select("key, value, group_name").order("key");
    rows = (data ?? []) as Record<string, unknown>[];
  }

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-7">
        <h1 className="text-h2 text-fg">Site settings</h1>
        <p className="mt-1.5 max-w-2xl text-body-sm text-fg-muted">
          Everything on the public site that is not a content record. Each entry names the surface it
          controls; a change here purges the whole site cache, because the header and footer appear
          on every page.
        </p>
      </header>

      <SettingsEditor
        settings={rows.map((r) => ({
          key: String(r.key),
          value: r.value,
          group: String(r.group_name),
          help: SETTING_HELP[String(r.key)] ?? "",
        }))}
        databaseReady={Boolean(service)}
      />
    </div>
  );
}
