// src/routes/songRoutes.js
const express = require('express');
const router = express.Router();
const songController = require('../controllers/songController');

// Rota para criar nova música
router.post('/', songController.createSong);

// Rota para listar todas músicas
router.get('/', songController.getAllSongs);

module.exports = router;
