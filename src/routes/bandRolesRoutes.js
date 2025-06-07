const express = require('express');
const router = express.Router();
const BandRole = require('../models/BandRole');
const { authenticate, isCoordinator } = require('../middleware/auth');

// GET: Todas as funções
router.get('/', authenticate, async (req, res) => {
  try {
    const roles = await BandRole.find();
    res.json(roles);
  } catch (error) {
    console.error('Erro ao buscar funções:', error);
    res.status(500).json({ message: 'Erro ao buscar funções' });
  }
});

// POST: Criar nova função
router.post('/', authenticate, isCoordinator, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ message: 'Nome é obrigatório' });

  try {
    const exists = await BandRole.findOne({ name: { $regex: `^${name}$`, $options: 'i' } });
    if (exists) return res.status(409).json({ message: 'Função já existe' });

    const newRole = new BandRole({ name });
    await newRole.save();
    res.status(201).json(newRole);
  } catch (error) {
    console.error('Erro ao criar função:', error);
    res.status(500).json({ message: 'Erro ao criar função' });
  }
});

// PATCH: Atualizar função
router.patch('/:id', authenticate, isCoordinator, async (req, res) => {
  try {
    const updated = await BandRole.findByIdAndUpdate(
      req.params.id,
      { name: req.body.name },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: 'Função não encontrada' });
    res.json(updated);
  } catch (error) {
    console.error('Erro ao atualizar função:', error);
    res.status(500).json({ message: 'Erro ao atualizar função' });
  }
});

// DELETE: Excluir função
router.delete('/:id', authenticate, isCoordinator, async (req, res) => {
  try {
    const deleted = await BandRole.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Função não encontrada' });
    res.json({ message: 'Função excluída com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir função:', error);
    res.status(500).json({ message: 'Erro ao excluir função' });
  }
});

module.exports = router;
