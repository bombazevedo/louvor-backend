const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const {
  getEvents,
  updateEvent,
  deleteEvent
} = require('../controllers/eventController');

// GET todos eventos
router.get('/', authenticate, getEvents);

// PATCH atualizar evento
router.patch('/:id', authenticate, updateEvent);

// DELETE remover evento
router.delete('/:id', authenticate, deleteEvent);

module.exports = router;