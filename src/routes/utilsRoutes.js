// src/routes/utilsRoutes.js

const express = require('express');
const router = express.Router();

const { deleteImage } = require('../controllers/utilsController');

// ✅ Correto: passando uma função como callback
router.delete('/delete-image', deleteImage);

module.exports = router;
