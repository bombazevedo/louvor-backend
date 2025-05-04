// backend/routes/scaleRoutes.js
const express = require("express");
const router = express.Router();
const scaleController = require("../controllers/scaleController");
const authMiddleware = require("../middleware/auth");

// Aplicar middleware de autenticação a todas as rotas de escala
router.use(authMiddleware);

// Criar nova escala (POST /api/scales)
router.post("/", scaleController.createScale);

// Listar todas as escalas (GET /api/scales)
router.get("/", scaleController.getAllScales);

// Buscar escala pelo ID do Evento (GET /api/scales/event/:eventId)
router.get("/event/:eventId", scaleController.getScaleByEventId);

// Buscar escala por ID (GET /api/scales/:id)
router.get("/:id", scaleController.getScaleById);

// Atualizar escala por ID (PATCH /api/scales/:id)
router.patch("/:id", scaleController.updateScale);

// Deletar escala por ID (DELETE /api/scales/:id)
router.delete("/:id", scaleController.deleteScale);

module.exports = router;
