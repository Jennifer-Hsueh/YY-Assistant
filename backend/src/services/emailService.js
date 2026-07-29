// Thin wrapper around the Resend API (https://resend.com).
// Chosen as the default provider for transactional email (password reset,
// future notification emails) — simple REST API, no SDK required, generous
// free tier for a solo/early-stage project. Swap the implementation here
// if a different provider (SendGrid / SES) is preferred later; callers
// only depend on `sendPasswordResetEmail`.

const RESEND_API_URL = 'https://api.resend.com/emails';

async function sendEmail({ to, subject, html }) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[emailService] RESEND_API_KEY not set — logging email instead of sending.');
    console.log(`[emailService] would send to ${to}: ${subject}\n${html}`);
    return { sent: false, reason: 'RESEND_API_KEY not configured' };
  }

  const res = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'noreply@yourapp.com',
      to,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Resend API error (${res.status}): ${body}`);
  }

  return { sent: true };
}

async function sendPasswordResetEmail(toEmail, resetUrl) {
  const html = `
    <div style="font-family: sans-serif; line-height: 1.6;">
      <p>您好,</p>
      <p>我們收到重設您帳號密碼的請求。請點擊以下連結設定新密碼(連結 30 分鐘內有效):</p>
      <p><a href="${resetUrl}" style="color:#111827;">重設密碼</a></p>
      <p>如果這不是您本人的操作,請忽略此信件,您的帳號不會有任何變動。</p>
    </div>
  `;
  return sendEmail({ to: toEmail, subject: '重設您的密碼', html });
}

module.exports = { sendEmail, sendPasswordResetEmail };
