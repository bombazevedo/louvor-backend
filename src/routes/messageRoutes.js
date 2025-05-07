const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const messageController = require('../controllers/messageController');

router.post('/:eventId', authenticate, messageController.sendMessage);
router.get('/:eventId', authenticate, messageController.getMessagesByEvent);

module.exports = router;
