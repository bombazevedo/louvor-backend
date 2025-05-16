
const express = require('express');
const router = express.Router();
const { authenticate, isCoordinator } = require('../middleware/auth');
const {
  getEventsWithScales,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent
} = require('../controllers/eventController');

router.get('/', authenticate, getEventsWithScales);
router.post('/', authenticate, isCoordinator, createEvent);
router.get('/:id', authenticate, getEventById);
router.patch('/:id', authenticate, updateEvent);
router.delete('/:id', authenticate, isCoordinator, deleteEvent);

module.exports = router;
