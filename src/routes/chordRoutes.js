const express = require('express');
const router = express.Router();
const { getChord, saveChord } = require('../controllers/chordController');
const auth = require('../middleware/auth');

router.get('/', auth, getChord);
router.post('/', auth, saveChord);

module.exports = router;
