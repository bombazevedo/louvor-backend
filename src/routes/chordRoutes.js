const express = require('express');
const router = express.Router();
const { getChord, saveChord } = require('../controllers/chordController');
const auth = require('../middleware/auth');

// Rota para buscar cifra (autenticada)
router.get('/', auth, getChord);

// Rota para salvar nova cifra (autenticada)
router.post('/', auth, saveChord);

module.exports = router;