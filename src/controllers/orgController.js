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

    const slug = slugify(name);
    const exists = await Organization.findOne({ slug });
    if (exists) return res.status(409).json({ error: 'ORG_SLUG_TAKEN' });

    const org = await Organization.create({
      name, slug, owner: req.user._id
    });

    await OrgMember.create({ org: org._id, user: req.user._id, role: 'coordenador' });

    res.status(201).json({ org });
  } catch (err) {
    console.error('[createOrg] err', err);
    res.status(500).json({ error: 'CREATE_ORG_ERROR' });
  }
};

exports.generateInvite = async (req, res) => {
  try {
    const { id } = req.params; // orgId
    const membership = await OrgMember.findOne({ org: id, user: req.user._id }).lean();
    if (!membership || !['coordenador','dm'].includes(membership.role)) {
      return res.status(403).json({ error: 'INVITE_FORBIDDEN' });
    }
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    const updated = await Organization.findByIdAndUpdate(
      id,
      { $push: { invites: { code, createdBy: req.user._id } } },
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

    await OrgMember.updateOne(
      { org: org._id, user: req.user._id },
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
    const memberships = await OrgMember.find({ user: req.user._id })
      .populate('org', 'name slug license')
      .lean();
    res.json({ orgs: memberships.map(m => ({ org: m.org, role: m.role })) });
  } catch (err) {
    console.error('[myOrgs] err', err);
    res.status(500).json({ error: 'MY_ORGS_ERROR' });
  }
};
