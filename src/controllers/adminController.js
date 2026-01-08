// src/controllers/adminController.js
const mongoose = require('mongoose');

const Organization    = require('../models/Organization');
const OrgMember       = require('../models/OrgMember');
const User            = require('../models/User');
const Song            = require('../models/Song');
const Event           = require('../models/Event');
const Team            = require('../models/Team');
const Repertoire      = require('../models/Repertoire');
const Scale           = require('../models/Scale');
const MusicHistory    = require('../models/MusicHistory');
const Notification    = require('../models/Notification');
const SearchCache     = require('../models/SearchCache');
const SearchHistory   = require('../models/SearchHistory');
const Unavailability  = require('../models/Unavailability');
const DeviceToken     = require('../models/DeviceToken');
const Chord           = require('../models/Chord');

const ALLOWED_COLLECTIONS = {
  organizations: Organization,
  orgmembers: OrgMember,
  users: User,
  songs: Song,
  events: Event,
  teams: Team,
  repertoires: Repertoire,
  scales: Scale,
  musichistories: MusicHistory,
  notifications: Notification,
  searchcaches: SearchCache,
  searchhistories: SearchHistory,
  unavailabilities: Unavailability,
  devicetokens: DeviceToken,
  chords: Chord,
};

/**
 * GET /api/admin/db-info
 * Mostra nome do database e todas as collections existentes
 */
const getDbInfo = async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();

    res.json({
      database: db.databaseName,
      collections: collections.map((c) => c.name),
    });
  } catch (error) {
    console.error('[adminController.getDbInfo] Erro:', error);
    res.status(500).json({ message: 'Erro ao obter informações do banco' });
  }
};

/**
 * GET /api/admin/orgs
 * Lista organizações com nome e license (plano, status, datas)
 */
const listOrgs = async (req, res) => {
  try {
    const orgs = await Organization.find({})
      .select('name slug license')
      .lean();

    res.json(orgs);
  } catch (error) {
    console.error('[adminController.listOrgs] Erro:', error);
    res.status(500).json({ message: 'Erro ao listar organizações' });
  }
};

/**
 * PATCH /api/admin/orgs/:id/license
 * Atualiza plano/status/datas de trial da organização
 */
const updateOrgLicense = async (req, res) => {
  try {
    const { id } = req.params;
    const {
  plan,
  status,
  trialStart,
  trialEnd,
  trialEndsAt,

  // ✅ campos de assinatura paga (mesmos do webhook)
  billingPeriod,
  planStart,
  planEnd,
  pagarmeCustomerId,
  pagarmeSubscriptionId,
} = req.body;

    const org = await Organization.findById(id);

    if (!org) {
      return res.status(404).json({ message: 'Organização não encontrada' });
    }

    if (!org.license) {
      org.license = {};
    }

    if (plan !== undefined) org.license.plan = plan;
    if (status !== undefined) org.license.status = status;

    if (trialStart !== undefined) {
      org.license.trialStart = trialStart ? new Date(trialStart) : null;
    }

    if (trialEnd !== undefined) {
      org.license.trialEnd = trialEnd ? new Date(trialEnd) : null;
    }

        if (trialEndsAt !== undefined) {
      org.license.trialEndsAt = trialEndsAt ? new Date(trialEndsAt) : null;
    }

    // 🔽 INÍCIO — campos reais de assinatura (alinhado ao webhook Pagar.me)
    if (billingPeriod !== undefined) {
      org.license.billingPeriod = billingPeriod || null;
    }

    if (planStart !== undefined) {
      org.license.planStart = planStart ? new Date(planStart) : null;
    }

    if (planEnd !== undefined) {
      org.license.planEnd = planEnd ? new Date(planEnd) : null;
    }

    if (pagarmeCustomerId !== undefined) {
      org.license.pagarmeCustomerId = pagarmeCustomerId ? String(pagarmeCustomerId) : null;
    }

    if (pagarmeSubscriptionId !== undefined) {
      org.license.pagarmeSubscriptionId = pagarmeSubscriptionId ? String(pagarmeSubscriptionId) : null;
    }
    // 🔼 FIM — campos reais de assinatura

    await org.save();

    res.json({
      message: 'License atualizada com sucesso',
      license: org.license,
    });
  } catch (error) {
    console.error('[adminController.updateOrgLicense] Erro:', error);
    res.status(500).json({ message: 'Erro ao atualizar license da organização' });
  }
};

/**
 * GET /api/admin/users
 * Lista usuários (com filtros simples opcionais)
 * Query params:
 *  - email (contém)
 *  - role  (admin|coordenador|dm|usuario)
 *  - limit (default 50)
 */
const listUsers = async (req, res) => {
  try {
    const { email, role } = req.query;
    let { limit } = req.query;
    limit = Number(limit) || 50;

    const filter = {};
    if (email) {
      filter.email = { $regex: email, $options: 'i' };
    }
    if (role) {
      filter.role = role.toLowerCase();
    }

    const users = await User.find(filter)
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean();

    res.json(users);
  } catch (error) {
    console.error('[adminController.listUsers] Erro:', error);
    res.status(500).json({ message: 'Erro ao listar usuários' });
  }
};

/**
 * DELETE /api/admin/users/:id
 * Exclui um usuário e faz limpeza básica de vínculos:
 *  - OrgMember (vínculo com organizações)
 *  - Team.members
 *  - DeviceToken
 * (Demais referências permanecem para evitar efeito cascata agressivo)
 */
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    const orgMembersResult = await OrgMember.deleteMany({ user: id });

    const teamsResult = await Team.updateMany(
      { 'members.user': id },
      { $pull: { members: { user: id } } }
    );

    const deviceTokensResult = await DeviceToken.deleteMany({ user: id });

    const userResult = await User.findByIdAndDelete(id);

    res.json({
      message: 'Usuário excluído com sucesso',
      deletedUserId: id,
      details: {
        orgMembersDeleted: orgMembersResult.deletedCount,
        teamsModified: teamsResult.modifiedCount,
        deviceTokensDeleted: deviceTokensResult.deletedCount,
        userDeleted: !!userResult,
      },
    });
  } catch (error) {
    console.error('[adminController.deleteUser] Erro:', error);
    res.status(500).json({ message: 'Erro ao excluir usuário' });
  }
};

/**
 * DELETE /api/admin/songs
 * Zera TODAS as músicas (coleção Song inteira).
 * Exige body: { "confirmAll": true }
 * para evitar exclusão acidental.
 */
const purgeAllSongs = async (req, res) => {
  try {
    const { confirmAll } = req.body || {};
    if (confirmAll !== true) {
      return res.status(400).json({
        message: 'Confirmação necessária para apagar todas as músicas',
        hint: 'Envie { "confirmAll": true } no corpo da requisição',
      });
    }

    const result = await Song.deleteMany({});
    res.json({
      message: 'Todas as músicas foram excluídas com sucesso',
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error('[adminController.purgeAllSongs] Erro:', error);
    res.status(500).json({ message: 'Erro ao excluir músicas' });
  }
};

/**
 * POST /api/admin/collections/:name/purge
 * Endpoint genérico para “fazer o que faria no Atlas”:
 *  - name: nome lógico da coleção (chave de ALLOWED_COLLECTIONS)
 *  - body.filter: objeto de filtro (opcional)
 *  - body.confirmAll: true  -> obrigatório se filter vazio (deleteMany global)
 *
 * Exemplo para apagar todo histórico de repertório:
 *  POST /api/admin/collections/repertoires/purge
 *  { "confirmAll": true }
 *
 * Exemplo para apagar eventos de uma org específica:
 *  POST /api/admin/collections/events/purge
 *  { "filter": { "org": "ID_DA_ORG" } }
 */
const purgeCollection = async (req, res) => {
  try {
    const rawName = String(req.params.name || '').toLowerCase();
    const Model = ALLOWED_COLLECTIONS[rawName];

    if (!Model) {
      return res.status(400).json({
        message: 'Coleção não permitida para operações de admin',
        allowedCollections: Object.keys(ALLOWED_COLLECTIONS),
      });
    }

    const body = req.body || {};
    const filter = body.filter && typeof body.filter === 'object' ? body.filter : {};
    const isGlobalDelete = Object.keys(filter).length === 0;

    if (isGlobalDelete && body.confirmAll !== true) {
      return res.status(400).json({
        message: 'Confirmação necessária para apagar toda a coleção',
        hint: 'Envie { "confirmAll": true } no corpo da requisição ou use um filtro em "filter".',
      });
    }

    const result = await Model.deleteMany(filter);

    res.json({
      message: 'Operação de limpeza concluída',
      collection: rawName,
      filterApplied: filter,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error('[adminController.purgeCollection] Erro:', error);
    res.status(500).json({ message: 'Erro ao limpar coleção' });
  }
};

module.exports = {
  getDbInfo,
  listOrgs,
  updateOrgLicense,
  listUsers,
  deleteUser,
  purgeAllSongs,
  purgeCollection,
};
