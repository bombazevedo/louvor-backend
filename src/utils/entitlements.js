/**
 * src/utils/entitlements.js
 *
 * Matriz de planos + cálculo de trial e entitlements por organização.
 * Não depende de DB; recebe o documento da organização (ex.: req._org).
 *
 * Convenções:
 * - Se algum limite for "ilimitado", usamos null.
 * - "write.mode": "full" | "limited" | "blocked"
 *   - full    -> sem restrições de escrita pela licença (ainda pode haver limites funcionais do app).
 *   - limited -> escrita permitida com limites (usar limitsGuard).
 *   - blocked -> escrita bloqueada (read-only).
 *
 * Overrides:
 * - org.license.overrides pode ajustar qualquer campo de entitlements.
 *   Ex.: { limits: { songsPerEvent: 6 }, features: { duplicateEvent: true } }
 */

const TRIAL_DAYS_DEFAULT = 14;

// ---------- Planos base ----------
const PLAN_MATRIX = {
  FREE: {
    plan: 'FREE',
    write: { allowed: true, mode: 'limited' }, // pós-trial: escrita com limites (aplicar limitsGuard)
    features: {
      teams: true,
      statsBasic: true,
      statsAdvanced: false,
      palettePicker: true,
      duplicateEvent: false,
      attachments: true,
      chat: true,
      pushNotifications: true,
    },
    limits: {
      eventsPerMonth: 8,
      planningHorizonDays: 20,   // criar/editar eventos até D+20
      songsPerEvent: 4,
      attachmentsPerEvent: 5,
      storageMB: 500,            // cota total por org (indicativa; tratar no upload se desejar)
      teamsPerOrg: null,         // null = sem teto explícito pelo plano
      membersPerTeam: null,
    },
  },

  PRO: {
    plan: 'PRO',
    write: { allowed: true, mode: 'full' },
    features: {
      teams: true,
      statsBasic: true,
      statsAdvanced: true,
      palettePicker: true,
      duplicateEvent: false,
      attachments: true,
      chat: true,
      pushNotifications: true,
    },
    limits: {
      eventsPerMonth: 60,
      planningHorizonDays: 180,
      songsPerEvent: 20,
      attachmentsPerEvent: 30,
      storageMB: 5000,
      teamsPerOrg: null,
      membersPerTeam: null,
    },
  },

  PLUS: {
    plan: 'PLUS',
    write: { allowed: true, mode: 'full' },
    features: {
      teams: true,
      statsBasic: true,
      statsAdvanced: true,
      palettePicker: true,
      duplicateEvent: true,      // recurso exclusivo do Plus
      attachments: true,
      chat: true,
      pushNotifications: true,
    },
    limits: {
      eventsPerMonth: null,
      planningHorizonDays: null,
      songsPerEvent: null,
      attachmentsPerEvent: null,
      storageMB: null,
      teamsPerOrg: null,
      membersPerTeam: null,
    },
  },
};

// ---------- Helpers ----------
function coerceDate(d) {
  try {
    return d ? new Date(d) : null;
  } catch {
    return null;
  }
}

function isTrialActive(org) {
  if (!org || !org.license) return false;
  // status pode vir "trial" ou afins; priorizamos datas
  const { trialStart, trialEnd, status } = org.license || {};
  const now = new Date();

  // Se trialEnd existir, usa a data; senão, infere por status e TRIAL_DAYS_DEFAULT
  const start = coerceDate(trialStart) || (status === 'trial' ? now : null);
  const end =
    coerceDate(trialEnd) ||
    (status === 'trial' && start
      ? new Date(start.getTime() + TRIAL_DAYS_DEFAULT * 24 * 60 * 60 * 1000)
      : null);

  return !!(start && end && now >= start && now <= end);
}

function resolvePlan(org) {
  // Se a organização não tem plano definido, assume FREE.
  const plan =
    (org && org.license && (org.license.plan || org.license.status)) || 'FREE';
  // Normaliza para FREE/PRO/PLUS
  const normalized = String(plan).toUpperCase();
  if (['FREE', 'PRO', 'PLUS'].includes(normalized)) return normalized;
  // status "trial" não é plano; será tratado no getEntitlementsFor
  return 'FREE';
}

function deepMerge(target, source) {
  if (!source) return target;
  const out = Array.isArray(target) ? [...target] : { ...target };
  Object.keys(source).forEach((key) => {
    const sv = source[key];
    if (
      sv &&
      typeof sv === 'object' &&
      !Array.isArray(sv) &&
      typeof out[key] === 'object' &&
      out[key] !== null &&
      !Array.isArray(out[key])
    ) {
      out[key] = deepMerge(out[key], sv);
    } else {
      out[key] = sv;
    }
  });
  return out;
}

// ---------- API principal ----------
function getEntitlementsFor(org) {
  // Base pelo plano
  const plan = resolvePlan(org);
  const base = PLAN_MATRIX[plan] || PLAN_MATRIX.FREE;

  // Clona para não mutar
  let entitlements = JSON.parse(JSON.stringify(base));

  // Trial ativo “eleva” temporariamente para modo completo (sem mudar o rótulo do plano)
  const inTrial = isTrialActive(org);
  if (inTrial) {
    const plus = PLAN_MATRIX.PLUS;
    entitlements = deepMerge(entitlements, {
      write: plus.write,          // full
      features: plus.features,    // tudo habilitado
      // você pode optar por "emprestar" limites do PLUS durante o trial
      limits: plus.limits,
    });
  }

  // Aplica overrides opcionais definidos na organização
  // Ex.: org.license.overrides = { limits: { songsPerEvent: 6 } }
  const overrides =
    (org && org.license && (org.license.overrides || org.license.entitlements)) ||
    null;

  if (overrides) {
    entitlements = deepMerge(entitlements, overrides);
  }

  // Metadados úteis para o app/middlewares
  const trialEndsAt =
    (org && org.license && (org.license.trialEnd || org.license.trialEndsAt)) ||
    null;

  return {
    plan: entitlements.plan,         // FREE | PRO | PLUS (rótulo base)
    inTrial,
    trialEndsAt,
    write: entitlements.write,       // { allowed, mode }
    features: entitlements.features, // flags de features
    limits: entitlements.limits,     // números (null = ilimitado)
  };
}

module.exports = {
  TRIAL_DAYS_DEFAULT,
  PLAN_MATRIX,
  isTrialActive,
  resolvePlan,
  getEntitlementsFor,
};
