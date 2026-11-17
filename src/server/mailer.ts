import nodemailer from "nodemailer";

const host = process.env.SMTP_HOST;

const transport = host
  ? nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    })
  : null;

/** Sends an email when SMTP is configured (SMTP_HOST in .env.local); otherwise does nothing. */
export async function sendMail(message: { to: string[]; subject: string; html: string; text: string }) {
  if (!transport || message.to.length === 0) return;
  await transport.sendMail({ from: process.env.SMTP_FROM ?? process.env.SMTP_USER, ...message });
}
