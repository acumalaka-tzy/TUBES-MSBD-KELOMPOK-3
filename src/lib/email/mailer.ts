import nodemailer from "nodemailer";

const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
const smtpPort = Number(process.env.SMTP_PORT) || 465;
const smtpUser = process.env.SMTP_USER || "warkopagammedan111@gmail.com";
const smtpPass = process.env.SMTP_PASS || "wiltjnticlsmnlus";
const smtpFrom = process.env.SMTP_FROM || `Warkop Agam <${smtpUser}>`;

export const mailTransporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpPort === 465,
  auth: {
    user: smtpUser,
    pass: smtpPass,
  },
});

export interface SendOtpEmailParams {
  toEmail: string;
  recipientName: string;
  otpCode: string;
}

export async function sendOtpEmail({
  toEmail,
  recipientName,
  otpCode,
}: SendOtpEmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    const formattedCode = otpCode.split("").join(" ");

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verifikasi Email Warkop Agam</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7f7f8; margin: 0; padding: 24px; color: #1f2937; }
        .card { max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #e5e7eb; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
        .header { background-color: #F16F62; padding: 32px 24px; text-align: center; color: #ffffff; }
        .header h1 { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
        .header p { margin: 6px 0 0; font-size: 13px; opacity: 0.9; }
        .content { padding: 32px 28px; text-align: center; }
        .greeting { font-size: 16px; font-weight: 700; margin-bottom: 8px; color: #111827; }
        .instruction { font-size: 14px; line-height: 1.6; color: #4b5563; margin-bottom: 24px; }
        .otp-box { background: #fdf2f1; border: 2px dashed #F16F62; border-radius: 16px; padding: 18px 24px; margin: 24px 0; text-align: center; }
        .otp-code { font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 900; letter-spacing: 6px; color: #F16F62; margin: 0; }
        .expire-info { font-size: 12px; color: #9ca3af; margin-top: 8px; font-weight: 500; }
        .footer { border-top: 1px solid #f3f4f6; padding: 20px; text-align: center; font-size: 11px; color: #9ca3af; line-height: 1.5; background: #fafafa; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <h1>Warkop Agam</h1>
          <p>Ordering &amp; POS Management System</p>
        </div>
        <div class="content">
          <div class="greeting">Halo, ${recipientName}! 👋</div>
          <p class="instruction">
            Terima kasih telah mendaftar di <strong>Warkop Agam</strong>. Masukkan kode verifikasi berikut untuk mengaktifkan akun Anda:
          </p>
          <div class="otp-box">
            <div class="otp-code">${formattedCode}</div>
            <div class="expire-info">⏰ Kode berlaku selama 15 menit</div>
          </div>
          <p style="font-size: 12px; color: #6b7280; margin-top: 20px;">
            Jangan berikan kode ini kepada siapa pun demi keamanan akun Anda. Jika Anda tidak merasa mendaftar, silakan abaikan email ini.
          </p>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} Warkop Agam Senayan &amp; Medan • Tugas Besar MSBD Kelompok 3<br>
          Email otomatis, mohon tidak membalas pesan ini.
        </div>
      </div>
    </body>
    </html>
    `;

    await mailTransporter.sendMail({
      from: smtpFrom,
      to: toEmail,
      subject: `[Warkop Agam] Kode Verifikasi Akun: ${otpCode}`,
      text: `Halo ${recipientName},\n\nKode verifikasi akun Warkop Agam Anda adalah: ${otpCode}\nKode ini berlaku selama 15 menit.\n\nSalam,\nWarkop Agam`,
      html: htmlContent,
    });

    return { success: true };
  } catch (error: any) {
    console.error("Gagal mengirim email OTP:", error);
    return { success: false, error: error?.message || "Gagal mengirim email verifikasi" };
  }
}

