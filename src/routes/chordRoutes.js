const express = require('express');
const router = express.Router();
const chordController = require('../controllers/chordController');
const auth = require('../middleware/auth');

router.get('/', auth, chordController.getChord);
router.post('/', auth, chordController.saveChord);

module.exports = router;
