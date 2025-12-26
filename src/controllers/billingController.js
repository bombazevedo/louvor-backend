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

module.exports = { subscribe };
