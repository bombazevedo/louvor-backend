const axios = require('axios');

/**
 * Envia e-mail via Resend (HTTP).
 * Requer:
 * - RESEND_API_KEY
 * - RESEND_FROM (ex: 'WorshipHub <no-reply@worshiphub-recover.org>' ou 'onboarding@resend.dev' para testes)
 */
async function sendEmail({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;

  if (!apiKey || !from) {
    console.warn('[emailService] RESEND_API_KEY/RESEND_FROM ausentes. E-mail não enviado.');
    return { skipped: true };
  }

  const payload = {
    from,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    text,
  };

  const res = await axios.post('https://api.resend.com/emails', payload, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    timeout: 15000,
  });

  return res.data;
}

module.exports = { sendEmail };
