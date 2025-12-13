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
// ---------- Planos base ----------
const PLAN_MATRIX = {
  // FREE continua sendo o plano demo, com limites bem restritos
  FREE: {
    plan: 'FREE',
    write: { allowed: true, mode: 'limited' }, // pós-trial: escrita com limites (aplicar limitsGuard)
    features: {
      // FREE não pode trabalhar com equipes
      teams: false,
      statsBasic: true,
      statsAdvanced: false,
      palettePicker: true,
      duplicateEvent: false,
      attachments: true,
      chat: true,
      pushNotifications: true,
    },
    limits: {
      eventsPerMonth: 6,
      planningHorizonDays: 20,   // criar/editar eventos até D+20
      songsPerEvent: 2,
      attachmentsPerEvent: 1,
      storageMB: 500,            // cota total por org (indicativa; tratar no upload se desejar)
      teamsPerOrg: 0,            // FREE: não pode criar equipes
      membersPerTeam: null,
      // campos extras não são relevantes para o FREE por enquanto
      repertoireHistoryDays: 7,
      dmsPerOrg: 1,
      orgsPerOwner: 1,
    },
  },

  // PLANO 1 (coluna "1" da planilha)
  '1': {
    plan: '1',
    write: { allowed: true, mode: 'limited' },
    features: {
      teams: true,
      statsBasic: false,
      statsAdvanced: false,
      palettePicker: false,
      duplicateEvent: false,
      attachments: true,
      chat: true,
      pushNotifications: true,
      editBandRoles: false,
      exportScale: false,
      externalLinks: false,
    },
    limits: {
      eventsPerMonth: 15,
      planningHorizonDays: 40,   // criar escala/evento até D+40
      songsPerEvent: 5,
      attachmentsPerEvent: 2,
      storageMB: null,
      teamsPerOrg: 1,
      membersPerTeam: null,
      repertoireHistoryDays: 30,  // 30 dias de histórico
      dmsPerOrg: 2,
      orgsPerOwner: 1,
    },
  },

  // PLANO 2 (coluna "2")
  '2': {
    plan: '2',
    write: { allowed: true, mode: 'limited' },
    features: {
      teams: true,
      statsBasic: false,
      statsAdvanced: false,
      palettePicker: true,
      duplicateEvent: false,
      attachments: true,
      chat: true,
      pushNotifications: true,
      editBandRoles: true,
      exportScale: true,
      externalLinks: false,
    },
    limits: {
      eventsPerMonth: 20,
      planningHorizonDays: 60,   // até D+60
      songsPerEvent: 5,
      attachmentsPerEvent: 2,
      storageMB: null,
      teamsPerOrg: 2,
      membersPerTeam: null,
      repertoireHistoryDays: 30,
      dmsPerOrg: 3,
      orgsPerOwner: 1,
    },
  },

  // PLANO 3 (coluna "3")
  '3': {
    plan: '3',
    write: { allowed: true, mode: 'limited' },
    features: {
      teams: true,
      statsBasic: true,          // estatísticas iniciais liberadas
      statsAdvanced: false,
      palettePicker: true,
      duplicateEvent: true,      // Botões meus/todos + duplicar evento = SIM
      attachments: true,
      chat: true,
      pushNotifications: true,
      editBandRoles: true,
      exportScale: true,
      externalLinks: true,
    },
    limits: {
      eventsPerMonth: 30,
      planningHorizonDays: 90,   // até D+90
      songsPerEvent: 8,
      attachmentsPerEvent: 5,
      storageMB: null,
      teamsPerOrg: 3,
      membersPerTeam: null,
      repertoireHistoryDays: 90,
      dmsPerOrg: 4,
      orgsPerOwner: 2,
    },
  },

  // PLANO 4 (coluna "4")
  '4': {
    plan: '4',
    write: { allowed: true, mode: 'limited' },
    features: {
      teams: true,
      statsBasic: true,
      statsAdvanced: true,       // estatísticas completas
      palettePicker: true,
      duplicateEvent: true,
      attachments: true,
      chat: true,
      pushNotifications: true,
      editBandRoles: true,
      exportScale: true,
      externalLinks: true,
    },
    limits: {
      eventsPerMonth: 30,
      planningHorizonDays: null, // sem limite de antecedência
      songsPerEvent: 10,
      attachmentsPerEvent: 10,
      storageMB: null,
      teamsPerOrg: 5,
      membersPerTeam: null,
      repertoireHistoryDays: 180,
      dmsPerOrg: 5,
      orgsPerOwner: 4,
    },
  },

  // PLANO 5 (coluna "5")
  '5': {
    plan: '5',
    write: { allowed: true, mode: 'limited' },
    features: {
      teams: true,
      statsBasic: true,
      statsAdvanced: true,
      palettePicker: true,
      duplicateEvent: true,
      attachments: true,
      chat: true,
      pushNotifications: true,
      editBandRoles: true,
      exportScale: true,         // "Ilimitado" na planilha → flag sempre true
      externalLinks: true,
    },
    limits: {
      eventsPerMonth: null,      // Ilimitado
      planningHorizonDays: null, // sem limite
      songsPerEvent: null,       // Ilimitado
      attachmentsPerEvent: null, // Ilimitado
      storageMB: null,
      teamsPerOrg: null,         // SIM (sem teto explícito)
      membersPerTeam: null,
      repertoireHistoryDays: 365,
      dmsPerOrg: null,           // Ilimitado
      orgsPerOwner: 5,
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

  const normalized = String(plan).toUpperCase();

  // Agora os planos válidos são: FREE, '1', '2', '3', '4', '5'
  if (Object.prototype.hasOwnProperty.call(PLAN_MATRIX, normalized)) {
    return normalized;
  }

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
    // Durante o trial, emprestamos as permissões do plano mais alto (5)
    const trialPlanKey = '5';
    const trialBase = PLAN_MATRIX[trialPlanKey] || PLAN_MATRIX.FREE;

    entitlements = deepMerge(entitlements, {
      write: trialBase.write,       // modo de escrita do plano 5
      features: trialBase.features, // todas as features do plano 5
      limits: trialBase.limits,     // limites do plano 5 (quase tudo ilimitado)
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
