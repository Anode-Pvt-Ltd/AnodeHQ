import "server-only";
import { serverEnv } from "@/lib/env";
import { settings } from "@/content/site";
import type { QuoteInput } from "@/lib/schemas";
import type { ContactInput } from "@/lib/schemas";

/**
 * Transactional email. A send failure never fails the request — the visitor
 * already has their reference, and a bounced notification is an operational
 * problem rather than a lost lead (spec §10.5).
 */

async function send(to: string, subject: string, html: string, replyTo?: string) {
  const { resendApiKey, resendFrom } = serverEnv();
  if (!resendApiKey || !resendFrom) {
    console.info("[notify] email not configured; would have sent", { to, subject });
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${resendApiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from: resendFrom, to, subject, html, reply_to: replyTo }),
    });
    if (!res.ok) console.error("[notify] send failed", res.status, await res.text());
  } catch (err) {
    console.error("[notify] send threw", err);
  }
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function shell(title: string, bodyHtml: string) {
  return `<!doctype html><html><body style="margin:0;background:#f7f9fa;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0b1417">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:560px;background:#fff;border:1px solid #dfe6e8;border-radius:12px" cellpadding="0" cellspacing="0">
<tr><td style="padding:28px 28px 0"><div style="font-size:20px;font-weight:700;letter-spacing:-.02em;color:#206779">Anode</div></td></tr>
<tr><td style="padding:20px 28px 28px">
<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;letter-spacing:-.02em">${esc(title)}</h1>
${bodyHtml}
</td></tr>
<tr><td style="padding:0 28px 28px;border-top:1px solid #dfe6e8">
<p style="margin:20px 0 0;font-size:13px;color:#6e838b">${esc(settings.contact.legalName)} · ${esc(settings.contact.addressLines.join(", "))}</p>
</td></tr>
</table></td></tr></table></body></html>`;
}

const row = (label: string, value: string) =>
  value
    ? `<tr><td style="padding:6px 0;font-size:13px;color:#6e838b;width:140px;vertical-align:top">${esc(label)}</td><td style="padding:6px 0;font-size:14px">${esc(value)}</td></tr>`
    : "";

export async function sendQuoteEmails({ reference, input }: { reference: string; input: QuoteInput }) {
  const { salesEmail } = serverEnv();
  const to = salesEmail || settings.contact.salesEmail;

  await send(
    input.email,
    `We have your request — ${reference}`,
    shell("Thanks — we have your request.", `
<p style="margin:0 0 14px;font-size:15px;line-height:1.6">Hello ${esc(input.fullName.split(" ")[0] ?? "there")},</p>
<p style="margin:0 0 14px;font-size:15px;line-height:1.6">Your request is with an engineer. ${esc(settings.contact.responsePromise)}</p>
<p style="margin:0 0 20px;font-size:15px;line-height:1.6">Your reference is <strong style="font-family:ui-monospace,monospace;color:#206779">${esc(reference)}</strong> — quote it if you need to add anything.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-top:1px solid #dfe6e8;margin-top:8px;padding-top:8px">
${row("Project", input.projectType)}
${row("Stage", input.stage)}
${row("Timeline", input.timeline)}
${row("Services", input.serviceSlugs.join(", "))}
${row("Attachments", input.attachments.length ? `${input.attachments.length} file(s)` : "")}
</table>`),
  );

  await send(
    to,
    `New quote request ${reference} — ${input.company || input.fullName}`,
    shell(`New quote request — ${reference}`, `
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%">
${row("Name", input.fullName)}
${row("Email", input.email)}
${row("Phone", input.phone ?? "")}
${row("Company", input.company ?? "")}
${row("Country", input.country ?? "")}
${row("Project type", input.projectType)}
${row("Sector", input.industrySlug)}
${row("Stage", input.stage)}
${row("Services", input.serviceSlugs.join(", "))}
${row("Volume", input.quantityEstimate ?? "")}
${row("Timeline", input.timeline)}
${row("Budget", input.budgetRange ?? "not stated")}
${row("NDA required", input.ndaRequired ? "Yes" : "No")}
${row("Heard via", input.howHeard ?? "")}
${row("Attachments", input.attachments.map((a) => a.filename).join(", "))}
</table>
<p style="margin:20px 0 6px;font-size:13px;color:#6e838b">Description</p>
<p style="margin:0;font-size:14px;line-height:1.6;white-space:pre-wrap">${esc(input.description)}</p>`),
    input.email,
  );
}

export async function sendContactEmails({ input }: { input: ContactInput }) {
  await send(
    settings.contact.email,
    `Contact form — ${input.subject || input.name}`,
    shell("New contact message", `
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%">
${row("Name", input.name)}
${row("Email", input.email)}
${row("Phone", input.phone ?? "")}
${row("Company", input.company ?? "")}
${row("Subject", input.subject ?? "")}
</table>
<p style="margin:20px 0 6px;font-size:13px;color:#6e838b">Message</p>
<p style="margin:0;font-size:14px;line-height:1.6;white-space:pre-wrap">${esc(input.message)}</p>`),
    input.email,
  );

  await send(
    input.email,
    "We have your message",
    shell("Thanks for getting in touch.", `
<p style="margin:0 0 14px;font-size:15px;line-height:1.6">Hello ${esc(input.name.split(" ")[0] ?? "there")},</p>
<p style="margin:0;font-size:15px;line-height:1.6">${esc(settings.contact.responsePromise)}</p>`),
  );
}

export async function sendNewsletterConfirm(email: string, token: string, siteUrl: string) {
  const url = `${siteUrl.replace(/\/$/, "")}/api/newsletter/confirm?token=${encodeURIComponent(token)}`;
  await send(
    email,
    "Confirm your subscription",
    shell("One click to confirm.", `
<p style="margin:0 0 20px;font-size:15px;line-height:1.6">Confirm you would like occasional engineering write-ups from Anode. No sales email, unsubscribe any time.</p>
<p style="margin:0 0 20px"><a href="${esc(url)}" style="display:inline-block;background:#206779;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;font-size:15px">Confirm subscription</a></p>
<p style="margin:0;font-size:13px;color:#6e838b">If you did not request this, ignore it and nothing happens.</p>`),
  );
}
