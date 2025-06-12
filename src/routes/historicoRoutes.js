// routes/historicoRoutes.js
const express = require("express");
const router = express.Router();
const historicoController = require("../controllers/historicoController");

// Todos os usuários podem acessar sem autenticação
router.get("/", historicoController.listarHistorico);

module.exports = router;
