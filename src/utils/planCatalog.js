// src/utils/planCatalog.js
const PLAN_LABELS = {
  FREE: 'Plano Gratuito',
  '1': 'Prelude',
  '2': 'Chorus',
  '3': 'Harmony',
  '4': 'Anthem',
  '5': 'Maestro',
};

const BILLING = {
  MONTHLY: { label: 'Mensal', months: 1 },
  QUARTERLY: { label: 'Trimestral', months: 3 },
  YEARLY: { label: 'Anual', months: 12 },
};

// ⚠️ Ajuste os valores (centavos) conforme sua precificação real
const PRICES_CENTS = {
  '1': { MONTHLY: 100, QUARTERLY: 150, YEARLY: 200 },
  '2': { MONTHLY: 100, QUARTERLY: 150, YEARLY: 200 },
  '3': { MONTHLY: 100, QUARTERLY: 150, YEARLY: 200 },
  '4': { MONTHLY: 100, QUARTERLY: 150, YEARLY: 200 },
  '5': { MONTHLY: 100, QUARTERLY: 150, YEARLY: 200 },
};

function getPlanLabel(planCode) {
  return PLAN_LABELS[String(planCode)] || `Plano ${planCode}`;
}

function getBillingPeriod(period) {
  const key = String(period || '').toUpperCase();
  return BILLING[key] ? key : null;
}

function getPriceCents(planCode, billingPeriod) {
  const p = PRICES_CENTS[String(planCode)];
  if (!p) return null;
  return p[String(billingPeriod)] ?? null;
}

module.exports = {
  PLAN_LABELS,

  // ✅ mantém export atual (compatibilidade)
  BILLING,

  // ✅ export esperado pelo billingController.catalog (compatibilidade retroativa)
  BILLING_PERIODS: BILLING,

  // ✅ export esperado pelo billingController.catalog (preços no app)
  PRICES_CENTS,

  getPlanLabel,
  getBillingPeriod,
  getPriceCents,
};
