// src/utils/orgPlanUtils.js
const Organization = require('../models/Organization');
const { getEntitlementsFor } = require('./entitlements'); 
// usamos o helper oficial baseado na ORGANIZAÇÃO, não em owner

/**
 * Retorna as organizações do dono separadas por status de plano.
 */
async function getOwnerOrgsPlanState(ownerId) {
  // 1) Buscar todas as orgs do dono, em ordem de criação
  const orgs = await Organization.find({ owner: ownerId })
    .sort({ createdAt: 1, _id: 1 })
    .select('_id name createdAt license');

  // ⚠️ Como os entitlements agora são por ORGANIZAÇÃO (não por owner),
  // usamos a PRIMEIRA org como base de referência
  // (mantendo compatibilidade com o fluxo existente).
  let ent = null;
  let orgLimit = null;

  if (orgs.length > 0) {
    ent = getEntitlementsFor(orgs[0]);
    orgLimit = ent?.limits?.orgsPerOwner ?? null;
  } else {
    // ✅ Blindagem: usuário pode não ser owner de nenhuma org (ex.: entrou apenas por convite)
    // Nesses casos, não podemos deixar entitlements nulo, pois /api/orgs/mine pode depender disso.
    ent = getEntitlementsFor({ license: { plan: 'FREE' } });
    orgLimit = ent?.limits?.orgsPerOwner ?? null;
  }

  if (orgLimit === null) {
    // Sem limite: tudo ativo
    return {
      entitlements: ent,
      activeOrgIds: orgs.map(o => String(o._id)),
      lockedOrgIds: [],
      orgs,
    };
  }

  const activeOrgIds = [];
  const lockedOrgIds = [];

  orgs.forEach((org, index) => {
    const id = String(org._id);
    if (index < orgLimit) {
      activeOrgIds.push(id);
    } else {
      lockedOrgIds.push(id);
    }
  });

  return {
    entitlements: ent,
    activeOrgIds,
    lockedOrgIds,
    orgs,
  };
}

module.exports = {
  getOwnerOrgsPlanState,
};
