const express = require("express");
const router = express.Router();
const scaleController = require("../controllers/scaleController");
const authMiddleware = require("../middleware/auth"); // Middleware de autenticação

// Aplicar middleware de autenticação a todas as rotas de escala
router.use(authMiddleware);

// Criar nova escala (POST /api/scales)
// Apenas usuários autenticados podem criar
router.post("/", scaleController.createScale);

// Listar todas as escalas (GET /api/scales)
// Acesso geral para usuários autenticados (pode precisar de filtro/paginação)
router.get("/", scaleController.getAllScales);

// Buscar escala por ID (GET /api/scales/:id)
router.get("/:id", scaleController.getScaleById);

// Buscar escala pelo ID do Evento (GET /api/scales/event/:eventId)
router.get("/event/:eventId", scaleController.getScaleByEventId);

// Atualizar escala por ID (PATCH /api/scales/:id)
// Adicionar verificação de permissão dentro do controller ou middleware específico
router.patch("/:id", scaleController.updateScale);

// Deletar escala por ID (DELETE /api/scales/:id)
// Adicionar verificação de permissão dentro do controller ou middleware específico
router.delete("/:id", scaleController.deleteScale);

module.exports = router;

