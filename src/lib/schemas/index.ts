import { z } from "zod";

/** Shared by the client form and the route handler — they cannot drift (§2). */

/**
 * Honeypot. Deliberately permissive so a filled value PARSES and reaches the
 * gate in lib/api.ts, which answers with a silent 202. Rejecting it here would
 * return a 400 naming the field — telling a bot exactly where the trap is.
 */
const honeypot = z.string().max(200).optional();

const email = z
  .string()
  .trim()
  .min(1, "Enter your email address")
  .email("That does not look like a valid email address")
  .max(254);

export const newsletterSchema = z.object({
  email,
  source: z.string().max(120).optional(),
  website: honeypot,
});
export type NewsletterInput = z.infer<typeof newsletterSchema>;

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(120),
  email,
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  company: z.string().trim().max(160).optional().or(z.literal("")),
  subject: z.string().trim().max(200).optional().or(z.literal("")),
  message: z
    .string()
    .trim()
    .min(10, "Please give us a little more detail — at least 10 characters")
    .max(5000, "That is longer than we can accept. Please keep it under 5000 characters."),
  website: honeypot,
  startedAt: z.number().optional(),
  turnstileToken: z.string().optional(),
});
export type ContactInput = z.infer<typeof contactSchema>;

/* ------------------------------------------------------- quote wizard */

export const PROJECT_TYPES = [
  "New product from concept",
  "Redesign of an existing product",
  "Review or audit of an existing design",
  "Cost reduction / BOM optimisation",
  "Bring-up or debugging help",
  "Compliance or test support",
] as const;

export const STAGES = ["idea", "schematic", "prototype", "production"] as const;
export const STAGE_LABELS: Record<(typeof STAGES)[number], string> = {
  idea: "Concept or idea",
  schematic: "Schematic in progress",
  prototype: "Prototype built",
  production: "In production",
};

export const TIMELINES = [
  "As soon as possible",
  "Within 1–3 months",
  "Within 3–6 months",
  "6+ months",
  "Exploring options",
] as const;

export const BUDGET_RANGES = [
  "Under £10k",
  "£10k – £25k",
  "£25k – £50k",
  "£50k – £100k",
  "Over £100k",
  "Not sure yet",
] as const;

export const QUANTITIES = [
  "Prototypes only",
  "Under 100 / year",
  "100 – 1,000 / year",
  "1,000 – 10,000 / year",
  "10,000+ / year",
] as const;

export const quoteStep1 = z.object({
  projectType: z.enum(PROJECT_TYPES, { message: "Choose what best describes the project" }),
  industrySlug: z.string().min(1, "Choose the closest sector"),
  stage: z.enum(STAGES, { message: "Tell us where the project is today" }),
});

export const quoteStep2 = z.object({
  serviceSlugs: z.array(z.string()).min(1, "Select at least one service"),
  quantityEstimate: z.enum(QUANTITIES).optional(),
  timeline: z.enum(TIMELINES, { message: "Choose a timeline" }),
  budgetRange: z.enum(BUDGET_RANGES).optional(),
  description: z
    .string()
    .trim()
    .min(20, "A couple of sentences helps us reply usefully — at least 20 characters")
    .max(5000),
});

export const quoteStep3 = z.object({
  attachments: z
    .array(z.object({ path: z.string(), filename: z.string(), sizeBytes: z.number(), mimeType: z.string() }))
    .max(5, "Up to five files")
    .default([]),
  ndaRequired: z.boolean().default(false),
});

export const quoteStep4 = z.object({
  fullName: z.string().trim().min(2, "Enter your name").max(120),
  email,
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  company: z.string().trim().max(160).optional().or(z.literal("")),
  country: z.string().trim().max(80).optional().or(z.literal("")),
  howHeard: z.string().trim().max(160).optional().or(z.literal("")),
});

export const quoteSubmitSchema = quoteStep1
  .extend(quoteStep2.shape)
  .extend(quoteStep3.shape)
  .extend(quoteStep4.shape)
  .extend({
    website: honeypot,
    startedAt: z.number().optional(),
    turnstileToken: z.string().optional(),
    source: z.record(z.string(), z.string()).optional(),
  });

export type QuoteInput = z.infer<typeof quoteSubmitSchema>;

export const ALLOWED_UPLOAD_EXT = [
  "pdf", "zip", "7z", "rar", "step", "stp", "brd", "sch", "kicad_pcb", "kicad_sch",
  "png", "jpg", "jpeg", "csv", "xlsx", "txt", "gbr", "gerber",
] as const;

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export const uploadUrlSchema = z.object({
  filename: z.string().min(1).max(200),
  mimeType: z.string().min(1).max(160),
  sizeBytes: z.number().int().positive().max(MAX_UPLOAD_BYTES, "Files must be 25 MB or smaller"),
  formToken: z.string().uuid(),
});
