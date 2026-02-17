// src/routes/bandRolesRoutes.js
const express = require('express');
const router = express.Router();
const BandRole = require('../models/BandRole');
const { authenticate, isCoordinator } = require('../middleware/auth');
const orgContext = require('../middleware/orgContext');
const { getEntitlementsFor } = require('../utils/entitlements');

// 🔒 Guard específico para edição de Funções da Banda
function canEditBandRoles(req, res, next) {
  try {
    const org = req._org || {};
    const ent = req.entitlements || getEntitlementsFor(org);
    req.entitlements = ent; // mantém disponível adiante

    const inTrial = !!ent.inTrial;
    const plan = String(ent.plan || 'FREE');

    // Planilha: pode alterar Funções da banda → planos 2,3,4,5
    const allowed =
      inTrial || ['2', '3', '4', '5'].includes(plan);

    if (!allowed) {
      return res.status(403).json({
        error: 'FEATURE_LOCKED',
        feature: 'bandRolesEdit',
        plan,
      });
    }

    return next();
  } catch (err) {
    console.error('[bandRolesRoutes.canEditBandRoles] erro:', err);
    return res.status(500).json({ error: 'BAND_ROLES_GUARD_ERROR' });
  }
}


// Seed padrão de funções de banda (idempotente, aplicado no primeiro GET quando vazio)
const DEFAULT_BAND_ROLES = [
  'Ministro',
  'Backing Vocal',
  'Guitarra',
  'Violão',
  'Baixo',
  'Bateria',
  'Teclado',
  'Piano',
  'Violino',
  'Saxofone',
  'Trompete',
  'Trombone',
  'Pandeiro',
  'Chocalho',
  'Percussão',
  'Cavaco',
  'Acordeão',
  'Mesa de Som',
  'Iluminação',
  'Projeção',
  'Streaming',
  'Fotografia',
];

// GET: Todas as funções (por organização)
router.get('/', authenticate, orgContext, async (req, res) => {
  try {
    // ✅ Migração cirúrgica: se existir índice legado "name_1" (unique global),
    // derruba para permitir mesmos nomes em orgs diferentes.
    // (executa de forma segura: fail-silent)
    if (!global.__bandRolesIndexFixed) {
      global.__bandRolesIndexFixed = true;
      try {
        await BandRole.collection.dropIndex('name_1');
      } catch (_e) {
        // ok: não existia
      }
      try {
        await BandRole.syncIndexes();
      } catch (_e2) {
        // fail-silent: não pode derrubar o fluxo
      }
    }

    const orgId = req.orgId;

    // Seed idempotente POR ORG (aplica no primeiro GET quando vazio para a org)
    const count = await BandRole.countDocuments({ orgId });
    if (count === 0) {
      await BandRole.bulkWrite(
        DEFAULT_BAND_ROLES.map((name) => ({
          updateOne: {
            filter: { orgId, name },
            update: { $setOnInsert: { orgId, name } },
            upsert: true,
          },
        }))
      );
    }

    const roles = await BandRole.find({ orgId }).sort({ name: 1 });
    res.json(roles);
  } catch (error) {
    console.error('Erro ao buscar funções:', error);
    res.status(500).json({ message: 'Erro ao buscar funções' });
  }
});

// POST: Criar nova função (por organização)
router.post(
  '/',
  authenticate,
  orgContext,
  isCoordinator,
  canEditBandRoles,
  async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: 'Nome é obrigatório' });

    try {
      const orgId = req.orgId;

      const exists = await BandRole.findOne({
        orgId,
        name: { $regex: `^${name}$`, $options: 'i' },
      });

      if (exists) return res.status(409).json({ message: 'Função já existe' });

      const newRole = new BandRole({ orgId, name });
      await newRole.save();
      res.status(201).json(newRole);
    } catch (error) {
      console.error('Erro ao criar função:', error);
      res.status(500).json({ message: 'Erro ao criar função' });
    }
  }
);

// PATCH: Atualizar função (por organização)
router.patch(
  '/:id',
  authenticate,
  orgContext,
  isCoordinator,
  canEditBandRoles,
  async (req, res) => {
    try {
      const orgId = req.orgId;

      const updated = await BandRole.findOneAndUpdate(
        { _id: req.params.id, orgId },
        { name: req.body.name },
        { new: true }
      );

      if (!updated) {
        return res.status(404).json({ message: 'Função não encontrada' });
      }

      res.json(updated);
    } catch (error) {
      console.error('Erro ao atualizar função:', error);
      res.status(500).json({ message: 'Erro ao atualizar função' });
    }
  }
);

// DELETE: Excluir função (por organização)
router.delete(
  '/:id',
  authenticate,
  orgContext,
  isCoordinator,
  canEditBandRoles,
  async (req, res) => {
    try {
      const orgId = req.orgId;

      const deleted = await BandRole.findOneAndDelete({ _id: req.params.id, orgId });
      if (!deleted) {
        return res.status(404).json({ message: 'Função não encontrada' });
      }

      res.json({ message: 'Função excluída com sucesso' });
    } catch (error) {
      console.error('Erro ao excluir função:', error);
      res.status(500).json({ message: 'Erro ao excluir função' });
    }
  }
);

module.exports = router;
