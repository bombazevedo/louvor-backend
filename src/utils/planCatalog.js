// src/utils/planCatalog.js
const PLAN_LABELS = {
  FREE: 'Plano Gratuito',
  '1': 'One',
  '2': 'teste de planos',
  '3': 'Plano 3',
  '4': 'Plano 4',
  '5': 'Plano 5',
};

const BILLING = {
  MONTHLY: { label: 'Mensal', months: 1 },
  QUARTERLY: { label: 'Trimestral', months: 3 },
  YEARLY: { label: 'Anual', months: 12 },
};

// ⚠️ Ajuste os valores (centavos) conforme sua precificação real
const PRICES_CENTS = {
  '1': { MONTHLY: 1990, QUARTERLY: 5490, YEARLY: 19900 },
  '2': { MONTHLY: 2990, QUARTERLY: 8490, YEARLY: 29900 },
  '3': { MONTHLY: 3990, QUARTERLY: 11490, YEARLY: 39900 },
  '4': { MONTHLY: 4990, QUARTERLY: 14490, YEARLY: 49900 },
  '5': { MONTHLY: 5990, QUARTERLY: 17490, YEARLY: 59900 },
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
  BILLING,
  getPlanLabel,
  getBillingPeriod,
  getPriceCents,
};
