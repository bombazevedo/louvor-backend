// src/routes/chordRoutes.js

const express = require('express');
const router = express.Router();
const { getChord, saveChord } = require('../controllers/chordController');

// DEBUG: verificar se os handlers foram importados corretamente
console.log('[ChordRoutes] getChord:', typeof getChord);
console.log('[ChordRoutes] saveChord:', typeof saveChord);

// Rota pública temporária para testes (remover auth depois)
router.get('/', getChord);
router.post('/', saveChord);

module.exports = router;
