//                               const crypto = require('crypto'); 
const crypto = require('crypto');
const Organization = require('../models/Organization');
const OrgMember = require('../models/OrgMember');

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

    const slug = slugify(name);
    const exists = await Organization.findOne({ slug });
    if (exists) return res.status(409).json({ error: 'ORG_SLUG_TAKEN' });

    const org = await Organization.create({
      name, slug, owner: ownerId
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
    if (!isOwner && (!membership || !['coordenador','dm'].includes(membership.role))) {
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

    const memberships = await OrgMember.find({ user: userId })
      .populate('org', 'name slug license')
      .lean();

    // 🔎 incluir também as orgs onde o usuário é owner (fallback caso não exista membership)
    const memberOrgIds = memberships.map(m => String(m.org?._id || m.org));
    const ownedButNotMember = await Organization.find({
      owner: userId,
      _id: { $nin: memberOrgIds }
    }).lean();

    const response = [
      ...memberships.map(m => ({ org: m.org, role: m.role })),
      ...ownedButNotMember.map(o => ({
        org: { _id: o._id, name: o.name, slug: o.slug, license: o.license },
        role: 'coordenador'
      }))
    ];

    res.json({ orgs: response });
  } catch (err) {
    console.error('[myOrgs] err', err);
    res.status(500).json({ error: 'MY_ORGS_ERROR' });
  }
};
