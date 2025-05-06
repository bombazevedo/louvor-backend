const express = require("express");
const router = express.Router();
const repertoireController = require("../controllers/repertoireController");
const { authenticate } = require("../middleware/auth");

// Middleware de autenticação para todas as rotas
router.use(authenticate);

// Criar novo repertório
router.post("/", repertoireController.createRepertoire);

// Listar todos os repertórios
router.get("/", repertoireController.getAllRepertoires);

// Buscar repertório por ID
router.get("/:id", repertoireController.getRepertoireById);

// Buscar repertório por ID do evento
router.get("/event/:eventId", repertoireController.getRepertoireByEventId);

// Atualizar repertório por ID
router.patch("/:id", repertoireController.updateRepertoire);

// Deletar repertório por ID
router.delete("/:id", repertoireController.deleteRepertoire);

module.exports = router;
