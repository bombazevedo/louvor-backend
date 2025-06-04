const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { deleteAttachment } = require('../controllers/attachmentController');

router.delete('/:publicId', protect, deleteAttachment);

module.exports = router;
