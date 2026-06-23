const axios = require('axios');

const BREVO_CONTACTS_URL = 'https://api.brevo.com/v3/contacts';

const isEnabled = () => {
  return String(process.env.BREVO_ENABLED || '').toLowerCase() === 'true';
};

exports.syncTrialContactToBrevo = async ({ user, org }) => {
  try {
    if (!isEnabled()) return;

    const apiKey = process.env.BREVO_API_KEY;
    const listId = Number(process.env.BREVO_TRIAL_LIST_ID || 3);

    if (!apiKey || !listId || !user?.email || !org?._id) {
      console.warn('[Brevo] Configuração incompleta ou dados ausentes.');
      return;
    }

    const license = org.license || {};

    await axios.post(
      BREVO_CONTACTS_URL,
      {
        email: String(user.email).toLowerCase().trim(),
        updateEnabled: true,
        listIds: [listId],
        attributes: {
          FIRSTNAME: user.name || '',
          ORG_NAME: org.name || '',
          PLAN_STATUS: license.status || '',
          TRIAL_START: license.trialStartsAt || null,
          TRIAL_END: license.trialEndsAt || null,
          SUPPORT_WHATSAPP: process.env.BREVO_SUPPORT_WHATSAPP || '+55 24 99987-4551',
        },
      },
      {
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json',
        },
        timeout: 8000,
      }
    );

    console.log('[Brevo] Contato trial sincronizado:', user.email);
  } catch (err) {
    console.warn('[Brevo] Falha ao sincronizar contato trial:', err?.response?.data || err.message);
  }
};