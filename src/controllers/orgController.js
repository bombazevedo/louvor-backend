const crypto = require('crypto');
const Organization = require('../models/Organization');
const OrgMember = require('../models/OrgMember');
const { getEntitlementsFor } = require('../utils/entitlements'); // ✅ adição pontual
const { getOwnerOrgsPlanState } = require('../utils/orgPlanUtils');

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

    const org = await Organization.create({
      name,
      slug,
      owner: ownerId,
      license: {
        status: 'trial',
        // plano base FREE: durante o trial, o entitlements eleva temporariamente
        // para o plano mais alto (5) conforme src/utils/entitlements.js
        plan: 'FREE',
      },
    });

    await OrgMember.create({ org: org._id, user: ownerId, role: 'coordenador' });

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
      .populate('org', 'name slug license logoUrl cloudinaryPublicId')
      .lean();

    // 🔎 incluir também as orgs onde o usuário é owner (fallback caso não exista membership)
    const memberOrgIds = memberships.map(m => String(m.org?._id || m.org));
    const ownedButNotMember = await Organization.find({
      owner: userId,
      _id: { $nin: memberOrgIds }
    }).lean();

const DEFAULT_PLAN = 'FREE';

const normalizeOrgForResponse = (orgDoc, lockedByPlan) => {
  if (!orgDoc) return null;

  const license = orgDoc.license || {};
  const normalizedLicense = {
    ...license,
    plan: license.plan || DEFAULT_PLAN,
  };

  return {
    ...orgDoc,
    license: normalizedLicense,
    lockedByPlan: !!lockedByPlan,
  };
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

    res.json({
      orgs: response,
      plan: ent.plan,
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

    if (!isOwner && !isCoordinator) {
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
      license.planStart || license.planStartsAt || null; // flexível para futuros ajustes
    const planEnd =
      license.planEnd || license.planExpiresAt || null;  // é o que o app vai usar para "Válido até"
    const billingPeriod = license.billingPeriod || null; // 'monthly' | 'quarterly' | 'annual' | null

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
