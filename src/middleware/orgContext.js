const mongoose = require('mongoose');
const OrgMember = require('../models/OrgMember');
const Organization = require('../models/Organization');

module.exports = async function orgContext(req, res, next) {
  try {
    const orgId = req.header('x-org-id') || req.user?.activeOrgId;

    console.log('[orgContext] x-org-id:', req.header('x-org-id'), '| activeOrgId:', req.user?.activeOrgId);

    if (!orgId || !mongoose.isValidObjectId(orgId)) {
      return res.status(400).json({ error: 'ORG_REQUIRED', message: 'Cabeçalho x-org-id é obrigatório.' });
    }

    // 🔧 normaliza o ID do usuário autenticado
    const userId = (req.user && (req.user._id || req.user.id)) || req.userId || (req.auth && req.auth.id);

    const membership = await OrgMember.findOne({ org: orgId, user: userId }).lean();

    // 🔓 permite owner operar mesmo sem membership explícito
    const isOwner = await Organization.exists({ _id: orgId, owner: userId });
    if (!membership && !isOwner) return res.status(403).json({ error: 'ORG_FORBIDDEN' });

    const org = await Organization.findById(orgId).lean();
    if (!org) return res.status(404).json({ error: 'ORG_NOT_FOUND' });

    // 🔒 Trava determinística: se a org estiver além do limite do plano do owner, bloqueia também no backend
    // (fecha bypass via header x-org-id fora do app / clientes alternativos)
    try {
      const { getOwnerOrgsPlanState } = require('../utils/orgPlanUtils');

      const ownerId = org.owner;
      if (ownerId) {
        const planState = await getOwnerOrgsPlanState(ownerId);
        const lockedOrgIds = (planState && planState.lockedOrgIds) ? planState.lockedOrgIds : [];

        if (lockedOrgIds.includes(String(orgId))) {
          return res.status(403).json({
            error: 'ORG_LOCKED_BY_PLAN',
            message: 'Esta organização está travada pelo limite do plano. Faça upgrade para continuar.',
          });
        }
      }
    } catch (lockErr) {
      // Falha no cálculo do lock não pode derrubar o app; seguimos o fluxo normal (fail-open com log)
      console.error('[orgContext] lock-check erro:', lockErr);
    }

    req.orgId  = orgId;
    req.orgRole = isOwner ? 'coordenador' : membership.role;
    req._org   = org; // cache p/ licenseGuard

    console.log('[orgContext] resolved orgId:', req.orgId, '| orgRole:', req.orgRole, '| license.plan:', req._org?.license?.plan);

    next();
  } catch (err) {
    console.error('[orgContext] erro:', err);
    res.status(500).json({ error: 'ORG_CONTEXT_ERROR' });
  }
};
