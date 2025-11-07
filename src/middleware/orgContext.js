const mongoose = require('mongoose');
const OrgMember = require('../models/OrgMember');
const Organization = require('../models/Organization');

module.exports = async function orgContext(req, res, next) {
  try {
    const orgId = req.header('x-org-id') || req.user?.activeOrgId;
    if (!orgId || !mongoose.isValidObjectId(orgId)) {
      return res.status(400).json({ error: 'ORG_REQUIRED', message: 'Cabeçalho x-org-id é obrigatório.' });
    }
    const membership = await OrgMember.findOne({ org: orgId, user: req.user._id }).lean();
    if (!membership) return res.status(403).json({ error: 'ORG_FORBIDDEN' });

    const org = await Organization.findById(orgId).lean();
    if (!org) return res.status(404).json({ error: 'ORG_NOT_FOUND' });

    req.orgId  = orgId;
    req.orgRole = membership.role;
    req._org   = org; // cache p/ licenseGuard
    next();
  } catch (err) {
    console.error('[orgContext] erro:', err);
    res.status(500).json({ error: 'ORG_CONTEXT_ERROR' });
  }
};
