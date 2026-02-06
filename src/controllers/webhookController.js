// src/controllers/webhookController.js
const Organization = require('../models/Organization');
const { addMonths, startOfNow } = require('../utils/dateUtils');

function verifyWebhook(req) {
  // ✅ determinístico: use ?secret=... na URL do webhook cadastrada no Pagar.me
  const webhookSecret = process.env.PAGARME_WEBHOOK_SECRET;
  const apiSecretKey = process.env.PAGARME_SECRET_KEY; // ⚠️ fallback temporário (teste controlado)

  // dev: se não setou nenhum, não bloqueia
  if (!webhookSecret && !apiSecretKey) return true;

  const receivedQuery = req?.query?.secret;
  const receivedHeader = req.header('x-worshiphub-webhook-secret'); // fallback (compat)
  const received = receivedQuery || receivedHeader;

  const expected = String(webhookSecret || '').trim();
  const got = received != null ? String(received).trim() : '';

  // ✅ regra oficial: webhookSecret (wh_...)
  let ok = !!got && !!expected && got === expected;

  // ✅ fallback controlado: se o provedor estiver chamando com sk_test_... no ?secret=
  // Aceita SOMENTE se for exatamente igual à PAGARME_SECRET_KEY.
  if (!ok && apiSecretKey) {
    const expectedApi = String(apiSecretKey || '').trim();
    if (!!got && !!expectedApi && got === expectedApi) {
      ok = true;
      console.warn('[pagarmeWebhook.verify] WARNING: webhook called using PAGARME_SECRET_KEY as ?secret (sk_test...). Provider URL is divergent/old; accepting temporarily for controlled test.');
    }
  }

  // ✅ log mínimo quando falhar (sem vazar secret inteiro)
  if (!ok) {
    const mask = (v) => {
      const s = String(v || '');
      if (!s) return '';
      if (s.length <= 8) return '***';
      return `${s.slice(0, 4)}***${s.slice(-4)}`;
    };

    console.log('[pagarmeWebhook.verify] invalid secret', {
      originalUrl: req?.originalUrl,
      hasQuery: !!receivedQuery,
      hasHeader: !!receivedHeader,
      got: mask(got),
      expected: mask(expected),
    });
  }

  return ok;
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

        // ✅ order.paid (payment link) pode não trazer orgId no metadata.
    // Casamos a org pelo code do payment link (integration.code / code / charges[0].code)
    const paymentLinkCode =
      data?.integration?.code ||
      data?.code ||
      data?.charges?.[0]?.code ||
      // ✅ fallbacks comuns
      payload?.data?.integration?.code ||
      payload?.data?.code ||
      payload?.data?.charges?.[0]?.code ||
      null;

    // fallback: se vier só subscription_id, tentamos buscar org por pagarmeSubscriptionId
    let org = null;
    if (orgId) {
      org = await Organization.findById(orgId);
        } else if (paymentLinkCode) {
      const code = String(paymentLinkCode);
      const codeAtEnd = new RegExp(`${code}$`); // aceita URL terminando com /pl_xxx

      org = await Organization.findOne({
        $or: [
          // pode acontecer de alguém ter salvo "code" em pagarmePaymentLinkId em algum momento
          { 'license.pagarmePaymentLinkId': code },
          { 'license.pagarmePaymentLinkId': codeAtEnd },

          // comparar code contra paymentLinkId (pode estar como URL)
          { 'license.pendingPayment.paymentLinkId': code },
          { 'license.pendingPayment.paymentLinkId': codeAtEnd },

          // ✅ caso correto: comparar code com paymentLinkCode salvo no checkout
          { 'license.pendingPayment.paymentLinkCode': code },
        ],
      });
    } else if (data?.id) {
      org = await Organization.findOne({ 'license.pagarmeSubscriptionId': String(data.id) });
    } else if (data?.subscription?.id) {
      org = await Organization.findOne({ 'license.pagarmeSubscriptionId': String(data.subscription.id) });
    }

        if (!org) {
      console.log('[pagarmeWebhook] org not found. eventType=', eventType, '| paymentLinkCode=', paymentLinkCode);
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

    // ✅ para subscription.*: data.id pode ser subscriptionId
    if (isSubscriptionEvent && data?.id) {
      org.license.pagarmeSubscriptionId = String(data.id);
    }

    // ✅ idempotência correta: comparar ANTES de gravar pagarmeLastOrderId
    // Reenviar o MESMO order.paid não pode estender período
    const incomingOrderId = isOrderEvent && data?.id ? String(data.id) : null;
    const prevLastOrderId = org?.license?.pagarmeLastOrderId ? String(org.license.pagarmeLastOrderId) : null;

    // Só ignora duplicado quando a licença já estiver ativa (evita travar a primeira ativação)
    if (
      isPaidLike &&
      months &&
      incomingOrderId &&
      prevLastOrderId &&
      incomingOrderId === prevLastOrderId &&
      String(org?.license?.status || '') === 'active'
    ) {
      console.log('[pagarmeWebhook] duplicate order.paid ignored', {
        orgId: String(org._id),
        orderId: incomingOrderId,
      });
      return res.json({ ok: true, ignored: true, reason: 'duplicate_order' });
    }
    // ✅ MODELO 1:
    // - se mudou de plano => perde saldo (base = now)
    // - se é o mesmo plano => soma (base = currentEnd se ainda válido)
    if (isPaidLike && months) {
      const now = startOfNow();

      const prevPlan = String(org.license.plan || 'FREE');
      const nextPlan = String(planCode || 'FREE');
      const isSamePlan = prevPlan === nextPlan;

      const currentEnd = org.license.planEnd ? new Date(org.license.planEnd) : null;
      const hasValidEnd = !!currentEnd && !isNaN(currentEnd.getTime());
      const canStack = isSamePlan && hasValidEnd && currentEnd.getTime() > now.getTime();
      const baseDate = canStack ? currentEnd : now;

      org.license.plan = nextPlan;
      if (billingPeriod) org.license.billingPeriod = billingPeriod;

      org.license.status = 'active';
      org.license.planStart = now;
      org.license.planEnd = addMonths(baseDate, months);

      // ✅ para order.*: data.id é orderId (NUNCA subscriptionId)
      if (incomingOrderId) {
        org.license.pagarmeLastOrderId = incomingOrderId;
      }

      // ✅ consumo do pendingPayment (não deixa um link antigo ativar depois)
      if (org.license.pendingPayment != null) {
        org.license.pendingPayment = null;
        if (typeof org.markModified === 'function') org.markModified('license');
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
