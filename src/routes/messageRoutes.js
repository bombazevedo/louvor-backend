
// src/routes/messageRoutes.js
const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middleware/auth');
const messageController = require('../controllers/messageController');

router.post('/:eventId', authenticateUser, messageController.sendMessage);
router.get('/:eventId', authenticateUser, messageController.getMessagesByEvent);

module.exports = router;
