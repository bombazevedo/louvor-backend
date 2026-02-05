// src/controllers/webhookController.js
const Organization = require('../models/Organization');
const { addMonths, startOfNow } = require('../utils/dateUtils');

function verifyWebhook(req) {
  // ✅ determinístico: use ?secret=... na URL do webhook cadastrada no Pagar.me
  // (header custom pode não ser enviado pelo provedor)
  const secret = process.env.PAGARME_WEBHOOK_SECRET;
  if (!secret) return true; // dev: se não setou, não bloqueia

  const receivedQuery = req?.query?.secret;
  const receivedHeader = req.header('x-worshiphub-webhook-secret'); // mantém compatibilidade
  const received = receivedQuery || receivedHeader;

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

        // ✅ identifica tipo do evento (order.* vs subscription.*)
    const isOrderEvent = String(eventType || '').toLowerCase().startsWith('order.');
    const isSubscriptionEvent = String(eventType || '').toLowerCase().startsWith('subscription.');

    // ✅ preferir metadata do próprio evento; fallback para pendingPayment (caso metadata não venha)
    const pending = org?.license?.pendingPayment || null;

    const planCode = meta?.planCode || pending?.planCode || org?.license?.plan || 'FREE';
    const billingPeriod = meta?.billingPeriod || pending?.billingPeriod || org?.license?.billingPeriod || null;
    const billingKey = billingPeriod ? String(billingPeriod).toUpperCase() : null;

    // decide meses (1/3/12)
    const months =
      billingKey === 'MONTHLY' ? 1 :
      billingKey === 'QUARTERLY' ? 3 :
      (billingKey === 'YEARLY' || billingKey === 'ANNUAL') ? 12 :
      null;

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
    if (data?.customer_id) org.license.pagarmeCustomerId = String(data.customer_id);

    // ✅ para order.*: data.id é orderId (NUNCA subscriptionId)
    if (isOrderEvent && data?.id) {
      org.license.pagarmeLastOrderId = String(data.id);
    }

    // ✅ para subscription.*: data.id pode ser subscriptionId
    if (isSubscriptionEvent && data?.id) {
      org.license.pagarmeSubscriptionId = String(data.id);
    }

    // ✅ só “assume plano” quando de fato pagou e temos período válido
    if (isPaidLike && months) {
      org.license.plan = String(planCode);
      if (billingPeriod) org.license.billingPeriod = billingPeriod;
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

      // ✅ consumo do pendingPayment (não deixa um link antigo ativar depois)
      if (org.license.pendingPayment) {
        org.license.pendingPayment = undefined;
      }
    } else if (isCanceledLike) {
      org.license.status = 'expired';
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
