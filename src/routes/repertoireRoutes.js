const express = require("express");
const router = express.Router();
const repertoireController = require("../controllers/repertoireController");
const authMiddleware = require("../middleware/auth"); // Middleware de autenticação

// Aplicar middleware de autenticação a todas as rotas de repertório
router.use(authMiddleware);

// Criar novo repertório (POST /api/repertoires)
// Apenas usuários autenticados podem criar
router.post("/", repertoireController.createRepertoire);

// Listar todos os repertórios (GET /api/repertoires)
// Acesso geral para usuários autenticados (pode precisar de filtro por permissão depois)
router.get("/", repertoireController.getAllRepertoires);

// Buscar repertório por ID (GET /api/repertoires/:id)
router.get("/:id", repertoireController.getRepertoireById);

// Buscar repertório pelo ID do Evento (GET /api/repertoires/event/:eventId)
router.get("/event/:eventId", repertoireController.getRepertoireByEventId);

// Atualizar repertório por ID (PATCH /api/repertoires/:id)
// Adicionar verificação de permissão dentro do controller ou middleware específico
router.patch("/:id", repertoireController.updateRepertoire);

// Deletar repertório por ID (DELETE /api/repertoires/:id)
// Adicionar verificação de permissão dentro do controller ou middleware específico
router.delete("/:id", repertoireController.deleteRepertoire);

module.exports = router;

