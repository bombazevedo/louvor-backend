// src/controllers/billingController.js
const Organization = require('../models/Organization');
const { createPagarmeClient } = require('../services/pagarmeClient');
const { addMonths, startOfNow } = require('../utils/dateUtils');
const { getBillingPeriod, getPriceCents } = require('../utils/planCatalog');

// POST /billing/subscribe
// body: { planCode: "1"|"2"|..., billingPeriod: "MONTHLY"|"QUARTERLY"|"YEARLY" }
async function subscribe(req, res) {
  try {
    const orgId = req.orgId;
    const userId = req.user?.id;

    const { planCode, billingPeriod } = req.body || {};
    const periodKey = getBillingPeriod(billingPeriod);

    if (!orgId) return res.status(400).json({ error: 'Missing orgId context' });
    if (!planCode) return res.status(400).json({ error: 'Missing planCode' });
    if (!periodKey) return res.status(400).json({ error: 'Invalid billingPeriod' });

    const priceCents = getPriceCents(planCode, periodKey);
    if (!priceCents) return res.status(400).json({ error: 'Invalid plan/period price' });

    const org = await Organization.findById(orgId);
    if (!org) return res.status(404).json({ error: 'Organization not found' });

    // Cliente pagar.me: use email do dono (ou do user logado)
    // ⚠️ aqui mantive simples e robusto: cria/usa customerId armazenado na org
    const pagarme = createPagarmeClient();

    let customerId = org.license?.pagarmeCustomerId || null;

    if (!customerId) {
      const customerPayload = {
        name: org.name || 'WorshipHub Customer',
        email: org.ownerEmail || org.contactEmail || 'no-reply@worshiphub.app',
        metadata: { orgId: String(orgId), createdByUserId: String(userId || '') },
      };

      const customerResp = await pagarme.post('/customers', customerPayload);
      customerId = customerResp?.data?.id;

      org.license = org.license || {};
      org.license.pagarmeCustomerId = customerId;
      await org.save();
    }

    // Assinatura avulsa (itens com preço)
    // Você pode ajustar o payment_method depois (cartão, pix, boleto etc).
    // Neste passo, o mais importante é: metadata com orgId.
    const subscriptionPayload = {
      customer_id: customerId,
      payment_method: 'credit_card',
      interval: 'month',
      interval_count: periodKey === 'MONTHLY' ? 1 : periodKey === 'QUARTERLY' ? 3 : 12,
      items: [
        {
          description: `WorshipHub Plano ${planCode} (${periodKey})`,
          quantity: 1,
          pricing_scheme: {
            scheme_type: 'unit',
            price: priceCents,
          },
        },
      ],
      metadata: {
        orgId: String(orgId),
        planCode: String(planCode),
        billingPeriod: String(periodKey),
      },
    };

    const subResp = await pagarme.post('/subscriptions', subscriptionPayload);
    const subscription = subResp?.data;

    // ⚠️ Importante: só ativar licença como "active" após confirmação no webhook (pago)
    // Aqui a gente só salva IDs e estado "pending"
    org.license = org.license || {};
    org.license.plan = String(planCode);
    org.license.status = 'pending';
    org.license.billingPeriod = periodKey;
    org.license.pagarmeSubscriptionId = subscription?.id || null;

    await org.save();

    return res.json({
      ok: true,
      subscriptionId: subscription?.id,
      status: subscription?.status,
      // dependendo do produto, pode existir link/checkout_url:
      // devolvemos tudo para debug premium
      subscription,
    });
  } catch (err) {
    console.error('[billingController.subscribe] error:', err?.response?.data || err);
    return res.status(500).json({ error: 'Failed to create subscription' });
  }
}

// GET /billing/catalog
async function catalog(req, res) {
  try {
    // Mantém o catálogo 100% modular no backend (fonte de verdade)
    const { PLAN_LABELS, BILLING_PERIODS, PRICES_CENTS } = require('../utils/planCatalog');

    return res.json({
      ok: true,
      plans: PLAN_LABELS,
      periods: BILLING_PERIODS,
      pricesCents: PRICES_CENTS,
    });
  } catch (err) {
    console.error('[billingController.catalog] error:', err);
    return res.status(500).json({ error: 'Failed to load billing catalog' });
  }
}

// POST /billing/checkout
// body: { planCode: "1"|"2"|..., billingPeriod: "MONTHLY"|"QUARTERLY"|"YEARLY" }
async function checkout(req, res) {
  try {
    const orgId = req.orgId;
    const userId = req.user?.id;

    const { planCode, billingPeriod } = req.body || {};
    const periodKey = getBillingPeriod(billingPeriod);

    if (!orgId) return res.status(400).json({ error: 'Missing orgId context' });
    if (!planCode) return res.status(400).json({ error: 'Missing planCode' });
    if (!periodKey) return res.status(400).json({ error: 'Invalid billingPeriod' });

    const priceCents = getPriceCents(planCode, periodKey);
    if (!priceCents) return res.status(400).json({ error: 'Invalid plan/period price' });

    const org = await Organization.findById(orgId);
    if (!org) return res.status(404).json({ error: 'Organization not found' });

    const pagarme = createPagarmeClient();

    // ✅ garante customer_id (mesma lógica robusta já usada no subscribe)
    let customerId = org.license?.pagarmeCustomerId || null;

    if (!customerId) {
      const customerPayload = {
        name: org.name || 'WorshipHub Customer',
        email: org.ownerEmail || org.contactEmail || 'no-reply@worshiphub.app',
        metadata: { orgId: String(orgId), createdByUserId: String(userId || '') },
      };

      const customerResp = await pagarme.post('/customers', customerPayload);
      customerId = customerResp?.data?.id;

      org.license = org.license || {};
      org.license.pagarmeCustomerId = customerId;
      await org.save();
    }

    // ✅ cria Payment Link (Checkout hospedado)
    // IMPORTANTE: metadata.kind='order' para o webhook não sobrescrever pagarmeSubscriptionId

        const boletoDueAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

    // ✅ Formato exigido no checkout link (type=order):
    // installments: [{ number, total }]
    // installments_setup: { interest_type }
    // boleto_settings/pix_settings obrigatórios se aceitos
    const installmentsNumbers = [1, 2, 3, 4, 5, 6, 12];
    const installments = installmentsNumbers.map((n) => ({ number: n, total: priceCents }));

        // ✅ cria Payment Link (Checkout hospedado) — formato alinhado ao exemplo oficial
    // Fonte: docs.pagar.me (paymentlinks type=order) — installments deve ser array de { number, total }
    const allowedInstallments = [1, 2, 3, 4, 5, 6, 12];

    const payload = {
      is_building: false,
      const payload = {
  is_building: false,
  payment_settings: {
    credit_card_settings: {
      installments_setup: {
        interest_type: 'simple',
      },
      operation_type: 'auth_and_capture',
      installments: allowedInstallments.map((n) => ({
        number: n,
        total: priceCents,
      })),
    },
    accepted_payment_methods: ['credit_card'],
  },
  cart_settings: {
    items: [
      {
        amount: priceCents,
        name: `WorshipHub Plano ${planCode} (${periodKey})`,
        default_quantity: 1,
      },
    ],
  },
  name: `WorshipHub Plano ${planCode} (${periodKey})`,
  type: 'order',
};

    const linkResp = await pagarme.post('/paymentlinks', payload);
    const paymentLink = linkResp?.data;

    // ⚠️ Importante: só ativar licença como "active" após confirmação no webhook (pago)
    // Aqui a gente só salva IDs e estado "pending"
org.license = org.license || {};
org.license.plan = String(planCode);
org.license.status = 'pending';
org.license.billingPeriod = periodKey;

// rastreio do checkout
org.license.pagarmePaymentLinkId = paymentLink?.id || null;

// rastreio pendente (para o webhook casar sem risco de plano errado)
org.license.pendingPayment = {
  provider: 'pagarme',
  kind: 'order',
  paymentLinkId: paymentLink?.id || null,
  planCode: String(planCode),
  billingPeriod: String(periodKey),
  createdByUserId: String(userId || ''),
  createdAt: new Date().toISOString(),
};

// não mexe no pagarmeSubscriptionId aqui (fluxo order)
await org.save();

        return res.json({
      ok: true,
      url: paymentLink?.url || null,
      paymentLinkId: paymentLink?.id || null,
      status: paymentLink?.status || null,
      paymentLink,
    });
  } catch (err) {console.error('[billingController.checkout] error RAW:', {
  status,
  reqId,
  data,
  message: err?.message,
});

    const status = err?.response?.status;
    const data = err?.response?.data;
    const reqId =
      err?.response?.headers?.['x-request-id'] ||
      err?.response?.headers?.['request-id'] ||
      err?.response?.headers?.['x-correlation-id'] ||
      null;

    return res.status(500).json({ error: 'Failed to create checkout link' });
  }
}

module.exports = { subscribe, catalog, checkout };
