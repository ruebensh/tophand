import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { msg, type MsgLocale } from '../i18n/messages.ts';
dotenv.config();

// Transporter is only used as a fallback when no Brevo API key is set.
// Timeouts keep a stalled SMTP connection from hanging until the platform
// request limit (Render ~100s).
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: process.env.SMTP_USER && process.env.SMTP_PASS
    ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      }
    : undefined,
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
});

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

function buildHtmlEmail(code: string, lang: MsgLocale = 'uz'): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
        .container { max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
        .header { background: #0f172a; padding: 24px; text-align: center; }
        .logo { font-size: 24px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px; }
        .logo span { color: #3b82f6; }
        .content { padding: 32px 24px; text-align: center; }
        .title { font-size: 18px; font-weight: 700; margin-bottom: 12px; color: #0f172a; }
        .text { font-size: 14px; color: #64748b; line-height: 1.5; margin-bottom: 24px; }
        .code-box { background: #f1f5f9; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 16px; margin: 24px 0; font-family: monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #1e40af; text-align: center; }
        .footer { padding: 16px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">top<span>hand</span>.uz</div>
        </div>
        <div class="content">
          <div class="title">${msg('email.codeTitle', lang)}</div>
          <p class="text">${msg('email.codeIntro', lang)}</p>
          <div class="code-box">${code}</div>
          <p class="text" style="font-size: 12px; margin-bottom: 0;">${msg('email.codeIgnore', lang)}</p>
        </div>
        <div class="footer">
          © ${new Date().getFullYear()} TopHand.uz • ${msg('email.footer', lang)}
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Sends a 6-digit confirmation/reset code to the user's email.
 * Preference order:
 *   1) Brevo HTTP API (BREVO_API_KEY) — reliable on Render (port 443).
 *   2) SMTP (SMTP_USER + SMTP_PASS) — legacy fallback.
 *   3) Simulated mode — logs the code to the console (dev/demo).
 */
export async function sendVerificationCodeEmail(
  toEmail: string,
  code: string,
  subject?: string,
  lang: MsgLocale = 'uz'
): Promise<{ success: boolean; simulated?: boolean }> {
  const effectiveSubject = subject || msg('email.verifySubject', lang);
  const htmlContent = buildHtmlEmail(code, lang);
  const textContent = `${msg('email.codeIntro', lang)} ${code}`;

  const apiKey = (process.env.BREVO_API_KEY || '').trim();
  const smtpConfigured = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);

  // 1) Brevo HTTP API — preferred.
  if (apiKey) {
    const senderEmail = (process.env.BREVO_SENDER_EMAIL || process.env.SMTP_FROM || '').trim();
    const senderName = (process.env.BREVO_SENDER_NAME || 'TopHand Platformasi').trim();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(BREVO_API_URL, {
        method: 'POST',
        headers: {
          'api-key': apiKey,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          sender: { name: senderName, email: senderEmail },
          to: [{ email: toEmail }],
          subject: effectiveSubject,
          htmlContent,
          textContent,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Brevo API ${response.status}: ${body}`);
      }
      return { success: true, simulated: false };
    } catch (error) {
      console.error('Brevo API email send error:', error);
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  // 2) SMTP fallback.
  if (smtpConfigured) {
    try {
      await transporter.sendMail({
        from: `"TopHand Platformasi" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
        to: toEmail,
        subject: effectiveSubject,
        html: htmlContent,
        text: textContent,
      });
      return { success: true, simulated: false };
    } catch (error) {
      console.error('Email send error:', error);
      throw error;
    }
  }

  // 3) Development / Demo mode: Log verification code to console clearly.
  console.log('\n==================================================');
  console.log(`📧 [EMAIL SIMULATSIYA] Kimga: ${toEmail}`);
  console.log(`🔑 Tasdiqlash kodi: ${code}`);
  console.log('==================================================\n');
  return { success: true, simulated: true };
}
