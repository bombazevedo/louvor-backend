// backend/routes/eventRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth'); // Corrigido aqui: nome correto da importação

const {
  getEvents,
  updateEvent,
  deleteEvent
} = require('../controllers/eventController');

// GET todos eventos
router.get('/', auth, getEvents);

// PATCH atualizar evento
router.patch('/:id', auth, updateEvent);

// DELETE remover evento
router.delete('/:id', auth, deleteEvent);

module.exports = router;
