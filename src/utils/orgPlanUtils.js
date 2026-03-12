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
    .select('_id name createdAt license isBillingAnchor');

  // ⚠️ Como os entitlements são por ORGANIZAÇÃO (não por owner),
  // usamos primeiro a org âncora explícita, quando existir.
  // Se não houver âncora marcada, mantemos a compatibilidade total
  // com o fluxo atual usando a PRIMEIRA org como base de referência.
  let ent = null;
  let orgLimit = null;
  let anchorOrg = null;

  if (orgs.length > 0) {
    anchorOrg = orgs.find((org) => org.isBillingAnchor === true) || orgs[0];
    ent = getEntitlementsFor(anchorOrg);
    orgLimit = ent?.limits?.orgsPerOwner ?? null;
  } else {
    // ✅ Blindagem: usuário pode não ser owner de nenhuma org (ex.: entrou apenas por convite)
    // Nesses casos, não podemos deixar entitlements nulo, pois /api/orgs/mine pode depender disso.
    ent = getEntitlementsFor({ license: { plan: 'FREE' } });
    orgLimit = ent?.limits?.orgsPerOwner ?? null;
  }

  // ✅ Prioriza a org âncora na distribuição das orgs ativas.
  // As demais mantêm a ordem original de criação.
  const prioritizedOrgs = anchorOrg
    ? [
        anchorOrg,
        ...orgs.filter((org) => String(org._id) !== String(anchorOrg._id)),
      ]
    : orgs;

  if (orgLimit === null) {
    // Sem limite: tudo ativo
    return {
      entitlements: ent,
      activeOrgIds: prioritizedOrgs.map((o) => String(o._id)),
      lockedOrgIds: [],
      orgs,
    };
  }

  const activeOrgIds = [];
  const lockedOrgIds = [];

  prioritizedOrgs.forEach((org, index) => {
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
