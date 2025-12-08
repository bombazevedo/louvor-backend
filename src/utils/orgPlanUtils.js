// src/utils/orgPlanUtils.js
const Organization = require('../models/Organization');
const { getEntitlementsForOwner } = require('./entitlementsService'); 
// use o nome real do seu helper de entitlements

/**
 * Retorna as organizações do dono separadas por status de plano.
 */
async function getOwnerOrgsPlanState(ownerId) {
  // 1) Entitlements do dono (plano e limites)
  const ent = await getEntitlementsForOwner(ownerId);
  const orgLimit = ent?.limits?.orgsPerOwner ?? null;

  // 2) Buscar todas as orgs do dono, em ordem de criação
  const orgs = await Organization.find({ owner: ownerId })
    .sort({ createdAt: 1, _id: 1 }) // fallback por _id se não tiver createdAt
    .select('_id name createdAt');

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
