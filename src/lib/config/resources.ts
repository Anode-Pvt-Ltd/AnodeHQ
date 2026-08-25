import type { AppRole } from "@/types/app";

/**
 * Resource registry — spec §11.2/§11.3.
 *
 * Adding a content type is a config entry, not a new screen: the generic list
 * and edit views in /admin/[resource] are driven entirely by this file.
 */

export type WidgetKind =
  | "text" | "slug" | "textarea" | "richText" | "number" | "toggle"
  | "select" | "multiSelect" | "relation" | "media" | "iconPicker"
  | "date" | "datetime" | "tags" | "json" | "readonly";

export interface FieldConfig {
  key: string;
  label: string;
  widget: WidgetKind;
  required?: boolean;
  help?: string;
  /** Where this field appears on the public site — surfaced in the editor. */
  controls?: string;
  maxLength?: number;
  options?: { value: string; label: string }[];
  /** For relation/multiSelect: the table to read choices from. */
  source?: string;
  rows?: number;
}

export interface ColumnConfig {
  key: string;
  header: string;
  render?: "text" | "statusPill" | "relativeTime" | "boolean" | "number";
  primary?: boolean;
}

export interface ResourceConfig {
  key: string;
  table: string;
  label: { singular: string; plural: string };
  description: string;
  minRole: AppRole;
  group: "Content" | "Proof" | "Assets" | "Site" | "Inbox" | "Admin";
  icon: string;
  hasStatus: boolean;
  hasSlug: boolean;
  /**
   * Base path for "view on the site", e.g. "/projects" -> /projects/{slug}.
   *
   * MUST stay a plain string. This config is handed to client components
   * (ResourceTable, EntityForm), and functions cannot cross the server/client
   * boundary — React throws "Functions cannot be passed directly to Client
   * Components". A prefix plus the row's slug carries the same information
   * and serialises cleanly.
   */
  previewBase?: string;
  defaultSort: { key: string; dir: "asc" | "desc" };
  columns: ColumnConfig[];
  groups: { label: string; fields: string[] }[];
  fields: FieldConfig[];
}

const SEO_FIELDS: FieldConfig[] = [
  { key: "seo_title", label: "SEO title", widget: "text", maxLength: 60,
    controls: "The <title> tag and the social card heading. Falls back to the title." },
  { key: "seo_description", label: "SEO description", widget: "textarea", maxLength: 160, rows: 3,
    controls: "The meta description and social card body. Falls back to the summary." },
];

const PUBLISH_FIELDS: FieldConfig[] = [
  { key: "status", label: "Status", widget: "select", required: true,
    options: [
      { value: "draft", label: "Draft" },
      { value: "scheduled", label: "Scheduled" },
      { value: "published", label: "Published" },
      { value: "archived", label: "Archived" },
    ],
    controls: "Draft and scheduled are invisible to the public. Archiving 301s the URL to its index." },
  { key: "published_at", label: "Publish at", widget: "datetime",
    help: "A future time schedules the page; the hourly job publishes it and purges the cache." },
];

export const RESOURCES: ResourceConfig[] = [
  {
    key: "projects",
    table: "projects",
    label: { singular: "Case study", plural: "Case studies" },
    description: "The work. Each one states a constraint, an approach and a measured outcome.",
    minRole: "editor",
    group: "Content",
    icon: "box",
    hasStatus: true,
    hasSlug: true,
    previewBase: "/projects",
    defaultSort: { key: "order_index", dir: "asc" },
    columns: [
      { key: "title", header: "Title", primary: true },
      { key: "client_name", header: "Client" },
      { key: "year", header: "Year", render: "number" },
      { key: "featured", header: "Featured", render: "boolean" },
      { key: "status", header: "Status", render: "statusPill" },
      { key: "updated_at", header: "Updated", render: "relativeTime" },
    ],
    groups: [
      { label: "Identity", fields: ["title", "slug", "client_name", "is_confidential"] },
      { label: "Placement", fields: ["industry_id", "year", "duration_weeks", "featured", "order_index"] },
      { label: "Story", fields: ["summary", "challenge", "approach", "outcome", "body_html"] },
      { label: "Evidence", fields: ["board_spec"] },
      { label: "SEO", fields: ["seo_title", "seo_description"] },
      { label: "Publish", fields: ["status", "published_at"] },
    ],
    fields: [
      { key: "title", label: "Title", widget: "text", required: true,
        controls: "Card heading on the homepage carousel and /projects, the H1 on the case study, and the prev/next control." },
      { key: "slug", label: "URL slug", widget: "slug", required: true,
        controls: "/projects/{slug}. Changing it after publish writes a 301 automatically." },
      { key: "client_name", label: "Client name", widget: "text",
        controls: "The fact strip on the detail page. Hidden entirely when Confidential is on." },
      { key: "is_confidential", label: "Confidential", widget: "toggle",
        controls: "Replaces the client name with “Confidential client” everywhere and suppresses the logo link." },
      { key: "industry_id", label: "Industry", widget: "relation", source: "industries",
        controls: "Card meta line, fact strip, the ?industry= filter, and this project's appearance on the industry page." },
      { key: "year", label: "Year", widget: "number",
        controls: "Fact strip, card meta and the year filter." },
      { key: "duration_weeks", label: "Duration (weeks)", widget: "number",
        controls: "Fact strip — rendered as “14 weeks”." },
      { key: "featured", label: "Featured", widget: "toggle",
        controls: "Includes the project in the homepage carousel. Four to eight is the design target." },
      { key: "order_index", label: "Order", widget: "number",
        controls: "Position in the featured carousel and the /projects grid." },
      { key: "summary", label: "Summary", widget: "textarea", required: true, maxLength: 300, rows: 3,
        controls: "Card body, detail intro and the meta description fallback." },
      { key: "challenge", label: "The challenge", widget: "textarea", rows: 5,
        controls: "First of the three story blocks. Renders only if filled." },
      { key: "approach", label: "Our approach", widget: "textarea", rows: 5,
        controls: "Second story block." },
      { key: "outcome", label: "The outcome", widget: "textarea", rows: 5,
        controls: "Third story block." },
      { key: "body_html", label: "Body", widget: "richText", rows: 12,
        controls: "Optional long-form section after the story blocks." },
      { key: "board_spec", label: "Board specification", widget: "json",
        help: "layers, sizeMm, componentCount, ipcClass, stackup",
        controls: "The technical column of the fact strip." },
      ...SEO_FIELDS,
      ...PUBLISH_FIELDS,
    ],
  },
  {
    key: "services",
    table: "services",
    label: { singular: "Service", plural: "Services" },
    description: "Six capability pages. Also the taxonomy used by projects and the quote form.",
    minRole: "editor",
    group: "Content",
    icon: "cpu",
    hasStatus: true,
    hasSlug: true,
    previewBase: "/services",
    defaultSort: { key: "order_index", dir: "asc" },
    columns: [
      { key: "title", header: "Title", primary: true },
      { key: "order_index", header: "Order", render: "number" },
      { key: "status", header: "Status", render: "statusPill" },
      { key: "updated_at", header: "Updated", render: "relativeTime" },
    ],
    groups: [
      { label: "Identity", fields: ["title", "slug", "tagline", "icon"] },
      { label: "Content", fields: ["summary", "body_html", "deliverables"] },
      { label: "Placement", fields: ["order_index"] },
      { label: "SEO", fields: ["seo_title", "seo_description"] },
      { label: "Publish", fields: ["status", "published_at"] },
    ],
    fields: [
      { key: "title", label: "Title", widget: "text", required: true,
        controls: "Homepage service card, /services grid, the H1, the header mega panel, project card tag lines and the quote wizard checkbox." },
      { key: "slug", label: "URL slug", widget: "slug", required: true, controls: "/services/{slug}" },
      { key: "tagline", label: "Tagline", widget: "text",
        controls: "The line directly under the H1 on the service page." },
      { key: "icon", label: "Icon", widget: "iconPicker", required: true,
        controls: "Card glyph on the homepage, /services, the mega panel and industry pages." },
      { key: "summary", label: "Card summary", widget: "textarea", required: true, maxLength: 120, rows: 2,
        controls: "Card body on the homepage and /services, plus the mega panel description. Hard limit 120 — the homepage row is fixed height." },
      { key: "body_html", label: "Body", widget: "richText", rows: 12,
        controls: "The main article region between the deliverables list and the tooling block." },
      { key: "deliverables", label: "What you receive", widget: "tags",
        controls: "The checklist panel in the service page hero." },
      { key: "order_index", label: "Order", widget: "number",
        controls: "Card order everywhere. The homepage shows the first five." },
      ...SEO_FIELDS,
      ...PUBLISH_FIELDS,
    ],
  },
  {
    key: "industries",
    table: "industries",
    label: { singular: "Industry", plural: "Industries" },
    description: "Sector pages carrying the compliance context that shapes each design.",
    minRole: "editor",
    group: "Content",
    icon: "factory",
    hasStatus: true,
    hasSlug: true,
    previewBase: "/industries",
    defaultSort: { key: "order_index", dir: "asc" },
    columns: [
      { key: "name", header: "Name", primary: true },
      { key: "order_index", header: "Order", render: "number" },
      { key: "status", header: "Status", render: "statusPill" },
      { key: "updated_at", header: "Updated", render: "relativeTime" },
    ],
    groups: [
      { label: "Identity", fields: ["name", "slug", "icon"] },
      { label: "Content", fields: ["summary", "standards", "body_html"] },
      { label: "Placement", fields: ["order_index"] },
      { label: "SEO", fields: ["seo_title", "seo_description"] },
      { label: "Publish", fields: ["status", "published_at"] },
    ],
    fields: [
      { key: "name", label: "Name", widget: "text", required: true,
        controls: "Homepage industry tile, /industries grid, the H1, project card meta, the project filter and the quote wizard sector select." },
      { key: "slug", label: "URL slug", widget: "slug", required: true,
        controls: "/industries/{slug} and the ?industry= filter value." },
      { key: "icon", label: "Icon", widget: "iconPicker", required: true, controls: "Tile glyph in both grids." },
      { key: "summary", label: "Summary", widget: "textarea", required: true, rows: 3,
        controls: "Tile body on the homepage and /industries; the intro paragraph on the detail page." },
      { key: "standards", label: "Standards", widget: "tags",
        controls: "The compliance chip row — the sector page's main credibility signal." },
      { key: "body_html", label: "Body", widget: "richText", rows: 12, controls: "Sector context article." },
      { key: "order_index", label: "Order", widget: "number",
        controls: "Tile order. The asymmetric homepage grid promotes positions 1 and 2 to double width." },
      ...SEO_FIELDS,
      ...PUBLISH_FIELDS,
    ],
  },
  {
    key: "posts",
    table: "posts",
    label: { singular: "Insight", plural: "Insights" },
    description: "Engineering write-ups. Also feeds the RSS feed and the homepage rail.",
    minRole: "editor",
    group: "Content",
    icon: "file-text",
    hasStatus: true,
    hasSlug: true,
    previewBase: "/insights",
    defaultSort: { key: "published_at", dir: "desc" },
    columns: [
      { key: "title", header: "Title", primary: true },
      { key: "read_minutes", header: "Read", render: "number" },
      { key: "status", header: "Status", render: "statusPill" },
      { key: "published_at", header: "Published", render: "relativeTime" },
    ],
    groups: [
      { label: "Identity", fields: ["title", "slug", "topic_id", "author_id"] },
      { label: "Content", fields: ["excerpt", "body_html"] },
      { label: "SEO", fields: ["seo_title", "seo_description"] },
      { label: "Publish", fields: ["status", "published_at"] },
    ],
    fields: [
      { key: "title", label: "Title", widget: "text", required: true,
        controls: "Homepage insights rail, /insights cards, the article header, the OG card and the RSS item." },
      { key: "slug", label: "URL slug", widget: "slug", required: true, controls: "/insights/{slug}" },
      { key: "topic_id", label: "Topic", widget: "relation", source: "post_topics",
        controls: "The chip on each card, the topic route and the filter." },
      { key: "author_id", label: "Author", widget: "relation", source: "team_members",
        controls: "Byline and the author card at the foot of the article." },
      { key: "excerpt", label: "Excerpt", widget: "textarea", required: true, rows: 3,
        controls: "Card body, article intro, meta description and RSS description." },
      { key: "body_html", label: "Body", widget: "richText", rows: 18,
        controls: "Article content. The table of contents is generated from its H3s and read time is computed on save." },
      ...SEO_FIELDS,
      ...PUBLISH_FIELDS,
    ],
  },
  {
    key: "process_stages",
    table: "process_stages",
    label: { singular: "Process stage", plural: "Process" },
    description: "Discover, Design, Develop, Deliver — and the gate that closes each one.",
    minRole: "editor",
    group: "Content",
    icon: "settings-2",
    hasStatus: true,
    hasSlug: false,
    defaultSort: { key: "step_number", dir: "asc" },
    columns: [
      { key: "step_number", header: "#", render: "number" },
      { key: "title", header: "Stage", primary: true },
      { key: "status", header: "Status", render: "statusPill" },
      { key: "updated_at", header: "Updated", render: "relativeTime" },
    ],
    groups: [
      { label: "Stage", fields: ["step_number", "title", "icon", "short_description"] },
      { label: "Detail", fields: ["detail"] },
      { label: "Publish", fields: ["status"] },
    ],
    fields: [
      { key: "step_number", label: "Step number", widget: "number", required: true,
        controls: "The 01–04 markers on the teal band and the timeline order on /process." },
      { key: "title", label: "Title", widget: "text", required: true,
        controls: "Stage name on the homepage band and /process." },
      { key: "icon", label: "Icon", widget: "iconPicker", required: true, controls: "The circled glyph on the teal band." },
      { key: "short_description", label: "Short description", widget: "textarea", maxLength: 140, rows: 2, required: true,
        controls: "The two-line body under each stage on the homepage band." },
      { key: "detail", label: "Detail", widget: "json",
        help: "inputs[], activities[], outputs[], duration, gate",
        controls: "/process only — the expanded card with inputs, activities, outputs, duration and the review gate." },
      ...PUBLISH_FIELDS.slice(0, 1),
    ],
  },
  {
    key: "testimonials",
    table: "testimonials",
    label: { singular: "Testimonial", plural: "Testimonials" },
    description: "Client quotes, optionally linked to the case study they came from.",
    minRole: "editor",
    group: "Proof",
    icon: "message-square",
    hasStatus: true,
    hasSlug: false,
    defaultSort: { key: "order_index", dir: "asc" },
    columns: [
      { key: "author_name", header: "Author", primary: true },
      { key: "company", header: "Company" },
      { key: "featured", header: "Featured", render: "boolean" },
      { key: "status", header: "Status", render: "statusPill" },
    ],
    groups: [
      { label: "Quote", fields: ["quote"] },
      { label: "Attribution", fields: ["author_name", "author_role", "company"] },
      { label: "Placement", fields: ["project_id", "industry_id", "featured", "order_index"] },
      { label: "Publish", fields: ["status"] },
    ],
    fields: [
      { key: "quote", label: "Quote", widget: "textarea", required: true, rows: 5,
        controls: "The homepage testimonial band, the /why-anode grid and the matching industry page." },
      { key: "author_name", label: "Author", widget: "text", required: true, controls: "Attribution line." },
      { key: "author_role", label: "Role", widget: "text", controls: "Attribution line, after the name." },
      { key: "company", label: "Company", widget: "text", controls: "Attribution line." },
      { key: "project_id", label: "Related project", widget: "relation", source: "projects",
        controls: "Adds a “Read the case study” link, and surfaces the quote on that project's page." },
      { key: "industry_id", label: "Related industry", widget: "relation", source: "industries",
        controls: "Surfaces the quote on that industry page." },
      { key: "featured", label: "Featured", widget: "toggle",
        controls: "Eligible for the single homepage slot." },
      { key: "order_index", label: "Order", widget: "number", controls: "Order in the /why-anode grid." },
      ...PUBLISH_FIELDS.slice(0, 1),
    ],
  },
  {
    key: "clients",
    table: "clients",
    label: { singular: "Client", plural: "Clients" },
    description: "The trusted-by row on the homepage.",
    minRole: "editor",
    group: "Proof",
    icon: "building-2",
    hasStatus: true,
    hasSlug: false,
    defaultSort: { key: "order_index", dir: "asc" },
    columns: [
      { key: "name", header: "Name", primary: true },
      { key: "featured", header: "On homepage", render: "boolean" },
      { key: "order_index", header: "Order", render: "number" },
    ],
    groups: [
      { label: "Client", fields: ["name", "logo_mark", "website_url"] },
      { label: "Placement", fields: ["featured", "order_index"] },
      { label: "Publish", fields: ["status"] },
    ],
    fields: [
      { key: "name", label: "Name", widget: "text", required: true, controls: "Wordmark text in the trusted-by row." },
      { key: "logo_mark", label: "Mark", widget: "iconPicker", controls: "The glyph beside the wordmark." },
      { key: "website_url", label: "Website", widget: "text", controls: "Not currently linked from the row." },
      { key: "featured", label: "Show on homepage", widget: "toggle", controls: "Includes the logo in the homepage row (six slots)." },
      { key: "order_index", label: "Order", widget: "number", controls: "Left-to-right order." },
      ...PUBLISH_FIELDS.slice(0, 1),
    ],
  },
  {
    key: "team_members",
    table: "team_members",
    label: { singular: "Team member", plural: "Team" },
    description: "The people shown on /about/team and credited as article authors.",
    minRole: "editor",
    group: "Proof",
    icon: "users",
    hasStatus: true,
    hasSlug: false,
    defaultSort: { key: "order_index", dir: "asc" },
    columns: [
      { key: "name", header: "Name", primary: true },
      { key: "role", header: "Role" },
      { key: "order_index", header: "Order", render: "number" },
      { key: "status", header: "Status", render: "statusPill" },
    ],
    groups: [
      { label: "Person", fields: ["name", "role", "bio"] },
      { label: "Links", fields: ["linkedin_url", "email"] },
      { label: "Placement", fields: ["order_index"] },
      { label: "Publish", fields: ["status"] },
    ],
    fields: [
      { key: "name", label: "Name", widget: "text", required: true, controls: "Team grid, article bylines and the author card." },
      { key: "role", label: "Role", widget: "text", required: true, controls: "The mono line under the name." },
      { key: "bio", label: "Bio", widget: "textarea", rows: 4, controls: "Team card body and the article author card." },
      { key: "linkedin_url", label: "LinkedIn", widget: "text", controls: "The link on the team card. Omitted renders no link." },
      { key: "email", label: "Email", widget: "text", help: "Internal only — never rendered publicly." },
      { key: "order_index", label: "Order", widget: "number", controls: "Position in the team grid; the first four become the hero proof avatars." },
      ...PUBLISH_FIELDS.slice(0, 1),
    ],
  },
  {
    key: "certifications",
    table: "certifications",
    label: { singular: "Certification", plural: "Certifications" },
    description: "Accreditation marks in the footer, /about and /why-anode.",
    minRole: "editor",
    group: "Proof",
    icon: "badge-check",
    hasStatus: true,
    hasSlug: false,
    defaultSort: { key: "order_index", dir: "asc" },
    columns: [
      { key: "name", header: "Name", primary: true },
      { key: "issuer", header: "Issuer" },
      { key: "valid_until", header: "Valid until" },
    ],
    groups: [
      { label: "Certification", fields: ["name", "issuer", "description", "valid_until"] },
      { label: "Placement", fields: ["order_index"] },
      { label: "Publish", fields: ["status"] },
    ],
    fields: [
      { key: "name", label: "Name", widget: "text", required: true, controls: "Footer mark row, /about and /why-anode." },
      { key: "issuer", label: "Issuer", widget: "text", required: true, controls: "The mono line under the name on /about." },
      { key: "description", label: "Description", widget: "textarea", rows: 3, controls: "Card body on /about; the footer tooltip." },
      { key: "valid_until", label: "Valid until", widget: "date",
        help: "An expired date greys the mark in this list but does not hide it publicly." },
      { key: "order_index", label: "Order", widget: "number", controls: "Display order." },
      ...PUBLISH_FIELDS.slice(0, 1),
    ],
  },
  {
    key: "stats",
    table: "stats",
    label: { singular: "Stat", plural: "Stats" },
    description: "The large numbers on the homepage, /about and /why-anode.",
    minRole: "editor",
    group: "Proof",
    icon: "line-chart",
    hasStatus: true,
    hasSlug: false,
    defaultSort: { key: "order_index", dir: "asc" },
    columns: [
      { key: "label", header: "Label", primary: true },
      { key: "value", header: "Value", render: "number" },
      { key: "context", header: "Shown on" },
      { key: "order_index", header: "Order", render: "number" },
    ],
    groups: [
      { label: "Stat", fields: ["value", "prefix", "suffix", "label"] },
      { label: "Placement", fields: ["context", "order_index"] },
      { label: "Publish", fields: ["status"] },
    ],
    fields: [
      { key: "value", label: "Value", widget: "number", required: true,
        controls: "Rendered as {prefix}{value}{suffix} above the label." },
      { key: "prefix", label: "Prefix", widget: "text", controls: "Sits before the number." },
      { key: "suffix", label: "Suffix", widget: "text", controls: "Sits after the number — “+”, “%”, “ wks”." },
      { key: "label", label: "Label", widget: "text", required: true, controls: "The line under the number." },
      { key: "context", label: "Shown on", widget: "select", required: true,
        options: [
          { value: "home", label: "Homepage (hero proof + why band)" },
          { value: "about", label: "About page" },
          { value: "why", label: "Why Anode" },
        ],
        controls: "Which surface the stat appears on. The first “home” stat is the hero proof figure." },
      { key: "order_index", label: "Order", widget: "number", controls: "Left-to-right order in the stat row." },
      ...PUBLISH_FIELDS.slice(0, 1),
    ],
  },
  {
    key: "faqs",
    table: "faqs",
    label: { singular: "FAQ", plural: "FAQs" },
    description: "Accordion entries, and the FAQPage structured data that goes with them.",
    minRole: "editor",
    group: "Content",
    icon: "message-square",
    hasStatus: true,
    hasSlug: false,
    defaultSort: { key: "order_index", dir: "asc" },
    columns: [
      { key: "question", header: "Question", primary: true },
      { key: "scope", header: "Page" },
      { key: "order_index", header: "Order", render: "number" },
    ],
    groups: [
      { label: "Question", fields: ["question", "answer"] },
      { label: "Placement", fields: ["scope", "order_index"] },
      { label: "Publish", fields: ["status"] },
    ],
    fields: [
      { key: "question", label: "Question", widget: "text", required: true, controls: "The accordion summary." },
      { key: "answer", label: "Answer", widget: "textarea", required: true, rows: 5,
        controls: "The accordion body and the FAQPage JSON-LD answer." },
      { key: "scope", label: "Appears on", widget: "text", required: true,
        help: "services · process · quote · or a service slug for a service-specific answer",
        controls: "Which page the item appears on." },
      { key: "order_index", label: "Order", widget: "number", controls: "Order within the accordion." },
      ...PUBLISH_FIELDS.slice(0, 1),
    ],
  },
  {
    key: "post_topics",
    table: "post_topics",
    label: { singular: "Topic", plural: "Topics" },
    description: "Insight categories and their filter routes.",
    minRole: "editor",
    group: "Content",
    icon: "layers",
    hasStatus: false,
    hasSlug: true,
    defaultSort: { key: "order_index", dir: "asc" },
    columns: [
      { key: "name", header: "Name", primary: true },
      { key: "slug", header: "Slug" },
      { key: "order_index", header: "Order", render: "number" },
    ],
    groups: [{ label: "Topic", fields: ["name", "slug", "description", "order_index"] }],
    fields: [
      { key: "name", label: "Name", widget: "text", required: true, controls: "The chip on each article card." },
      { key: "slug", label: "Slug", widget: "slug", required: true, controls: "/insights/topic/{slug}" },
      { key: "description", label: "Description", widget: "textarea", rows: 2, controls: "Topic page intro." },
      { key: "order_index", label: "Order", widget: "number", controls: "Order in the topic filter row." },
    ],
  },
];

export const resourceByKey = (key: string) => RESOURCES.find((r) => r.key === key);

/** Builds the public URL for a row, or null when the type has no public page. */
export function previewUrlFor(
  config: Pick<ResourceConfig, "previewBase">,
  row: Record<string, unknown> | null | undefined,
): string | null {
  const slug = row?.slug;
  if (!config.previewBase || typeof slug !== "string" || !slug) return null;
  return `${config.previewBase}/${slug}`;
}

export const RESOURCE_GROUPS = ["Inbox", "Content", "Proof", "Assets", "Site", "Admin"] as const;
