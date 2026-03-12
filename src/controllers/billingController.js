// src/controllers/billingController.js
const Organization = require('../models/Organization');
const { createPagarmeClient } = require('../services/pagarmeClient');
const { addMonths, startOfNow } = require('../utils/dateUtils');
const { getBillingPeriod, getPriceCents } = require('../utils/planCatalog');

async function getOwnerOrganizationsOrdered(ownerId) {
  return Organization.find({ owner: ownerId })
    .sort({ createdAt: 1, _id: 1 })
    .select('_id name slug createdAt owner license isBillingAnchor');
}

async function resolveOwnerAnchorOrganization(ownerId, selectedAnchorOrgId = null) {
  const orgs = await getOwnerOrganizationsOrdered(ownerId);

  if (!orgs.length) {
    return {
      orgs: [],
      anchorOrg: null,
      currentAnchorOrg: null,
      selectedOrg: null,
      changed: false,
    };
  }

  const currentAnchorOrg = orgs.find((org) => org.isBillingAnchor === true) || orgs[0];

  if (!selectedAnchorOrgId) {
    return {
      orgs,
      anchorOrg: currentAnchorOrg,
      currentAnchorOrg,
      selectedOrg: null,
      changed: false,
    };
  }

  const selectedOrg = orgs.find((org) => String(org._id) === String(selectedAnchorOrgId));

  if (!selectedOrg) {
    return {
      orgs,
      anchorOrg: null,
      currentAnchorOrg,
      selectedOrg: null,
      changed: false,
      invalidSelection: true,
    };
  }

  return {
    orgs,
    anchorOrg: selectedOrg,
    currentAnchorOrg,
    selectedOrg,
    changed: String(currentAnchorOrg._id) !== String(selectedOrg._id),
  };
}

async function getCurrentOwnerAnchorOrganization(ownerId) {
  const orgs = await getOwnerOrganizationsOrdered(ownerId);

  if (!orgs.length) {
    return {
      orgs: [],
      currentAnchorOrg: null,
    };
  }

  const currentAnchorOrg = orgs.find((org) => org.isBillingAnchor === true) || orgs[0];

  return {
    orgs,
    currentAnchorOrg,
  };
}

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

// 🔒 Somente owner/coordenador pode criar checkout de plano
// (orgContext já mapeia owner como 'coordenador' quando necessário)
if (String(req.orgRole || '').toLowerCase() !== 'coordenador') {
  return res.status(403).json({
    error: 'BILLING_FORBIDDEN',
    message: 'Somente o coordenador da organização pode alterar ou assinar planos.',
  });
}
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
    // Aqui a gente só salva IDs e estado "pending" + preserva o plano anterior (MODELO 1 determinístico)
    org.license = org.license || {};

    const prevPlanCode = String(org.license.plan || 'FREE');
    const prevBillingPeriod = org.license.billingPeriod ? String(org.license.billingPeriod) : null;
    const prevPlanEnd = org.license.planEnd ? new Date(org.license.planEnd) : null;

        // ✅ NÃO sobrescrever license.plan/status/billingPeriod aqui.
    // O plano vigente só muda no webhook quando houver confirmação de pagamento.
    org.license.pagarmeSubscriptionId = subscription?.id || null;

    // ✅ rastreio determinístico (para subscription webhooks)
    org.license.pendingPayment = {
      provider: 'pagarme',
      kind: 'subscription',
      subscriptionId: subscription?.id || null,

      previousPlanCode: prevPlanCode,
      previousBillingPeriod: prevBillingPeriod,
      previousPlanEnd: prevPlanEnd && !isNaN(prevPlanEnd.getTime()) ? prevPlanEnd.toISOString() : null,

      planCode: String(planCode),
      billingPeriod: String(periodKey),
      createdByUserId: String(userId || ''),
      createdAt: new Date().toISOString(),
    };

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

// 🔒 Somente owner/coordenador pode assinar plano
if (String(req.orgRole || '').toLowerCase() !== 'coordenador') {
  return res.status(403).json({
    error: 'BILLING_FORBIDDEN',
    message: 'Somente o coordenador da organização pode alterar ou assinar planos.',
  });
}
    const rawPriceCents = getPriceCents(planCode, periodKey);
    const priceCents = Number(rawPriceCents);

    if (!rawPriceCents && rawPriceCents !== 0) {
      return res.status(400).json({ error: 'Invalid plan/period price' });
    }

    if (!Number.isInteger(priceCents) || priceCents <= 0) {
      console.error('[billingController.checkout] invalid priceCents:', { rawPriceCents, priceCents });
      return res.status(400).json({ error: 'Invalid priceCents (must be integer cents)' });
    }

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

    const allowedInstallments = [1, 2, 3, 4, 5, 6, 12];
// ✅ Pix no link (expiração do QR em segundos)
// docs: pix_settings.expires_in é mandatório quando aceitamos "pix"
const PIX_EXPIRES_IN_SECONDS = 60 * 60; // 1h

    // ✅ payload minimalista (Pagar.me: order + installments NÃO aceita installments_setup)
    const payload = {
      is_building: false,
      payment_settings: {
  credit_card_settings: {
    operation_type: 'auth_and_capture',
    installments: allowedInstallments.map((n) => ({
      number: n,
      total: priceCents,
    })),
  },
  // ✅ habilita Pix no mesmo Checkout hospedado
  pix_settings: {
    expires_in: PIX_EXPIRES_IN_SECONDS,
  },
  accepted_payment_methods: ['credit_card', 'pix'],
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

    console.log('[billingController.checkout] payload:', JSON.stringify(payload, null, 2));
    console.log('[billingController.checkout] payload types:', {
      priceCents,
      priceCentsType: typeof priceCents,
      installments: payload?.payment_settings?.credit_card_settings?.installments?.map((it) => ({
        number: it.number,
        numberType: typeof it.number,
        total: it.total,
        totalType: typeof it.total,
      })),
      installments_setup_present: !!payload?.payment_settings?.credit_card_settings?.installments_setup,
    });

    const linkResp = await pagarme.post('/paymentlinks', payload);
    const paymentLink = linkResp?.data;

        org.license = org.license || {};

    // ✅ MODELO 1 (determinístico): snapshot do estado vigente ANTES do pagamento
    // ⚠️ NÃO sobrescrever license.plan/status/billingPeriod aqui.
    // O plano vigente só muda no webhook (order.paid).
    const prevPlanCode = String(org.license.plan || 'FREE');
    const prevBillingPeriod = org.license.billingPeriod ? String(org.license.billingPeriod) : null;
    const prevPlanEnd = org.license.planEnd ? new Date(org.license.planEnd) : null;

    // ✅ casamento do webhook: preferir URL (termina com /pl_xxx) e guardar code separado
    const url = paymentLink?.url || null;

    // tenta obter code do response; se não vier, extrai do final da URL (/pl_xxx)
    const codeFromUrl = (() => {
      try {
        if (!url) return null;
        const parts = String(url).split('/');
        const last = parts[parts.length - 1] || null;
        return last && String(last).startsWith('pl_') ? String(last) : null;
      } catch {
        return null;
      }
    })();

    const paymentLinkCode =
      paymentLink?.code ||
      paymentLink?.integration?.code ||
      codeFromUrl ||
      null;

    // ✅ manter rastreio do link gerado (não mexe no plano vigente)
    org.license.pagarmePaymentLinkId = url || paymentLink?.id || null;

        const ownerAnchorState = await getCurrentOwnerAnchorOrganization(org.owner);
    const currentAnchorOrg = ownerAnchorState.currentAnchorOrg || null;

    // ✅ pendingPayment = intenção de compra (não afeta o plano vigente)
    org.license.pendingPayment = {
      provider: 'pagarme',
      kind: 'order',

      paymentLinkId: paymentLink?.id || null,
      paymentLinkUrl: url,
      paymentLinkCode: paymentLinkCode,

      // ✅ MODELO 1 (fonte de verdade do “plano anterior”)
      previousPlanCode: prevPlanCode,
      previousBillingPeriod: prevBillingPeriod,
      previousPlanEnd: prevPlanEnd && !isNaN(prevPlanEnd.getTime()) ? prevPlanEnd.toISOString() : null,

      // compra solicitada
      planCode: String(planCode),
      billingPeriod: String(periodKey),
      createdByUserId: String(userId || ''),
      createdAt: new Date().toISOString(),

      // ✅ Android/in-app: a org atual do contexto passa a ser a candidata a âncora
      anchorOrgId: String(org._id),
      anchorChangedByApp: !!currentAnchorOrg && String(currentAnchorOrg._id) !== String(org._id),
      previousAnchorOrgId: currentAnchorOrg?._id ? String(currentAnchorOrg._id) : null,
    };
    await org.save();

    return res.json({
      ok: true,
      url: paymentLink?.url || null,
      paymentLinkId: paymentLink?.id || null,
      status: paymentLink?.status || null,
      paymentLink,
    });
  } catch (err) {
    const status = err?.response?.status || null;
    const data = err?.response?.data;
    const reqId =
      err?.response?.headers?.['x-request-id'] ||
      err?.response?.headers?.['request-id'] ||
      err?.response?.headers?.['x-correlation-id'] ||
      null;

    console.error('[billingController.checkout] error RAW:', {
      status,
      reqId,
      message: err?.message,
      data,
    });

    if (data?.errors) {
      console.error('[billingController.checkout] error DETAILS:', JSON.stringify(data.errors, null, 2));
    } else {
      console.error('[billingController.checkout] error DETAILS:', JSON.stringify(data, null, 2));
    }

    return res.status(500).json({ error: 'Failed to create checkout link' });
  }
}

// POST /billing/landing/checkout
// body: {
//   planCode: "1"|"2"|...,
//   billingPeriod: "MONTHLY"|"QUARTERLY"|"YEARLY",
//   selectedAnchorOrgId?: "orgId"
// }
async function landingCheckout(req, res) {
  try {
    const userId = req.user?.id;
    const { planCode, billingPeriod, selectedAnchorOrgId } = req.body || {};
    const periodKey = getBillingPeriod(billingPeriod);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!planCode) {
      return res.status(400).json({ error: 'Missing planCode' });
    }

    if (!periodKey) {
      return res.status(400).json({ error: 'Invalid billingPeriod' });
    }

    const rawPriceCents = getPriceCents(planCode, periodKey);
    const priceCents = Number(rawPriceCents);

    if (!rawPriceCents && rawPriceCents !== 0) {
      return res.status(400).json({ error: 'Invalid plan/period price' });
    }

    if (!Number.isInteger(priceCents) || priceCents <= 0) {
      console.error('[billingController.landingCheckout] invalid priceCents:', {
        rawPriceCents,
        priceCents,
      });
      return res.status(400).json({ error: 'Invalid priceCents (must be integer cents)' });
    }

    const ownerOrgs = await getOwnerOrganizationsOrdered(userId);

    if (!ownerOrgs.length) {
      return res.status(404).json({
        error: 'OWNER_HAS_NO_ORGS',
        message: 'Nenhuma organização encontrada para este usuário.',
      });
    }

    if (ownerOrgs.length > 1 && !selectedAnchorOrgId) {
      const currentAnchorOrg = ownerOrgs.find((org) => org.isBillingAnchor === true) || ownerOrgs[0];

      return res.status(409).json({
        error: 'ANCHOR_SELECTION_REQUIRED',
        message: 'Selecione a organização âncora para continuar a contratação.',
        organizations: ownerOrgs.map((org) => ({
          _id: org._id,
          name: org.name,
          slug: org.slug,
          createdAt: org.createdAt,
          isBillingAnchor: org.isBillingAnchor === true,
          isCurrentFallbackAnchor: String(org._id) === String(currentAnchorOrg._id),
        })),
        currentAnchorOrgId: currentAnchorOrg?._id || null,
      });
    }

    const anchorResolution = await resolveOwnerAnchorOrganization(userId, selectedAnchorOrgId);

    if (anchorResolution.invalidSelection) {
      return res.status(400).json({
        error: 'INVALID_ANCHOR_ORG',
        message: 'A organização selecionada não pertence a este usuário.',
      });
    }

    const org = anchorResolution.anchorOrg;

    if (!org) {
      return res.status(404).json({
        error: 'ANCHOR_ORG_NOT_FOUND',
        message: 'Não foi possível resolver a organização âncora.',
      });
    }

    const pagarme = createPagarmeClient();

    let customerId = org.license?.pagarmeCustomerId || null;

    if (!customerId) {
      const customerPayload = {
        name: org.name || 'WorshipHub Customer',
        email: org.ownerEmail || org.contactEmail || 'no-reply@worshiphub.app',
        metadata: {
          orgId: String(org._id),
          createdByUserId: String(userId || ''),
          flow: 'landing_checkout',
        },
      };

      const customerResp = await pagarme.post('/customers', customerPayload);
      customerId = customerResp?.data?.id;

      org.license = org.license || {};
      org.license.pagarmeCustomerId = customerId;
      await org.save();
    }

    const allowedInstallments = [1, 2, 3, 4, 5, 6, 12];
    const PIX_EXPIRES_IN_SECONDS = 60 * 60;

    const payload = {
      is_building: false,
      payment_settings: {
        credit_card_settings: {
          operation_type: 'auth_and_capture',
          installments: allowedInstallments.map((n) => ({
            number: n,
            total: priceCents,
          })),
        },
        pix_settings: {
          expires_in: PIX_EXPIRES_IN_SECONDS,
        },
        accepted_payment_methods: ['credit_card', 'pix'],
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

    console.log('[billingController.landingCheckout] payload:', JSON.stringify(payload, null, 2));

    const linkResp = await pagarme.post('/paymentlinks', payload);
    const paymentLink = linkResp?.data;

    org.license = org.license || {};

    const prevPlanCode = String(org.license.plan || 'FREE');
    const prevBillingPeriod = org.license.billingPeriod ? String(org.license.billingPeriod) : null;
    const prevPlanEnd = org.license.planEnd ? new Date(org.license.planEnd) : null;

    const url = paymentLink?.url || null;

    const codeFromUrl = (() => {
      try {
        if (!url) return null;
        const parts = String(url).split('/');
        const last = parts[parts.length - 1] || null;
        return last && String(last).startsWith('pl_') ? String(last) : null;
      } catch {
        return null;
      }
    })();

    const paymentLinkCode =
      paymentLink?.code ||
      paymentLink?.integration?.code ||
      codeFromUrl ||
      null;

    org.license.pagarmePaymentLinkId = url || paymentLink?.id || null;

    org.license.pendingPayment = {
      provider: 'pagarme',
      kind: 'order',

      paymentLinkId: paymentLink?.id || null,
      paymentLinkUrl: url,
      paymentLinkCode,

      previousPlanCode: prevPlanCode,
      previousBillingPeriod: prevBillingPeriod,
      previousPlanEnd: prevPlanEnd && !isNaN(prevPlanEnd.getTime()) ? prevPlanEnd.toISOString() : null,

      planCode: String(planCode),
      billingPeriod: String(periodKey),
      createdByUserId: String(userId || ''),
      createdAt: new Date().toISOString(),

      anchorOrgId: String(org._id),
      anchorChangedByLanding: anchorResolution.changed === true,
      previousAnchorOrgId: anchorResolution.currentAnchorOrg?._id
        ? String(anchorResolution.currentAnchorOrg._id)
        : null,
    };

    await org.save();

     return res.json({
      ok: true,
      url: paymentLink?.url || null,
      paymentLinkId: paymentLink?.id || null,
      status: paymentLink?.status || null,
      paymentLink,
      anchorOrg: {
        _id: org._id,
        name: org.name,
        isBillingAnchor: org.isBillingAnchor === true,
        selectedForPendingCheckout: true,
      },
      anchorChanged: anchorResolution.changed === true,
    });

  } catch (err) {
    const status = err?.response?.status || null;
    const data = err?.response?.data;
    const reqId =
      err?.response?.headers?.['x-request-id'] ||
      err?.response?.headers?.['request-id'] ||
      err?.response?.headers?.['x-correlation-id'] ||
      null;

    console.error('[billingController.landingCheckout] error RAW:', {
      status,
      reqId,
      message: err?.message,
      data,
    });

    if (data?.errors) {
      console.error('[billingController.landingCheckout] error DETAILS:', JSON.stringify(data.errors, null, 2));
    } else {
      console.error('[billingController.landingCheckout] error DETAILS:', JSON.stringify(data, null, 2));
    }

    return res.status(500).json({ error: 'Failed to create landing checkout link' });
  }
}

module.exports = { subscribe, catalog, checkout, landingCheckout };
