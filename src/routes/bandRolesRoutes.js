const express = require('express');
const router = express.Router();
const { authenticate, isCoordinator } = require('../middleware/auth');

let bandRoles = [
  { id: '1', name: 'Guitarra', createdBy: 'admin' },
  { id: '2', name: 'Teclado', createdBy: 'admin' },
  { id: '3', name: 'Bateria', createdBy: 'admin' },
  { id: '4', name: 'Vocal', createdBy: 'admin' },
];

// Gerar novo ID simples
const generateId = () => Math.random().toString(36).substring(2, 10);

// ✅ Listar funções
router.get('/', authenticate, async (req, res) => {
  res.status(200).json(bandRoles);
});

// ✅ Adicionar nova função
router.post('/', authenticate, isCoordinator, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ message: 'Nome da função é obrigatório.' });

  const exists = bandRoles.find(r => r.name.toLowerCase() === name.toLowerCase());
  if (exists) return res.status(409).json({ message: 'Função já existe.' });

  const newRole = {
    id: generateId(),
    name,
    createdBy: req.user.name
  };

  bandRoles.push(newRole);
  res.status(201).json(newRole);
});

// ✅ Atualizar nome da função
router.patch('/:id', authenticate, isCoordinator, async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  const role = bandRoles.find(r => r.id === id);
  if (!role) return res.status(404).json({ message: 'Função não encontrada.' });

  role.name = name;
  res.status(200).json(role);
});

// ✅ Deletar função
router.delete('/:id', authenticate, isCoordinator, async (req, res) => {
  const { id } = req.params;

  const index = bandRoles.findIndex(r => r.id === id);
  if (index === -1) return res.status(404).json({ message: 'Função não encontrada.' });

  const removed = bandRoles.splice(index, 1);
  res.status(200).json({ message: 'Função deletada com sucesso.', removed });
});

module.exports = router;
