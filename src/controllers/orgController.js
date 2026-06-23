const crypto = require('crypto');
const Organization = require('../models/Organization');
const OrgMember = require('../models/OrgMember');
const Event = require('../models/Event');
const Scale = require('../models/Scale');
const Team = require('../models/Team');
const { getEntitlementsFor } = require('../utils/entitlements'); // ✅ adição pontual
const { getOwnerOrgsPlanState } = require('../utils/orgPlanUtils');
const { getPlanLabel } = require('../utils/planCatalog'); // ✅ NOVO (nome fantasia)
const User = require('../models/User');
const { syncTrialContactToBrevo } = require('../services/brevoService');

const slugify = (s) => s.normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^\w\s-]/g, '')
  .trim()
  .replace(/\s+/g, '-')
  .toLowerCase();

exports.createOrg = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'NAME_REQUIRED' });

    // ✅ pega o ID do usuário autenticado em formatos comuns (id, _id, req.userId)
    const ownerId = (req.user && (req.user.id || req.user._id)) || req.userId || (req.auth && req.auth.id);
    if (!ownerId) return res.status(401).json({ error: 'AUTH_REQUIRED' });

    // 🔐 LIMITE DE ORGANIZAÇÕES POR DONO, CONFORME PLANO
    const state = await getOwnerOrgsPlanState(ownerId);
    const ent = state?.entitlements || getEntitlementsFor({ license: { plan: 'FREE' } });

    const orgLimit = ent?.limits?.orgsPerOwner ?? null;
    const currentCount = (state?.orgs || []).length;

    if (orgLimit !== null && currentCount >= orgLimit) {
      return res.status(403).json({
        error: 'ORG_LIMIT_REACHED',
        message: `Seu plano permite criar até ${orgLimit} organização(ões). Exclua uma organização ou faça upgrade para criar novas.`,
        plan: ent?.plan || 'FREE',
        inTrial: !!ent?.inTrial,
        allowed: orgLimit,
        current: currentCount,
      });
    }

    const slug = slugify(name);
    const exists = await Organization.findOne({ slug });
    if (exists) return res.status(409).json({ error: 'ORG_SLUG_TAKEN' });

    const existingOwnerOrgs = await Organization.find({ owner: ownerId })
      .sort({ createdAt: 1, _id: 1 })
      .select('_id isBillingAnchor')
      .lean();

    const shouldBeBillingAnchor = existingOwnerOrgs.length === 0;

    let licensePayload = null;

    if (shouldBeBillingAnchor) {
      // ✅ primeira organização do owner: mantém trial determinístico de 14 dias
      const trialStartsAt = new Date();
      const trialEndsAt = new Date(trialStartsAt.getTime() + 14 * 24 * 60 * 60 * 1000);

      licensePayload = {
        status: 'trial',
        plan: 'FREE',
        trialStartsAt,
        trialEndsAt,
      };
    } else {
      // ✅ organização filha: herda a licença da organização âncora
      const billingAnchorRef =
        existingOwnerOrgs.find((item) => item.isBillingAnchor === true) ||
        existingOwnerOrgs[0] ||
        null;

      if (!billingAnchorRef?._id) {
        return res.status(500).json({ error: 'BILLING_ANCHOR_NOT_FOUND' });
      }

      const billingAnchor = await Organization.findById(billingAnchorRef._id)
        .select('license')
        .lean();

      if (!billingAnchor) {
        return res.status(500).json({ error: 'BILLING_ANCHOR_NOT_FOUND' });
      }

      const anchorLicense = billingAnchor.license || {};
      const anchorStatus = anchorLicense.status || 'active';
      const isAnchorInTrial = anchorStatus === 'trial';

      licensePayload = {
        status: anchorStatus,
        plan: anchorLicense.plan || 'FREE',
        billingPeriod: anchorLicense.billingPeriod || null,
        planStart: anchorLicense.planStart || anchorLicense.planStartsAt || null,
        planEnd: anchorLicense.planEnd || anchorLicense.planExpiresAt || null,
        trialStartsAt: isAnchorInTrial
          ? (anchorLicense.trialStartsAt || null)
          : null,
        trialEndsAt: isAnchorInTrial
          ? (anchorLicense.trialEndsAt || null)
          : null,
      };
    }

    const org = await Organization.create({
      name,
      slug,
      owner: ownerId,
      isBillingAnchor: shouldBeBillingAnchor,
      license: licensePayload,
    });

await OrgMember.create({ org: org._id, user: ownerId, role: 'coordenador' });

if (shouldBeBillingAnchor && org?.license?.status === 'trial') {
  const ownerUser = await User.findById(ownerId).select('name email').lean();

  syncTrialContactToBrevo({
    user: ownerUser,
    org,
  }).catch((err) => {
    console.warn('[createOrg] Brevo sync async error:', err?.message || err);
  });
}

res.status(201).json({ org });
  } catch (err) {
    console.error('[createOrg] err', err);
    res.status(500).json({ error: 'CREATE_ORG_ERROR' });
  }
};

exports.generateInvite = async (req, res) => {
  try {
    const { id } = req.params; // orgId

    // 🔧 normaliza o ID do usuário autenticado
    const userId = (req.user && (req.user._id || req.user.id)) || req.userId || (req.auth && req.auth.id);

    // 🔒 owner também pode convidar (mesmo sem membership explícito)
    const org = await Organization.findById(id).lean();
    if (!org) return res.status(404).json({ error: 'ORG_NOT_FOUND' });
    const isOwner = String(org.owner) === String(userId);

    const membership = await OrgMember.findOne({ org: id, user: userId }).lean();
    if (!isOwner && (!membership || membership.role !== 'coordenador')) {
      return res.status(403).json({ error: 'INVITE_FORBIDDEN' });
    }

    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    const updated = await Organization.findByIdAndUpdate(
      id,
      { $push: { invites: { code, createdBy: userId } } },
      { new: true }
    ).lean();
    res.json({ code, org: updated._id });
  } catch (err) {
    console.error('[generateInvite] err', err);
    res.status(500).json({ error: 'GENERATE_INVITE_ERROR' });
  }
};

exports.joinByCode = async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'CODE_REQUIRED' });

    const org = await Organization.findOne({ 'invites.code': code.toUpperCase() }).lean();
    if (!org) return res.status(404).json({ error: 'INVITE_NOT_FOUND' });

    // 🔧 normaliza o ID do usuário autenticado (correção pontual)
    const userId = (req.user && (req.user._id || req.user.id)) || req.userId || (req.auth && req.auth.id);

    await OrgMember.updateOne(
      { org: org._id, user: userId },
      { $setOnInsert: { role: 'usuario', joinedAt: new Date() } },
      { upsert: true }
    );

    res.json({ orgId: org._id });
  } catch (err) {
    console.error('[joinByCode] err', err);
    res.status(500).json({ error: 'JOIN_INVITE_ERROR' });
  }
};

exports.myOrgs = async (req, res) => {
  try {
    const userId = (req.user && (req.user._id || req.user.id)) || req.userId || (req.auth && req.auth.id);

    // 🔐 Estado de plano do dono: quais orgs dele estão ativas e quais estão travadas pelo limite
    const state = await getOwnerOrgsPlanState(userId);
const ent = state.entitlements || getEntitlementsFor({ license: { plan: 'FREE' } });
const lockedSet = new Set((state.lockedOrgIds || []).map(id => String(id)));

const memberships = await OrgMember.find({ user: userId })
  .populate('org', 'name slug license logoUrl cloudinaryPublicId owner isBillingAnchor createdAt')
  .lean();

     // 🔎 incluir também as orgs onde o usuário é owner (fallback caso não exista membership)
    const memberOrgIdsRaw = memberships.map(m => String(m.org?._id || m.org));

    // ✅ FIX: remove "null"/"undefined" e qualquer lixo antes do $nin (evita CastError)
    const memberOrgIds = memberOrgIdsRaw.filter(id => /^[0-9a-fA-F]{24}$/.test(String(id)));

const ownedButNotMember = await Organization.find({
  owner: userId,
  _id: { $nin: memberOrgIds }
})
  .select('_id name slug license logoUrl cloudinaryPublicId owner isBillingAnchor createdAt')
  .lean();

const DEFAULT_PLAN = 'FREE';

const normalizeOrgForResponse = (orgDoc, lockedByPlan) => {
  if (!orgDoc) return null;

  const license = orgDoc.license || {};
  const normalizedPlan = license.plan || DEFAULT_PLAN;

  const normalizedLicense = {
    ...license,
    plan: normalizedPlan,
    planLabel: getPlanLabel(normalizedPlan), // ✅ NOVO: nome fantasia vindo do backend
  };

  return {
    ...orgDoc,
    license: normalizedLicense,
    lockedByPlan: !!lockedByPlan,
  };
};

const sortMyOrgsForResponse = (a, b) => {
  const aLocked = !!a?.org?.lockedByPlan;
  const bLocked = !!b?.org?.lockedByPlan;

  // ✅ orgs válidas primeiro; travadas por plano ficam por último
  if (aLocked !== bLocked) return aLocked ? 1 : -1;

  const aAnchor = !!a?.org?.isBillingAnchor;
  const bAnchor = !!b?.org?.isBillingAnchor;

  // ✅ entre as válidas, a âncora vem primeiro
  if (aAnchor !== bAnchor) return aAnchor ? -1 : 1;

  const aCreatedAt = a?.org?.createdAt ? new Date(a.org.createdAt).getTime() : 0;
  const bCreatedAt = b?.org?.createdAt ? new Date(b.org.createdAt).getTime() : 0;

  // ✅ fallback determinístico: mais antigas primeiro
  if (aCreatedAt !== bCreatedAt) return aCreatedAt - bCreatedAt;

  return String(a?.org?._id || '').localeCompare(String(b?.org?._id || ''));
};

const response = [
  // Orgs onde o usuário é membro (pode ou não ser dono)
  ...memberships
    .map(m => {
      if (!m.org) {
        console.warn('[myOrgs] membership com org=null (referência quebrada). Ignorando.', {
          userId: String(userId),
          membershipId: String(m?._id),
          orgId: String(m?.org),
        });
        return null;
      }

      const orgNormalized = normalizeOrgForResponse(
        m.org,
        lockedSet.has(String(m.org?._id))
      );

      if (!orgNormalized) return null;

      return {
        org: orgNormalized,
        role: m.role
      };
    })
    .filter(Boolean),

  // Orgs onde o usuário é dono mas não tem membership explícito
  ...ownedButNotMember
    .map(o => {
      const orgNormalized = normalizeOrgForResponse(
        {
          _id: o._id,
          name: o.name,
          slug: o.slug,
          license: o.license,
          logoUrl: o.logoUrl,
          cloudinaryPublicId: o.cloudinaryPublicId,
          owner: o.owner,
          isBillingAnchor: o.isBillingAnchor,
          createdAt: o.createdAt,
        },
        lockedSet.has(String(o._id))
      );

      if (!orgNormalized) return null;

      return {
        org: orgNormalized,
        role: 'coordenador'
      };
    })
    .filter(Boolean)
];

response.sort(sortMyOrgsForResponse);

    res.json({
      orgs: response,
      plan: ent.plan,
      planLabel: getPlanLabel(ent.plan), // ✅ NOVO: label geral do plano do usuário/dono
      inTrial: !!ent.inTrial,
      limits: {
        orgsPerOwner: ent.limits?.orgsPerOwner ?? null,
      },
    });
  } catch (err) {
    console.error('[myOrgs] err', err);
    res.status(500).json({ error: 'MY_ORGS_ERROR' });
  }
};

// 👇 NOVO: atualizar logo da organização
exports.updateLogo = async (req, res) => {
  try {
    const { id } = req.params; // orgId
    const { logoUrl, cloudinaryPublicId } = req.body;

    if (!logoUrl || !cloudinaryPublicId) {
      return res.status(400).json({ error: 'LOGO_DATA_REQUIRED' });
    }

    // mesmo critério de permissão do generateInvite: owner ou coordenador
    const userId = (req.user && (req.user._id || req.user.id)) || req.userId || (req.auth && req.auth.id);

    const org = await Organization.findById(id).lean();
    if (!org) return res.status(404).json({ error: 'ORG_NOT_FOUND' });

    const isOwner = String(org.owner) === String(userId);
    const membership = await OrgMember.findOne({ org: id, user: userId }).lean();

    if (!isOwner && (!membership || membership.role !== 'coordenador')) {
      return res.status(403).json({ error: 'UPDATE_LOGO_FORBIDDEN' });
    }

    const updated = await Organization.findByIdAndUpdate(
      id,
      {
        $set: {
          logoUrl,
          cloudinaryPublicId,
        },
      },
      { new: true }
    ).lean();

    return res.json({ org: updated });
  } catch (err) {
    console.error('[updateLogo] err', err);
    return res.status(500).json({ error: 'UPDATE_LOGO_ERROR' });
  }
};

// ✅ remover membro da organização (multi-igrejas) — NÃO apaga o User global
exports.removeMember = async (req, res) => {
  try {
    const { id: orgId, userId: targetUserId } = req.params;

    // normaliza userId autenticado
    const userId =
      (req.user && (req.user._id || req.user.id)) ||
      req.userId ||
      (req.auth && req.auth.id);

    const org = await Organization.findById(orgId).lean();
    if (!org) return res.status(404).json({ error: 'ORG_NOT_FOUND' });

    const isOwner = String(org.owner) === String(userId);

   // precisa ser owner ou coordenador da org
    const membership = await OrgMember.findOne({ org: orgId, user: userId }).lean();
    const isCoordinator = membership && membership.role === 'coordenador';

    // ✅ self-leave: o próprio usuário pode sair da org (desde que seja membro)
    const isSelfLeave = String(targetUserId) === String(userId);

    if (!isSelfLeave && !isOwner && !isCoordinator) {
      return res.status(403).json({ error: 'REMOVE_MEMBER_FORBIDDEN' });
    }

    // se for self-leave e não existe membership, não permite (evita abuso/ruído)
    if (isSelfLeave && !membership) {
      return res.status(403).json({ error: 'REMOVE_MEMBER_FORBIDDEN' });
    }
    // não permitir remover o owner da org (segurança mínima)
    if (String(org.owner) === String(targetUserId)) {
      return res.status(403).json({ error: 'CANNOT_REMOVE_OWNER' });
    }

    const result = await OrgMember.deleteOne({ org: orgId, user: targetUserId });

    // idempotente: se não existia, retorna ok mesmo assim
    return res.json({ ok: true, removed: result?.deletedCount ? 1 : 0 });
  } catch (err) {
    console.error('[removeMember] err', err);
    return res.status(500).json({ error: 'REMOVE_MEMBER_ERROR' });
  }
};

// ✅ novo método (Passo 5): status de licença/entitlements da organização ativa
exports.getLicense = async (req, res) => {
  try {
    // orgContext injeta req._org e req.orgId; usamos req._org como verdade
    const org = req._org || await Organization.findById(req.params.id).lean();
    if (!org) return res.status(404).json({ error: 'ORG_NOT_FOUND' });

    const ent = getEntitlementsFor(org);

    // 🔎 Lemos os campos de assinatura diretamente da licença da organização
    const license = org.license || {};
        const planStart =
      license.planStart || license.planStartsAt || null;

    let planEnd =
      license.planEnd || license.planExpiresAt || null;

    const billingPeriod = license.billingPeriod || null; // 'MONTHLY'|'QUARTERLY'|'YEARLY' ou legado ('monthly'|'quarterly'|'annual') ou null
    const billingKey = billingPeriod ? String(billingPeriod).toUpperCase() : null;

    // ✅ inferência de planEnd quando não está salvo na licença:
    // usa planStart + billingPeriod (sem gravar no banco; apenas resposta)
    if (!planEnd && planStart && billingKey) {
      const start = new Date(planStart);
      if (!isNaN(start.getTime())) {
        const derived = new Date(start);

        if (billingKey === 'MONTHLY') derived.setMonth(derived.getMonth() + 1);
        else if (billingKey === 'QUARTERLY') derived.setMonth(derived.getMonth() + 3);
        else if (billingKey === 'YEARLY' || billingKey === 'ANNUAL') derived.setFullYear(derived.getFullYear() + 1);

        planEnd = derived.toISOString();
      }
    }

    return res.json({
      plan: ent.plan,           // FREE | '1' | '2' | '3' | '4' | '5' (código base)
      inTrial: ent.inTrial,     // true/false
      trialEndsAt: ent.trialEndsAt || null,

      // 🔹 Infos de assinatura paga (para AboutScreen e futuras telas de planos)
      planStart,
      planEnd,
      billingPeriod,

      entitlements: ent         // write/features/limits completos para o app
    });
  } catch (err) {
    console.error('[getLicense] err', err);
    return res.status(500).json({ error: 'GET_LICENSE_ERROR' });
  }
};

// ✅ HARD DELETE: exclui a organização (owner-only) e dados escopados para liberar limite do plano
exports.deleteOrgHard = async (req, res) => {
  try {
    const { id: orgId } = req.params;

    const userId =
      (req.user && (req.user._id || req.user.id)) ||
      req.userId ||
      (req.auth && req.auth.id);

    if (!orgId) return res.status(400).json({ error: 'ORG_ID_REQUIRED' });
    if (!userId) return res.status(401).json({ error: 'AUTH_REQUIRED' });

    const org = await Organization.findById(orgId).lean();
    if (!org) return res.status(404).json({ error: 'ORG_NOT_FOUND' });

    // 🔒 Somente o owner (criador/dono real) pode excluir
    if (String(org.owner) !== String(userId)) {
      return res.status(403).json({ error: 'ONLY_OWNER_CAN_DELETE_ORG' });
    }

    const ownerOrgs = await Organization.find({ owner: userId })
      .sort({ createdAt: 1, _id: 1 })
      .select('_id isBillingAnchor')
      .lean();

    const explicitAnchor = ownerOrgs.find((item) => item.isBillingAnchor === true) || null;
    const fallbackAnchor = explicitAnchor || ownerOrgs[0] || null;

    // 🔒 Não permitir excluir a organização âncora do billing
    if (fallbackAnchor && String(fallbackAnchor._id) === String(orgId)) {
      return res.status(403).json({
        error: 'CANNOT_DELETE_BILLING_ANCHOR_ORG',
        message: 'A organização âncora do plano não pode ser excluída.',
      });
    }

    // 🔥 Hard delete dos dados escopados por org (mínimo necessário)
    await Promise.all([
      OrgMember.deleteMany({ org: orgId }),
      Event.deleteMany({ org: orgId }),
      Scale.deleteMany({ org: orgId }),
      Team.deleteMany({ org: orgId }),
    ]);

    await Organization.deleteOne({ _id: orgId });

    return res.json({ ok: true, deletedOrgId: orgId });
  } catch (err) {
    console.error('[deleteOrgHard] err', err);
    return res.status(500).json({ error: 'DELETE_ORG_ERROR' });
  }
};