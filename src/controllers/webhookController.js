// src/controllers/webhookController.js
const Organization = require('../models/Organization');
const { addMonths, startOfNow } = require('../utils/dateUtils');

function verifyWebhook(req) {
  // ✅ simples e robusto: compare um secret em header
  // Configure no Pagar.me a URL e envie esse header (ou use um query token)
  const secret = process.env.PAGARME_WEBHOOK_SECRET;
  if (!secret) return true; // se não setou secret, não bloqueia (dev)
    const receivedHeader = req.header('x-worshiphub-webhook-secret');
  const receivedQuery = req?.query?.secret;
  const received = receivedHeader || receivedQuery;
  return received && String(received) === String(secret);
}

async function pagarmeWebhook(req, res) {
  try {
    if (!verifyWebhook(req)) {
      return res.status(401).json({ error: 'Invalid webhook secret' });
    }

    const payload = req.body || {};
    const eventType = payload?.type || payload?.event || null;
    const data = payload?.data || payload;

    // metadata que nós enviamos na assinatura

    const meta = data?.metadata || {};
    const orgId = meta?.orgId;

    // fallback: se vier só subscription_id, tentamos buscar org por pagarmeSubscriptionId
    let org = null;
    if (orgId) {
      org = await Organization.findById(orgId);
    } else if (data?.id) {
      org = await Organization.findOne({ 'license.pagarmeSubscriptionId': String(data.id) });
    } else if (data?.subscription?.id) {
      org = await Organization.findOne({ 'license.pagarmeSubscriptionId': String(data.subscription.id) });
    }

    if (!org) {
      console.log('[pagarmeWebhook] org not found. eventType=', eventType);
      return res.json({ ok: true }); // não re-tenta infinito
    }

    // ✅ identifica eventos vindos do checkout via payment link (order)
    const __prevSubId = org?.license?.pagarmeSubscriptionId || null;
    const __isOrderFromLink = String(meta?.kind || '').toLowerCase() === 'order';

    const planCode = meta?.planCode || org?.license?.plan || 'FREE';
    const billingPeriod = meta?.billingPeriod || org?.license?.billingPeriod || null;
    const billingKey = billingPeriod ? String(billingPeriod).toUpperCase() : null;

    // decide meses (1/3/12)
    const months =
      billingKey === 'MONTHLY' ? 1 :
      billingKey === 'QUARTERLY' ? 3 :
      (billingKey === 'YEARLY' || billingKey === 'ANNUAL') ? 12 :
      null;

    // Heurística segura:
    // - se evento indicar "paid/active": ativa
    // - se indicar "canceled/ended": expira
    const status = String(data?.status || '').toLowerCase();

    const isPaidLike =
      status === 'paid' ||
      status === 'active' ||
      status === 'authorized' ||
      status === 'settled';

    const isCanceledLike =
      status === 'canceled' ||
      status === 'cancelled' ||
      status === 'failed' ||
      status === 'inactive' ||
      status === 'ended';

    org.license = org.license || {};
    org.license.plan = String(planCode);
    if (billingPeriod) org.license.billingPeriod = billingPeriod;

    if (data?.customer_id) org.license.pagarmeCustomerId = String(data.customer_id);
    if (data?.id) org.license.pagarmeSubscriptionId = String(data.id);

// ✅ Se veio de payment link (order), NÃO deixamos sobrescrever pagarmeSubscriptionId
if (__isOrderFromLink && data?.id) {
  org.license.pagarmeLastOrderId = String(data.id);
  org.license.pagarmeSubscriptionId = __prevSubId; // restaura
}

        if (isPaidLike && months) {
      const now = startOfNow();

      const currentEnd = org.license.planEnd ? new Date(org.license.planEnd) : null;
      const hasValidEnd = !!currentEnd && !isNaN(currentEnd.getTime());
      const baseDate =
        hasValidEnd && currentEnd.getTime() > now.getTime()
          ? currentEnd
          : now;

      org.license.status = 'active';
      org.license.planStart = now;
      org.license.planEnd = addMonths(baseDate, months);
    } else if (isCanceledLike) {
      org.license.status = 'expired';
      // não mexe em planEnd se já existir (mantém histórico)
      if (!org.license.planEnd) org.license.planEnd = startOfNow();
    }

    await org.save();

    return res.json({ ok: true });
  } catch (err) {
    console.error('[pagarmeWebhook] error:', err?.response?.data || err);
    return res.status(500).json({ error: 'Webhook handling failed' });
  }
}

module.exports = { pagarmeWebhook };
