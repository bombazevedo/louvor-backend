const express = require('express');
const router = express.Router();
const { authenticate, isCoordinator } = require('../middleware/auth');
const BandRole = require('../models/BandRole');

// Listar funções do banco
router.get('/', authenticate, async (req, res) => {
  try {
    const roles = await BandRole.find().sort({ name: 1 });
    res.status(200).json(roles);
  } catch (err) {
    res.status(500).json({ message: 'Erro ao buscar funções', error: err.message });
  }
});

// Criar nova função de banda
router.post('/', authenticate, isCoordinator, async (req, res) => {
  const { name } = req.body;
  if (!name || name.trim() === '') {
    return res.status(400).json({ message: 'O nome da função é obrigatório.' });
  }

  const roleExists = await BandRole.findOne({ name: name.trim() });
  if (roleExists) {
    return res.status(409).json({ message: 'Essa função já está cadastrada.' });
  }

  const newRole = new BandRole({ name: name.trim() });
  const savedRole = await newRole.save();
  res.status(201).json(savedRole);
});

module.exports = router;
