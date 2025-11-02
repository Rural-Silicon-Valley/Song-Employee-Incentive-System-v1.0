import nodemailer from "nodemailer";
import fetch from "node-fetch";

const provider = process.env.MAIL_PROVIDER || (process.env.RESEND_API_KEY ? "resend" : process.env.SMTP_HOST ? "smtp" : "echo");

export async function sendEmail(to: string, subject: string, html: string) {
  if (provider === "echo") {
    console.log(`[MAIL:ECHO] to=${to} subject=${subject} html=${html}`);
    return;
  }

  if (provider === "resend" && process.env.RESEND_API_KEY) {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM || "no-reply@localhost",
        to: [to],
        subject,
        html,
      }),
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Resend failed: ${resp.status} ${text}`);
    }
    return;
  }

  const port = Number(process.env.SMTP_PORT || 1025);
  const secureEnv = String(process.env.SMTP_SECURE || "").toLowerCase();
  const secure = secureEnv === "true" || port === 465;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "localhost",
    port,
    secure,
    auth: process.env.SMTP_USER && process.env.SMTP_PASS ? {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    } : undefined,
  });

  await transporter.sendMail({
    from: process.env.MAIL_FROM || "no-reply@localhost",
    to,
    subject,
    html,
  });
}
