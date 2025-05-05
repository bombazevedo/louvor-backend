const express = require("express");
const router = express.Router();
const repertoireController = require("../controllers/repertoireController");
const { authenticate } = require("../middleware/auth"); // Middleware de autenticação

// Aplicar middleware de autenticação a todas as rotas de repertório
router.use(authenticate);

// Criar novo repertório (POST /api/repertoires)
router.post("/", repertoireController.createRepertoire);

// Listar todos os repertórios (GET /api/repertoires)
router.get("/", repertoireController.getAllRepertoires);

// Buscar repertório por ID (GET /api/repertoires/:id)
router.get("/:id", repertoireController.getRepertoireById);

// Buscar repertório pelo ID do Evento (GET /api/repertoires/event/:eventId)
router.get("/event/:eventId", repertoireController.getRepertoireByEventId);

// Atualizar repertório por ID (PATCH /api/repertoires/:id)
router.patch("/:id", repertoireController.updateRepertoire);

// Deletar repertório por ID (DELETE /api/repertoires/:id)
router.delete("/:id", repertoireController.deleteRepertoire);

module.exports = router;