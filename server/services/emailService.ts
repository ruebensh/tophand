import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

// Create reusable transporter
// Can use standard Gmail, Resend SMTP, or any free SMTP provider
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
});

/**
 * Sends a 6-digit confirmation/reset code to the user's email.
 */
export async function sendVerificationCodeEmail(
  toEmail: string,
  code: string,
  subject: string = 'TopHand - Tasdiqlash kodi'
): Promise<{ success: boolean; simulated?: boolean }> {
  const isConfigured = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);

  const htmlContent = `
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
          <div class="title">Parolni tiklash yoki tasdiqlash</div>
          <p class="text">TopHand hisobingiz uchun tasdiqlash kodi quyida keltirilgan. Kod 15 daqiqa davomida amal qiladi:</p>
          <div class="code-box">${code}</div>
          <p class="text" style="font-size: 12px; margin-bottom: 0;">Agar siz ushbu kodni so‘ramagan bo‘lsangiz, bu xatni e’tiborsiz qoldiring.</p>
        </div>
        <div class="footer">
          © ${new Date().getFullYear()} TopHand.uz • Mahalliy Xizmatlar va Ish Bozori Platformasi
        </div>
      </div>
    </body>
    </html>
  `;

  if (!isConfigured) {
    // Development / Demo mode: Log verification code to console clearly
    console.log('\n==================================================');
    console.log(`📧 [EMAIL SIMULATSIYA] Kimga: ${toEmail}`);
    console.log(`🔑 Tasdiqlash kodi: ${code}`);
    console.log('==================================================\n');
    return { success: true, simulated: true };
  }

  try {
    await transporter.sendMail({
      from: `"TopHand Platformasi" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: toEmail,
      subject,
      html: htmlContent,
      text: `TopHand platformasi tasdiqlash kodi: ${code}. Kod 15 daqiqa davomida amal qiladi.`,
    });
    return { success: true, simulated: false };
  } catch (error) {
    console.error('Email send error:', error);
    throw error;
  }
}
