import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const resend = apiKey ? new Resend(apiKey) : null;
const FROM = process.env.EMAIL_FROM || "Hunch <onboarding@resend.dev>";

export async function sendEmail(opts: { to: string; subject: string; html: string }): Promise<void> {
  if (!resend) {
    // Dev / no provider: log instead of sending so the app runs with zero config.
    console.log(`\n[email:dev] to=${opts.to} subject="${opts.subject}"\n${stripHtml(opts.html)}\n`);
    return;
  }
  try {
    await resend.emails.send({ from: FROM, to: opts.to, subject: opts.subject, html: opts.html });
  } catch (err) {
    console.error("[email] send failed:", err);
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
