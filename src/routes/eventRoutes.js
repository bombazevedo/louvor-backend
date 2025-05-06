const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth'); // Corrigido para refletir seu middleware real

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
